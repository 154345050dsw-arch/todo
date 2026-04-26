from datetime import datetime, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Department, FlowEvent, Task, TaskNotification, TaskReminder, UserProfile
from .services import create_flow_event, duration_analysis, processing_duration_hours, sanitize_rich_text, task_scope, visible_tasks_for


class HealthTests(TestCase):
    def test_health_does_not_require_authentication(self):
        response = APIClient().get("/api/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ok")
        self.assertEqual(response.data["service"], "FlowDesk API")


class TaskVisibilityTests(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(name="运营部", code="ops")
        self.user_a = User.objects.create_user(username="a", password="x")
        self.user_b = User.objects.create_user(username="b", password="x")
        UserProfile.objects.create(user=self.user_a, default_department=self.dept)
        UserProfile.objects.create(user=self.user_b, default_department=self.dept)
        self.task = Task.objects.create(
            title="A task",
            creator=self.user_a,
            owner=self.user_a,
            department=self.dept,
            due_at=timezone.now() + timedelta(days=1),
        )
        create_flow_event(self.task, self.user_a, FlowEvent.EventType.CREATED, "created")

    def test_unrelated_user_cannot_see_task(self):
        self.assertEqual(visible_tasks_for(self.user_b).count(), 0)

    def test_participant_can_see_task(self):
        self.task.participants.add(self.user_b)
        self.assertEqual(visible_tasks_for(self.user_b).count(), 1)

    def test_duration_analysis_has_owner_status_department(self):
        data = duration_analysis(self.task)
        self.assertIn("owner", data)
        self.assertIn("department", data)
        self.assertIn("status", data)

    def test_processing_duration_starts_at_first_in_progress_event(self):
        now = timezone.now()
        task = Task.objects.create(
            title="Processing duration",
            creator=self.user_a,
            owner=self.user_b,
            department=self.dept,
            status=Task.Status.IN_PROGRESS,
            due_at=now + timedelta(days=1),
        )
        FlowEvent.objects.create(
            task=task,
            actor=self.user_a,
            event_type=FlowEvent.EventType.CREATED,
            from_status="",
            to_status=Task.Status.TODO,
            created_at=now - timedelta(hours=20),
        )
        FlowEvent.objects.create(
            task=task,
            actor=self.user_b,
            event_type=FlowEvent.EventType.ACTION,
            from_status=Task.Status.TODO,
            to_status=Task.Status.IN_PROGRESS,
            created_at=now - timedelta(hours=2),
        )

        self.assertAlmostEqual(processing_duration_hours(task), 2.0, delta=0.1)

        client = APIClient()
        client.force_authenticate(user=self.user_b)
        response = client.get(f"/api/tasks/{task.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertAlmostEqual(response.data["processing_duration_hours"], 2.0, delta=0.1)

    def test_confirming_scope_only_includes_tasks_currently_waiting_for_confirmation(self):
        done_task = Task.objects.create(
            title="Completed confirmation",
            creator=self.user_a,
            owner=self.user_a,
            confirmer=self.user_b,
            department=self.dept,
            status=Task.Status.DONE,
            completed_at=timezone.now(),
        )
        active_task = Task.objects.create(
            title="Assigned confirmer but not ready",
            creator=self.user_a,
            owner=self.user_a,
            confirmer=self.user_b,
            department=self.dept,
            status=Task.Status.IN_PROGRESS,
        )
        confirming_task = Task.objects.create(
            title="Ready for confirmation",
            creator=self.user_a,
            owner=self.user_a,
            confirmer=self.user_b,
            department=self.dept,
            status=Task.Status.CONFIRMING,
        )
        owner_confirming_task = Task.objects.create(
            title="Owner is waiting in confirmation",
            creator=self.user_a,
            owner=self.user_b,
            confirmer=self.user_a,
            department=self.dept,
            status=Task.Status.CONFIRMING,
        )
        default_creator_confirmation_task = Task.objects.create(
            title="Default confirmation waits for creator",
            creator=self.user_b,
            owner=self.user_a,
            department=self.dept,
            status=Task.Status.CONFIRMING,
        )

        expected_ids = {confirming_task.id, default_creator_confirmation_task.id}
        scoped_ids = set(task_scope(visible_tasks_for(self.user_b), self.user_b, "confirming").values_list("id", flat=True))
        self.assertEqual(scoped_ids, expected_ids)
        self.assertNotIn(done_task.id, scoped_ids)
        self.assertNotIn(active_task.id, scoped_ids)
        self.assertNotIn(owner_confirming_task.id, scoped_ids)

        client = APIClient()
        client.force_authenticate(user=self.user_b)

        dashboard_response = client.get("/api/dashboard/")
        self.assertEqual(dashboard_response.status_code, 200)
        self.assertEqual(dashboard_response.data["confirming"], len(expected_ids))
        self.assertEqual(dashboard_response.data["my_todo"], 0)
        self.assertEqual(dashboard_response.data["created"], 0)

        list_response = client.get("/api/tasks/", {"scope": "confirming"})
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual({task["id"] for task in list_response.data}, expected_ids)

        created_response = client.get("/api/tasks/", {"scope": "created"})
        self.assertEqual(created_response.status_code, 200)
        self.assertEqual(created_response.data, [])

    def test_all_scope_returns_only_visible_tasks(self):
        visible_task = Task.objects.create(
            title="Visible task",
            creator=self.user_a,
            owner=self.user_a,
            department=self.dept,
        )
        visible_task.participants.add(self.user_b)
        Task.objects.create(
            title="Hidden task",
            creator=self.user_a,
            owner=self.user_a,
            department=self.dept,
        )

        client = APIClient()
        client.force_authenticate(user=self.user_b)
        response = client.get("/api/tasks/", {"scope": "all"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual([task["id"] for task in response.data], [visible_task.id])

    def test_today_and_future_scopes_use_deadline_and_relation(self):
        local_now = timezone.localtime()
        today_due = local_now.replace(hour=9, minute=0, second=0, microsecond=0)
        tomorrow_due = today_due + timedelta(days=1)
        next_week_due = today_due + timedelta(days=8)
        yesterday_due = today_due - timedelta(days=1)
        today_owned = Task.objects.create(
            title="Today owned",
            creator=self.user_a,
            owner=self.user_b,
            department=self.dept,
            status=Task.Status.IN_PROGRESS,
            due_at=today_due,
        )
        future_owned = Task.objects.create(
            title="Future owned",
            creator=self.user_a,
            owner=self.user_b,
            department=self.dept,
            status=Task.Status.IN_PROGRESS,
            due_at=tomorrow_due,
        )
        future_created = Task.objects.create(
            title="Future created",
            creator=self.user_b,
            owner=self.user_a,
            department=self.dept,
            status=Task.Status.IN_PROGRESS,
            due_at=next_week_due,
        )
        no_due_participated = Task.objects.create(
            title="No due participated",
            creator=self.user_a,
            owner=self.user_a,
            department=self.dept,
            status=Task.Status.IN_PROGRESS,
            due_at=None,
        )
        no_due_participated.participants.add(self.user_b)
        overdue_owned = Task.objects.create(
            title="Overdue owned",
            creator=self.user_a,
            owner=self.user_b,
            department=self.dept,
            status=Task.Status.IN_PROGRESS,
            due_at=yesterday_due,
        )
        Task.objects.create(
            title="Hidden future",
            creator=self.user_a,
            owner=self.user_a,
            department=self.dept,
            status=Task.Status.IN_PROGRESS,
            due_at=tomorrow_due,
        )
        Task.objects.create(
            title="Closed future",
            creator=self.user_a,
            owner=self.user_b,
            department=self.dept,
            status=Task.Status.DONE,
            due_at=tomorrow_due,
            completed_at=timezone.now(),
        )

        client = APIClient()
        client.force_authenticate(user=self.user_b)

        today_response = client.get("/api/tasks/", {"scope": "my_todo"})
        future_response = client.get("/api/tasks/", {"scope": "future"})
        overdue_response = client.get("/api/tasks/", {"scope": "overdue"})
        dashboard_response = client.get("/api/dashboard/")

        self.assertEqual(today_response.status_code, 200)
        self.assertEqual({task["id"] for task in today_response.data}, {today_owned.id})
        self.assertEqual(future_response.status_code, 200)
        self.assertEqual({task["id"] for task in future_response.data}, {future_owned.id, future_created.id, no_due_participated.id})
        self.assertEqual(overdue_response.status_code, 200)
        self.assertEqual({task["id"] for task in overdue_response.data}, {overdue_owned.id})
        self.assertEqual(dashboard_response.status_code, 200)
        self.assertEqual(dashboard_response.data["my_todo"], 1)
        self.assertEqual(dashboard_response.data["future"], 3)
        self.assertEqual(dashboard_response.data["overdue"], 1)

    def test_task_search_matches_people_and_department(self):
        department = Department.objects.create(name="采购中心", code="purchase")
        owner = User.objects.create_user(username="owner", first_name="周岚", password="x")
        creator = User.objects.create_user(username="creator", first_name="陈默", password="x")
        participant = User.objects.create_user(username="helper", first_name="李然", password="x")
        task = Task.objects.create(
            title="供应商准入资料复核",
            creator=creator,
            owner=owner,
            confirmer=self.user_b,
            department=department,
            code="FD-CUSTOM",
        )
        task.participants.add(participant)

        client = APIClient()
        client.force_authenticate(user=self.user_b)

        for term in ["周岚", "陈默", "李然", "采购中心", "FD-CUSTOM"]:
            response = client.get("/api/tasks/", {"scope": "all", "search": term})
            self.assertEqual(response.status_code, 200)
            self.assertEqual([item["id"] for item in response.data], [task.id])

    def test_task_list_limit_caps_results(self):
        for index in range(3):
            task = Task.objects.create(
                title=f"Limited task {index}",
                creator=self.user_a,
                owner=self.user_a,
                department=self.dept,
            )
            task.participants.add(self.user_b)

        client = APIClient()
        client.force_authenticate(user=self.user_b)
        response = client.get("/api/tasks/", {"scope": "all", "limit": "2"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_create_candidate_task_defaults_deadline_and_limits_candidate_view(self):
        client = APIClient()
        client.force_authenticate(user=self.user_a)
        response = client.post(
            "/api/tasks/",
            {
                "title": "候选领取任务",
                "description": "<p>完整内容</p>",
                "candidate_owner_ids": [self.user_b.id],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        task = Task.objects.get(id=response.data["id"])
        self.assertIsNone(task.owner_id)
        self.assertIsNone(task.department_id)
        self.assertEqual(list(task.candidate_owners.values_list("id", flat=True)), [self.user_b.id])
        self.assertEqual(timezone.localtime(task.due_at).hour, 23)
        self.assertEqual(timezone.localtime(task.due_at).minute, 59)

        client.force_authenticate(user=self.user_b)
        detail_response = client.get(f"/api/tasks/{task.id}/")
        self.assertEqual(detail_response.status_code, 200)
        self.assertTrue(detail_response.data["is_limited_view"])
        self.assertTrue(detail_response.data["can_claim"])
        self.assertEqual(detail_response.data["title"], "候选领取任务")
        self.assertNotIn("description", detail_response.data)

    def test_candidate_can_claim_task_once(self):
        task = Task.objects.create(
            title="待处理",
            description="<p>领取后可见</p>",
            creator=self.user_a,
            status=Task.Status.TODO,
            due_at=timezone.now() + timedelta(days=1),
        )
        task.candidate_owners.add(self.user_b)

        client = APIClient()
        client.force_authenticate(user=self.user_b)
        response = client.post(f"/api/tasks/{task.id}/actions/", {"action": "claim_task"}, format="json")

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.owner_id, self.user_b.id)
        self.assertEqual(task.department_id, self.dept.id)
        self.assertEqual(task.status, Task.Status.IN_PROGRESS)
        self.assertFalse(response.data["is_limited_view"])
        self.assertEqual(response.data["description"], "<p>领取后可见</p>")

        second_response = client.post(f"/api/tasks/{task.id}/actions/", {"action": "claim_task"}, format="json")
        self.assertEqual(second_response.status_code, 400)

    def test_limited_candidate_cannot_comment_or_change_status_before_claim(self):
        task = Task.objects.create(
            title="受限任务",
            description="隐藏内容",
            creator=self.user_a,
            status=Task.Status.TODO,
            due_at=timezone.now() + timedelta(days=1),
        )
        task.candidate_owners.add(self.user_b)

        client = APIClient()
        client.force_authenticate(user=self.user_b)
        action_response = client.post(f"/api/tasks/{task.id}/actions/", {"action": "change_status", "status": "in_progress"}, format="json")
        comment_response = client.post(f"/api/tasks/{task.id}/comments/", {"content": "直接处理"}, format="json")

        self.assertEqual(action_response.status_code, 403)
        self.assertEqual(comment_response.status_code, 403)

    def test_owner_completion_requires_note_before_separate_confirmation(self):
        task = Task.objects.create(
            title="需要单独确认",
            creator=self.user_a,
            owner=self.user_a,
            confirmer=self.user_b,
            department=self.dept,
            status=Task.Status.IN_PROGRESS,
        )
        client = APIClient()
        client.force_authenticate(user=self.user_a)

        submit_response = client.post(f"/api/tasks/{task.id}/actions/", {"action": "confirm_complete"}, format="json")

        self.assertEqual(submit_response.status_code, 400)
        self.assertEqual(submit_response.data["detail"], "确认完成必须填写完成说明。")
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Status.IN_PROGRESS)

        submit_response = client.post(
            f"/api/tasks/{task.id}/actions/",
            {"action": "confirm_complete", "completion_note": "<p>已完成配置</p>"},
            format="json",
        )

        self.assertEqual(submit_response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Status.CONFIRMING)
        self.assertIsNone(task.completed_at)
        self.assertEqual(task.completion_note, "<p>已完成配置</p>")

        client.force_authenticate(user=self.user_b)
        confirm_response = client.post(f"/api/tasks/{task.id}/actions/", {"action": "confirm_complete"}, format="json")

        self.assertEqual(confirm_response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Status.DONE)
        self.assertIsNotNone(task.completed_at)
        self.assertEqual(task.completion_note, "<p>已完成配置</p>")

    def test_completion_skips_confirmation_when_owner_is_confirmer(self):
        task = Task.objects.create(
            title="负责人即确认人",
            creator=self.user_a,
            owner=self.user_b,
            confirmer=self.user_b,
            department=self.dept,
            status=Task.Status.IN_PROGRESS,
        )
        client = APIClient()
        client.force_authenticate(user=self.user_b)

        response = client.post(
            f"/api/tasks/{task.id}/actions/",
            {"action": "confirm_complete", "completion_note": "<p>同一人完成</p>"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Status.DONE)
        self.assertIsNotNone(task.completed_at)
        self.assertEqual(task.completion_note, "<p>同一人完成</p>")
        self.assertFalse(task.events.filter(to_status=Task.Status.CONFIRMING).exists())

    def test_task_reminder_creates_record_event_and_notification_with_rate_limit(self):
        task = Task.objects.create(
            title="需要催办",
            creator=self.user_a,
            owner=self.user_b,
            department=self.dept,
            status=Task.Status.IN_PROGRESS,
            due_at=timezone.now() + timedelta(hours=2),
        )
        client = APIClient()
        client.force_authenticate(user=self.user_a)

        response = client.post(f"/api/tasks/{task.id}/reminders/", {"remark": "请今天处理"}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["reminder_count"], 1)
        reminder = TaskReminder.objects.get(task=task)
        self.assertEqual(reminder.from_user_id, self.user_a.id)
        self.assertEqual(reminder.to_user_id, self.user_b.id)
        self.assertEqual(reminder.remind_type, TaskReminder.RemindType.PROCESS)
        self.assertEqual(reminder.remark, "请今天处理")
        self.assertTrue(task.events.filter(event_type=FlowEvent.EventType.REMIND, note="a催办b处理任务").exists())

        notification = TaskNotification.objects.get(task=task, recipient=self.user_b)
        self.assertEqual(notification.title, "任务催办")
        self.assertIn("a催办你处理任务：需要催办", notification.content)

        repeat_response = client.post(f"/api/tasks/{task.id}/reminders/", {"remark": "再次提醒"}, format="json")
        self.assertEqual(repeat_response.status_code, 429)
        self.assertIn("已在", repeat_response.data["detail"])

        reminder.created_at = timezone.now() - timedelta(minutes=31)
        reminder.save(update_fields=["created_at"])
        second_response = client.post(f"/api/tasks/{task.id}/reminders/", {}, format="json")
        self.assertEqual(second_response.status_code, 201)
        self.assertEqual(TaskReminder.objects.filter(task=task).count(), 2)

    def test_task_reminder_uses_confirmation_targets_and_blocks_closed_tasks(self):
        confirming_task = Task.objects.create(
            title="待确认催办",
            creator=self.user_a,
            owner=self.user_a,
            confirmer=self.user_b,
            department=self.dept,
            status=Task.Status.CONFIRMING,
        )
        cancel_pending_task = Task.objects.create(
            title="待取消确认催办",
            creator=self.user_a,
            owner=self.user_b,
            department=self.dept,
            status=Task.Status.CANCEL_PENDING,
        )
        done_task = Task.objects.create(
            title="已完成不催办",
            creator=self.user_a,
            owner=self.user_b,
            department=self.dept,
            status=Task.Status.DONE,
            completed_at=timezone.now(),
        )

        # user_a 催办 confirming_task：目标是 confirmer=user_b，允许
        client_a = APIClient()
        client_a.force_authenticate(user=self.user_a)
        confirm_response = client_a.post(f"/api/tasks/{confirming_task.id}/reminders/", {}, format="json")
        self.assertEqual(confirm_response.status_code, 201)
        self.assertEqual(TaskReminder.objects.get(task=confirming_task).to_user_id, self.user_b.id)
        self.assertEqual(TaskReminder.objects.get(task=confirming_task).remind_type, TaskReminder.RemindType.CONFIRM)

        # user_a 催办 cancel_pending_task：目标是 creator=user_a，禁止自我催办
        cancel_response_self = client_a.post(f"/api/tasks/{cancel_pending_task.id}/reminders/", {}, format="json")
        self.assertEqual(cancel_response_self.status_code, 400)
        self.assertIn("不能催办自己", cancel_response_self.data.get("detail", ""))

        # user_b（负责人）催办 cancel_pending_task：目标是 creator=user_a，允许
        client_b = APIClient()
        client_b.force_authenticate(user=self.user_b)
        cancel_response = client_b.post(f"/api/tasks/{cancel_pending_task.id}/reminders/", {}, format="json")
        self.assertEqual(cancel_response.status_code, 201)
        self.assertEqual(TaskReminder.objects.get(task=cancel_pending_task).to_user_id, self.user_a.id)
        self.assertEqual(TaskReminder.objects.get(task=cancel_pending_task).remind_type, TaskReminder.RemindType.CANCEL_CONFIRM)

        # 已完成任务不允许催办
        done_response = client_a.post(f"/api/tasks/{done_task.id}/reminders/", {}, format="json")
        self.assertEqual(done_response.status_code, 400)

    def test_notifications_can_be_listed_and_marked_read(self):
        task = Task.objects.create(
            title="通知任务",
            creator=self.user_a,
            owner=self.user_b,
            department=self.dept,
            status=Task.Status.IN_PROGRESS,
        )
        notification = TaskNotification.objects.create(
            recipient=self.user_b,
            actor=self.user_a,
            task=task,
            title="任务催办",
            content="a催办你处理任务：通知任务",
        )
        client = APIClient()
        client.force_authenticate(user=self.user_b)

        list_response = client.get("/api/notifications/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data["unread_count"], 1)
        self.assertEqual(list_response.data["results"][0]["task"]["id"], task.id)

        read_response = client.post(f"/api/notifications/{notification.id}/read/", {}, format="json")
        self.assertEqual(read_response.status_code, 200)
        notification.refresh_from_db()
        self.assertTrue(notification.is_read)

    def test_sanitize_rich_text_strips_unsafe_markup(self):
        html = '<p onclick="x()">安全</p><script>alert(1)</script><img src="javascript:alert(1)"><img src="data:image/png;base64,abcd">'

        sanitized = sanitize_rich_text(html)

        self.assertIn("<p>安全</p>", sanitized)
        self.assertNotIn("onclick", sanitized)
        self.assertNotIn("<script>", sanitized)
        self.assertNotIn("alert(1)", sanitized)
        self.assertNotIn("javascript:", sanitized)
        self.assertIn('src="data:image/png;base64,abcd"', sanitized)

    def test_daily_activity_counts_only_visible_events_for_month(self):
        visible_task = Task.objects.create(
            title="Visible activity",
            creator=self.user_a,
            owner=self.user_a,
            department=self.dept,
            status=Task.Status.IN_PROGRESS,
        )
        visible_task.participants.add(self.user_b)
        hidden_task = Task.objects.create(
            title="Hidden activity",
            creator=self.user_a,
            owner=self.user_a,
            department=self.dept,
            status=Task.Status.IN_PROGRESS,
        )
        april_event_at = timezone.make_aware(datetime(2026, 4, 5, 10, 0))
        may_event_at = timezone.make_aware(datetime(2026, 5, 1, 10, 0))
        FlowEvent.objects.create(
            task=visible_task,
            actor=self.user_a,
            event_type=FlowEvent.EventType.ACTION,
            to_status=Task.Status.IN_PROGRESS,
            created_at=april_event_at,
        )
        FlowEvent.objects.create(
            task=visible_task,
            actor=self.user_a,
            event_type=FlowEvent.EventType.ACTION,
            to_status=Task.Status.DONE,
            created_at=may_event_at,
        )
        FlowEvent.objects.create(
            task=hidden_task,
            actor=self.user_a,
            event_type=FlowEvent.EventType.ACTION,
            to_status=Task.Status.IN_PROGRESS,
            created_at=april_event_at,
        )

        client = APIClient()
        client.force_authenticate(user=self.user_b)
        response = client.get("/api/stats/daily-activity/", {"month": "2026-04"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["month"], "2026-04")
        self.assertEqual(response.data["total_actions"], 1)
        self.assertEqual(len(response.data["days"]), 1)
        self.assertEqual(response.data["days"][0]["date"], "2026-04-05")
        self.assertEqual(response.data["days"][0]["status_counts"], {Task.Status.IN_PROGRESS: 1})

    def test_daily_activity_counts_multiple_events_for_same_task_same_day(self):
        task = Task.objects.create(
            title="Repeated activity",
            creator=self.user_a,
            owner=self.user_a,
            department=self.dept,
            status=Task.Status.DONE,
        )
        task.participants.add(self.user_b)
        event_at = timezone.make_aware(datetime(2026, 4, 6, 9, 0))
        FlowEvent.objects.create(
            task=task,
            actor=self.user_a,
            event_type=FlowEvent.EventType.ACTION,
            to_status=Task.Status.IN_PROGRESS,
            created_at=event_at,
        )
        FlowEvent.objects.create(
            task=task,
            actor=self.user_a,
            event_type=FlowEvent.EventType.ACTION,
            to_status=Task.Status.CONFIRMING,
            created_at=event_at + timedelta(hours=1),
        )

        client = APIClient()
        client.force_authenticate(user=self.user_b)
        response = client.get("/api/stats/daily-activity/", {"month": "2026-04"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_actions"], 2)
        self.assertEqual(response.data["days"][0]["total_actions"], 2)
        self.assertEqual(response.data["days"][0]["status_counts"][Task.Status.IN_PROGRESS], 1)
        self.assertEqual(response.data["days"][0]["status_counts"][Task.Status.CONFIRMING], 1)

    def test_daily_activity_falls_back_to_task_status_when_event_has_no_to_status(self):
        task = Task.objects.create(
            title="Fallback status",
            creator=self.user_a,
            owner=self.user_a,
            department=self.dept,
            status=Task.Status.TODO,
        )
        task.participants.add(self.user_b)
        FlowEvent.objects.create(
            task=task,
            actor=self.user_a,
            event_type=FlowEvent.EventType.CREATED,
            created_at=timezone.make_aware(datetime(2026, 4, 7, 9, 0)),
        )

        client = APIClient()
        client.force_authenticate(user=self.user_b)
        response = client.get("/api/stats/daily-activity/", {"month": "2026-04"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["days"][0]["groups"][0]["status"], Task.Status.TODO)
        self.assertEqual(response.data["days"][0]["groups"][0]["events"][0]["task"]["id"], task.id)
