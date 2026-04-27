from datetime import datetime

from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Department, FlowEvent, Task
from ..serializers import DepartmentSerializer, TaskNotificationSerializer, UserSerializer
from ..services import event_label, visible_tasks_for


class DashboardView(APIView):
    def get(self, request):
        tasks = visible_tasks_for(request.user)
        now = timezone.now()
        today = timezone.localdate()
        week_start = now - timezone.timedelta(days=7)

        owner_completed_ids = list(
            tasks.filter(status=Task.Status.CONFIRMING, owner_completed_at__isnull=False)
            .exclude(owner=request.user)
            .values_list("id", flat=True)
        )

        active_for_owner = tasks.exclude(
            status__in=[Task.Status.CONFIRMING, Task.Status.DONE, Task.Status.CANCELLED, Task.Status.CANCEL_PENDING]
        )
        active_for_creator = (
            tasks.exclude(status__in=[Task.Status.DONE, Task.Status.CANCELLED])
            .exclude(id__in=owner_completed_ids)
            .exclude(status=Task.Status.CONFIRMING, confirmer__isnull=True, creator=request.user)
        )

        schedulable = active_for_owner.exclude(status=Task.Status.OVERDUE)
        my_active = schedulable.filter(Q(owner=request.user) | Q(owner__isnull=True, candidate_owners=request.user))

        my_todo_tasks = my_active.filter(due_at__date=today)
        confirming_for_user = (
            tasks.filter(status=Task.Status.CONFIRMING)
            .filter(Q(owner=request.user) | Q(confirmer=request.user) | Q(confirmer__isnull=True, creator=request.user))
            .filter(due_at__date=today)
        )
        # 待取消确认的任务：owner 是当前用户时需要处理
        cancel_pending_for_user = tasks.filter(status=Task.Status.CANCEL_PENDING, due_at__date=today, owner=request.user)
        my_todo_count = my_todo_tasks.count() + confirming_for_user.count() + cancel_pending_for_user.count()

        # 我转派的：actor 是当前用户，且 to_owner 不是当前用户（真正的转派，不包括自己认领）
        transferred_ids = FlowEvent.objects.filter(
            actor=request.user,
            event_type=FlowEvent.EventType.OWNER,
        ).exclude(to_owner=request.user).values_list("task_id", flat=True)

        my_done_count = tasks.filter(status=Task.Status.DONE).count()
        if owner_completed_ids:
            my_done_count += len(owner_completed_ids)

        return Response(
            {
                "my_todo": my_todo_count,
                "future": schedulable.filter(Q(due_at__date__gt=today) | Q(due_at__isnull=True)).count(),
                "confirming": tasks.filter(status=Task.Status.CONFIRMING).filter(Q(confirmer=request.user) | Q(confirmer__isnull=True, creator=request.user)).count(),
                "cancel_pending": tasks.filter(status=Task.Status.CANCEL_PENDING).filter(Q(creator=request.user) | Q(confirmer=request.user)).count(),
                "due_today": my_todo_count,
                "overdue": active_for_owner.filter(Q(status=Task.Status.OVERDUE) | Q(due_at__date__lt=today)).count(),
                "done_week": tasks.filter(status=Task.Status.DONE, completed_at__gte=week_start).count(),
                "done": my_done_count,
                "cancelled": tasks.filter(status=Task.Status.CANCELLED).count(),
                "created": active_for_creator.filter(creator=request.user).count(),
                "participated": active_for_owner.filter(participants=request.user).count(),
                "transferred": tasks.filter(id__in=transferred_ids).exclude(status__in=[Task.Status.DONE, Task.Status.CANCELLED]).count(),
            }
        )


class MetaView(APIView):
    def get(self, request):
        # 统计当前用户创建任务时指定各用户为待处理人的次数
        user_created_tasks = Task.objects.filter(creator=request.user)
        task_ids = list(user_created_tasks.values_list('id', flat=True))

        # 统计 owner 指定次数
        owner_counts = {}
        if task_ids:
            owner_rows = user_created_tasks.filter(owner__isnull=False).values('owner_id').annotate(count=Count('id'))
            owner_counts = {row['owner_id']: row['count'] for row in owner_rows}

        # 统计 candidate_owners 指定次数
        candidate_counts = {}
        if task_ids:
            for user in User.objects.all():
                count = user_created_tasks.filter(candidate_owners=user).count()
                if count > 0:
                    candidate_counts[user.id] = count

        # 合并次数
        total_counts = {}
        for uid, count in owner_counts.items():
            total_counts[uid] = total_counts.get(uid, 0) + count
        for uid, count in candidate_counts.items():
            total_counts[uid] = total_counts.get(uid, 0) + count

        # 获取当前用户的常用负责人
        profile = getattr(request.user, 'profile', None)
        if profile:
            # 确保当前用户在常用负责人列表中
            if not profile.frequent_owners.filter(id=request.user.id).exists():
                profile.frequent_owners.add(request.user)
            frequent_owner_ids = list(profile.frequent_owners.values_list('id', flat=True))
        else:
            frequent_owner_ids = [request.user.id]

        # 构建用户数据（包含 assignment_count）
        users_data = []
        for user in User.objects.order_by('username'):
            user_data = UserSerializer(user).data
            user_data['assignment_count'] = total_counts.get(user.id, 0)
            user_data['is_frequent'] = user.id in frequent_owner_ids
            users_data.append(user_data)

        return Response(
            {
                "users": users_data,
                "frequent_owners": UserSerializer(profile.frequent_owners.all() if profile else [request.user], many=True).data,
                "departments": DepartmentSerializer(Department.objects.order_by("name"), many=True).data,
                "statuses": [{"value": value, "label": label} for value, label in Task.Status.choices],
                "priorities": [{"value": value, "label": label} for value, label in Task.Priority.choices],
            }
        )


class FrequentOwnersView(APIView):
    """更新常用负责人"""
    def post(self, request):
        user_ids = request.data.get('user_ids', [])
        if not isinstance(user_ids, list):
            return Response({"detail": "user_ids 必须是列表"}, status=status.HTTP_400_BAD_REQUEST)

        # 确保当前用户始终在列表中
        if request.user.id not in user_ids:
            user_ids = [request.user.id] + user_ids

        if len(user_ids) > 5:
            user_ids = user_ids[:5]

        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({"detail": "用户档案不存在"}, status=status.HTTP_404_NOT_FOUND)

        # 更新常用负责人
        profile.frequent_owners.set(user_ids)
        return Response({"frequent_owners": UserSerializer(profile.frequent_owners.all(), many=True).data})


class PeopleStatsView(APIView):
    def get(self, request):
        tasks = visible_tasks_for(request.user)
        rows = tasks.values("owner__id", "owner__username", "owner__first_name").annotate(total=Count("id")).order_by("-total")
        return Response(
            [
                {
                    "id": row["owner__id"],
                    "name": row["owner__first_name"] or row["owner__username"],
                    "total": row["total"],
                }
                for row in rows
            ]
        )


class DepartmentStatsView(APIView):
    def get(self, request):
        rows = visible_tasks_for(request.user).values("department__id", "department__name").annotate(total=Count("id")).order_by("-total")
        return Response([{"id": row["department__id"], "name": row["department__name"], "total": row["total"]} for row in rows])


class StatusStatsView(APIView):
    def get(self, request):
        status_labels = dict(Task.Status.choices)
        rows = visible_tasks_for(request.user).values("status").annotate(total=Count("id")).order_by("-total")
        return Response([{"status": row["status"], "label": status_labels.get(row["status"], row["status"]), "total": row["total"]} for row in rows])


class DailyActivityStatsView(APIView):
    def get(self, request):
        month = request.query_params.get("month") or timezone.localdate().strftime("%Y-%m")
        try:
            year, month_number = [int(part) for part in month.split("-", 1)]
            month_start = datetime(year, month_number, 1)
        except (TypeError, ValueError):
            return Response({"detail": "month 参数格式应为 YYYY-MM。"}, status=status.HTTP_400_BAD_REQUEST)

        next_year = year + 1 if month_number == 12 else year
        next_month = 1 if month_number == 12 else month_number + 1
        month_end = datetime(next_year, next_month, 1)
        current_tz = timezone.get_current_timezone()
        month_start = timezone.make_aware(month_start, current_tz)
        month_end = timezone.make_aware(month_end, current_tz)

        visible_task_ids = visible_tasks_for(request.user).values("id")
        events = (
            FlowEvent.objects.filter(task_id__in=visible_task_ids, created_at__gte=month_start, created_at__lt=month_end)
            .select_related("actor", "task", "task__owner", "task__department")
            .order_by("created_at", "id")
        )
        status_labels = dict(Task.Status.choices)
        status_order = [value for value, _ in Task.Status.choices]
        days = {}

        for event in events:
            day_key = timezone.localtime(event.created_at).date().isoformat()
            status_key = event.to_status or event.task.status
            day = days.setdefault(day_key, {"date": day_key, "total_actions": 0, "status_counts": {}, "groups": {}})
            day["total_actions"] += 1
            day["status_counts"][status_key] = day["status_counts"].get(status_key, 0) + 1
            group = day["groups"].setdefault(
                status_key,
                {"status": status_key, "label": status_labels.get(status_key, status_key), "count": 0, "events": []},
            )
            group["count"] += 1
            group["events"].append(
                {
                    "id": event.id,
                    "time": timezone.localtime(event.created_at).isoformat(),
                    "label": event_label(event),
                    "actor": UserSerializer(event.actor).data,
                    "task": {
                        "id": event.task_id,
                        "code": event.task.code,
                        "title": event.task.title,
                        "status": event.task.status,
                        "status_label": status_labels.get(event.task.status, event.task.status),
                        "owner": UserSerializer(event.task.owner).data if event.task.owner_id else None,
                        "department": DepartmentSerializer(event.task.department).data if event.task.department_id else None,
                    },
                }
            )

        packed_days = []
        for day_key in sorted(days):
            day = days[day_key]
            day["groups"] = sorted(
                day["groups"].values(),
                key=lambda group: status_order.index(group["status"]) if group["status"] in status_order else len(status_order),
            )
            packed_days.append(day)

        return Response({"month": month, "total_actions": sum(day["total_actions"] for day in packed_days), "days": packed_days})
