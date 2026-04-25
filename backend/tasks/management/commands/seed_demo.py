from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from tasks.models import Department, FlowEvent, Task, TaskComment, UserProfile


class Command(BaseCommand):
    help = "创建本地演示账号、部门、任务、评论和流转事件。"

    def handle(self, *args, **options):
        departments = {}
        for code, name in [
            ("ops", "运营部"),
            ("legal", "法务部"),
            ("purchase", "采购中心"),
            ("success", "客户成功部"),
            ("asset", "资产部"),
            ("finance", "财务共享中心"),
        ]:
            departments[code], _ = Department.objects.get_or_create(code=code, defaults={"name": name})

        users = {}
        for username, display_name in [
            ("demo", "演示用户"),
            ("zhoulan", "周岚"),
            ("liran", "李然"),
            ("xuning", "许宁"),
            ("mengqing", "孟青"),
            ("zhaoyi", "赵一"),
            ("chenmo", "陈默"),
            ("external", "无关用户"),
        ]:
            user, created = User.objects.get_or_create(username=username, defaults={"first_name": display_name})
            if created:
                user.set_password("demo123456")
                user.save()
            users[username] = user

        default_departments = {
            "demo": "ops",
            "zhoulan": "purchase",
            "liran": "legal",
            "xuning": "success",
            "mengqing": "asset",
            "zhaoyi": "ops",
            "chenmo": "purchase",
            "external": "finance",
        }
        for username, department_code in default_departments.items():
            profile, _ = UserProfile.objects.get_or_create(user=users[username])
            profile.default_department = departments[department_code]
            profile.save(update_fields=["default_department"])

        Task.objects.all().delete()
        now = timezone.now()

        def make_task(title, owner, department, status, priority, due_offset, participants=None, confirmer=None, creator="demo"):
            task = Task.objects.create(
                title=title,
                description="补齐准入资料并确认法务意见，完成后进入财务验收节点。",
                creator=users[creator],
                owner=users[owner],
                confirmer=users.get(confirmer) if confirmer else None,
                department=departments[department],
                status=status,
                priority=priority,
                due_at=now + due_offset,
                completed_at=now - timedelta(hours=2) if status == Task.Status.DONE else None,
            )
            if participants:
                task.participants.set([users[name] for name in participants])
            task.candidate_owners.set([task.owner])
            return task

        task1 = make_task(
            "供应商准入资料复核",
            "zhoulan",
            "purchase",
            Task.Status.CONFIRMING,
            Task.Priority.HIGH,
            timedelta(hours=4),
            participants=["demo", "liran", "chenmo"],
            confirmer="demo",
        )
        task2 = make_task("合同验收确认", "liran", "legal", Task.Status.CONFIRMING, Task.Priority.MEDIUM, timedelta(days=1), participants=["demo"])
        task3 = make_task("客户资料补正", "xuning", "success", Task.Status.OVERDUE, Task.Priority.HIGH, timedelta(days=-1), participants=["demo"])
        task4 = make_task("设备维修派单", "mengqing", "asset", Task.Status.IN_PROGRESS, Task.Priority.LOW, timedelta(days=2), participants=["demo"])
        task5 = make_task("本周归档复盘", "demo", "ops", Task.Status.DONE, Task.Priority.MEDIUM, timedelta(days=-2), participants=["zhaoyi"])
        make_task("无关测试任务", "external", "finance", Task.Status.IN_PROGRESS, Task.Priority.LOW, timedelta(days=3), creator="external")

        def add_events(task, rows):
            for offset_hours, actor, event_type, from_status, to_status, from_owner, to_owner, from_department, to_department, note in rows:
                event = FlowEvent.objects.create(
                    task=task,
                    actor=users[actor],
                    event_type=event_type,
                    from_status=from_status,
                    to_status=to_status,
                    from_owner=users.get(from_owner) if from_owner else None,
                    to_owner=users.get(to_owner) if to_owner else task.owner,
                    from_department=departments.get(from_department) if from_department else None,
                    to_department=departments.get(to_department) if to_department else task.department,
                    note=note,
                )
                event.created_at = now - timedelta(hours=offset_hours)
                event.save(update_fields=["created_at"])

        add_events(
            task1,
            [
                (9, "zhaoyi", FlowEvent.EventType.CREATED, "", Task.Status.TODO, None, "zhaoyi", None, "ops", "创建任务"),
                (7.5, "zhaoyi", FlowEvent.EventType.OWNER, Task.Status.TODO, Task.Status.IN_PROGRESS, "zhaoyi", "liran", "ops", "legal", "转派法务"),
                (5.2, "liran", FlowEvent.EventType.STATUS, Task.Status.IN_PROGRESS, Task.Status.TODO, "liran", "chenmo", "legal", "purchase", "退回补充资料"),
                (2.4, "chenmo", FlowEvent.EventType.STATUS, Task.Status.TODO, Task.Status.CONFIRMING, "chenmo", "zhoulan", "purchase", "purchase", "提交确认"),
            ],
        )
        for task in [task2, task3, task4, task5]:
            add_events(task, [(4, "demo", FlowEvent.EventType.CREATED, "", task.status, None, task.owner.username, None, task.department.code, "创建任务")])

        TaskComment.objects.create(task=task1, author=users["demo"], content="@周岚 已补充营业执照，等待法务确认合同条款。")
        TaskComment.objects.create(task=task1, author=users["zhoulan"], content="收到，确认后会转入财务验收。")

        self.stdout.write(self.style.SUCCESS("演示数据已生成。账号 demo / demo123456"))
