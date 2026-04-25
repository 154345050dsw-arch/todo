from datetime import datetime

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Case, Count, F, IntegerField, Q, Value, When
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Department, FlowEvent, Task, TaskComment, UserProfile
from .serializers import (
    CommentCreateSerializer,
    DepartmentSerializer,
    TaskActionSerializer,
    TaskDetailSerializer,
    TaskListSerializer,
    TaskWriteSerializer,
    UserSerializer,
)
from .services import create_flow_event, event_label, sanitize_rich_text, task_scope, user_default_department, visible_tasks_for, writable_task_for


def token_payload(user):
    token, _ = Token.objects.get_or_create(user=user)
    return {"token": token.key, "user": UserSerializer(user).data}


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        display_name = (request.data.get("display_name") or "").strip()
        if not username or not password:
            return Response({"detail": "用户名和密码必填。"}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({"detail": "用户名已存在。"}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.create_user(username=username, password=password, first_name=display_name or username)
        UserProfile.objects.get_or_create(user=user, defaults={"default_department": Department.objects.order_by("id").first()})
        return Response(token_payload(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        user = authenticate(username=request.data.get("username"), password=request.data.get("password"))
        if not user:
            return Response({"detail": "用户名或密码错误。"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(token_payload(user))


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class TaskListCreateView(APIView):
    def get(self, request):
        queryset = visible_tasks_for(request.user)
        queryset = task_scope(queryset, request.user, request.query_params.get("scope", "my_todo"))

        if request.query_params.get("mine_only") == "1":
            queryset = queryset.filter(owner=request.user)

        search = (request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(code__icontains=search)
                | Q(owner__username__icontains=search)
                | Q(owner__first_name__icontains=search)
                | Q(creator__username__icontains=search)
                | Q(creator__first_name__icontains=search)
                | Q(confirmer__username__icontains=search)
                | Q(confirmer__first_name__icontains=search)
                | Q(participants__username__icontains=search)
                | Q(participants__first_name__icontains=search)
                | Q(candidate_owners__username__icontains=search)
                | Q(candidate_owners__first_name__icontains=search)
                | Q(department__name__icontains=search)
                | Q(department__code__icontains=search)
            )

        queryset = queryset.annotate(
            flow_events_count=Count("events", distinct=True),
            due_is_null=Case(
                When(due_at__isnull=True, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            ),
        )
        ordering = []
        if request.query_params.get("group") == "department":
            ordering.append("department__name")
        if request.query_params.get("sort") == "due_at":
            ordering.extend(["due_is_null", "due_at"])
        ordering.extend(["-updated_at", "-id"])

        queryset = queryset.distinct().order_by(*ordering)
        limit = request.query_params.get("limit")
        if limit:
            try:
                limit_value = min(max(int(limit), 0), 100)
                queryset = queryset[:limit_value]
            except ValueError:
                pass

        return Response(TaskListSerializer(queryset, many=True, context={"request": request}).data)

    def post(self, request):
        serializer = TaskWriteSerializer(data=request.data, context={"require_candidates": True})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        candidate_ids = data.get("candidate_owner_ids") or [data["owner_id"]]
        candidates = list(User.objects.filter(id__in=candidate_ids))
        if len(candidates) != len(set(candidate_ids)):
            return Response({"detail": "候选负责人不存在。"}, status=status.HTTP_400_BAD_REQUEST)
        confirmer = User.objects.filter(id=data.get("confirmer_id")).first() if data.get("confirmer_id") else None
        due_at = data.get("due_at")
        if due_at is None:
            local_now = timezone.localtime()
            due_at = local_now.replace(hour=23, minute=59, second=0, microsecond=0)
        task = Task.objects.create(
            title=data["title"],
            description=sanitize_rich_text(data.get("description", "")),
            creator=request.user,
            owner=None,
            confirmer=confirmer,
            department=None,
            status=Task.Status.TODO,
            priority=data.get("priority", Task.Priority.MEDIUM),
            due_at=due_at,
        )
        task.candidate_owners.set(candidates)
        participant_ids = data.get("participant_ids", [])
        if participant_ids:
            task.participants.set(User.objects.filter(id__in=participant_ids))
        create_flow_event(task, request.user, FlowEvent.EventType.CREATED, note="创建任务")
        return Response(TaskDetailSerializer(task, context={"request": request}).data, status=status.HTTP_201_CREATED)


class TaskDetailUpdateView(APIView):
    def get_object(self, request, pk):
        return visible_tasks_for(request.user).filter(pk=pk).first()

    def get(self, request, pk):
        task = self.get_object(request, pk)
        if not task:
            return Response({"detail": "未找到任务。"}, status=status.HTTP_404_NOT_FOUND)
        return Response(TaskDetailSerializer(task, context={"request": request}).data)

    def patch(self, request, pk):
        task = self.get_object(request, pk)
        if not task:
            return Response({"detail": "未找到任务。"}, status=status.HTTP_404_NOT_FOUND)
        if not writable_task_for(request.user, task):
            return Response({"detail": "无权修改该任务。"}, status=status.HTTP_403_FORBIDDEN)

        serializer = TaskWriteSerializer(data={**TaskDetailSerializer(task, context={"request": request}).data, **request.data}, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        previous = {"status": task.status, "owner": task.owner, "department": task.department}

        for field in ["title", "description", "status", "priority", "due_at"]:
            if field in data:
                setattr(task, field, sanitize_rich_text(data[field]) if field == "description" else data[field])
        if "owner_id" in data:
            task.owner = User.objects.filter(id=data["owner_id"]).first() if data["owner_id"] else None
        if "confirmer_id" in data:
            task.confirmer = User.objects.filter(id=data["confirmer_id"]).first() if data["confirmer_id"] else None
        if "department_id" in data:
            task.department = Department.objects.filter(id=data["department_id"]).first() if data["department_id"] else None
        if task.status == Task.Status.DONE and not task.completed_at:
            task.completed_at = timezone.now()
        task.save()
        if "participant_ids" in data:
            task.participants.set(User.objects.filter(id__in=data["participant_ids"]))
        if "candidate_owner_ids" in data:
            task.candidate_owners.set(User.objects.filter(id__in=data["candidate_owner_ids"]))

        if previous["status"] != task.status or getattr(previous["owner"], "id", None) != task.owner_id or getattr(previous["department"], "id", None) != task.department_id:
            create_flow_event(task, request.user, FlowEvent.EventType.ACTION, note=request.data.get("note", "更新任务"), previous=previous)
        return Response(TaskDetailSerializer(task, context={"request": request}).data)


class TaskActionView(APIView):
    def post(self, request, pk):
        task = visible_tasks_for(request.user).filter(pk=pk).first()
        if not task:
            return Response({"detail": "未找到任务。"}, status=status.HTTP_404_NOT_FOUND)

        serializer = TaskActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        previous = {"status": task.status, "owner": task.owner, "department": task.department}
        action = data["action"]
        note = data.get("note", "")

        if task.owner_id is None and action != "claim_task" and task.candidate_owners.filter(id=request.user.id).exists() and task.creator_id != request.user.id:
            return Response({"detail": "请先开始处理任务。"}, status=status.HTTP_403_FORBIDDEN)

        # 创建人直接取消任务
        if action == "claim_task":
            if task.owner_id is not None:
                return Response({"detail": "任务已被领取。"}, status=status.HTTP_400_BAD_REQUEST)
            if not task.candidate_owners.filter(id=request.user.id).exists():
                return Response({"detail": "只有候选负责人可以开始处理。"}, status=status.HTTP_403_FORBIDDEN)
            department = user_default_department(request.user)
            if not department:
                return Response({"detail": "当前用户未设置默认部门，无法自动匹配部门。"}, status=status.HTTP_400_BAD_REQUEST)
            task.owner = request.user
            task.department = department
            task.status = Task.Status.IN_PROGRESS

        # 创建人直接取消任务
        elif action == "cancel":
            if task.creator_id != request.user.id:
                return Response({"detail": "只有创建人可以取消任务。"}, status=status.HTTP_403_FORBIDDEN)
            if not note:
                return Response({"detail": "取消任务必须填写原因。"}, status=status.HTTP_400_BAD_REQUEST)
            task.status = Task.Status.CANCELLED
            task.cancelled_at = timezone.now()
            task.cancel_reason = note

        # 负责人申请取消
        elif action == "apply_cancel":
            if task.owner_id != request.user.id:
                return Response({"detail": "只有负责人可以申请取消。"}, status=status.HTTP_403_FORBIDDEN)
            if not note:
                return Response({"detail": "申请取消必须填写原因。"}, status=status.HTTP_400_BAD_REQUEST)
            task.status = Task.Status.CANCEL_PENDING
            task.cancel_reason = note

        # 创建人确认取消
        elif action == "confirm_cancel":
            if task.creator_id != request.user.id:
                return Response({"detail": "只有创建人可以确认取消。"}, status=status.HTTP_403_FORBIDDEN)
            if task.status != Task.Status.CANCEL_PENDING:
                return Response({"detail": "任务不在待取消确认状态。"}, status=status.HTTP_400_BAD_REQUEST)
            task.status = Task.Status.CANCELLED
            task.cancelled_at = timezone.now()

        # 创建人拒绝取消
        elif action == "reject_cancel":
            if task.creator_id != request.user.id:
                return Response({"detail": "只有创建人可以拒绝取消。"}, status=status.HTTP_403_FORBIDDEN)
            if task.status != Task.Status.CANCEL_PENDING:
                return Response({"detail": "任务不在待取消确认状态。"}, status=status.HTTP_400_BAD_REQUEST)
            task.status = Task.Status.IN_PROGRESS  # 恢复到处理中状态

        # 确认完成
        elif action == "confirm_complete":
            # 如果是处理中状态，先变成待确认，等待创建人确认
            if task.status == Task.Status.IN_PROGRESS:
                # 处理人提交确认，等待创建人最终确认
                task.status = Task.Status.CONFIRMING
            elif task.status == Task.Status.CONFIRMING:
                # 创建人/确认人最终确认完成
                if task.creator_id != request.user.id and task.confirmer_id != request.user.id and task.owner_id != request.user.id:
                    return Response({"detail": "只有创建人、确认人或负责人可以确认完成。"}, status=status.HTTP_403_FORBIDDEN)
                task.status = Task.Status.DONE
                task.completed_at = timezone.now()
                # Save completion note (rich text)
                if data.get("completion_note"):
                    task.completion_note = sanitize_rich_text(data["completion_note"])
            else:
                return Response({"detail": "当前状态不允许确认完成。"}, status=status.HTTP_400_BAD_REQUEST)

        # 状态变更
        elif action == "change_status":
            if not data.get("status"):
                return Response({"detail": "缺少目标状态。"}, status=status.HTTP_400_BAD_REQUEST)
            task.status = data["status"]

        # 转派
        elif action == "transfer":
            if not data.get("owner_id"):
                return Response({"detail": "缺少目标负责人。"}, status=status.HTTP_400_BAD_REQUEST)
            target_owner = User.objects.filter(id=data["owner_id"]).first()
            if not target_owner:
                return Response({"detail": "目标负责人不存在。"}, status=status.HTTP_400_BAD_REQUEST)
            task.owner = target_owner
            if data.get("department_id"):
                target_department = Department.objects.filter(id=data["department_id"]).first()
                if not target_department:
                    return Response({"detail": "目标部门不存在。"}, status=status.HTTP_400_BAD_REQUEST)
                task.department = target_department

        task.save()
        create_flow_event(task, request.user, FlowEvent.EventType.ACTION, note=note or action, previous=previous)
        return Response(TaskDetailSerializer(task, context={"request": request}).data)


class TaskCommentsView(APIView):
    def get(self, request, pk):
        task = visible_tasks_for(request.user).filter(pk=pk).first()
        if not task:
            return Response({"detail": "未找到任务。"}, status=status.HTTP_404_NOT_FOUND)
        if getattr(TaskDetailSerializer(task, context={"request": request}), "data", {}).get("is_limited_view"):
            return Response({"detail": "请先开始处理任务。"}, status=status.HTTP_403_FORBIDDEN)
        return Response(TaskDetailSerializer(task, context={"request": request}).data["comments"])

    def post(self, request, pk):
        task = visible_tasks_for(request.user).filter(pk=pk).first()
        if not task:
            return Response({"detail": "未找到任务。"}, status=status.HTTP_404_NOT_FOUND)
        if task.owner_id is None and task.candidate_owners.filter(id=request.user.id).exists() and task.creator_id != request.user.id:
            return Response({"detail": "请先开始处理任务。"}, status=status.HTTP_403_FORBIDDEN)
        if not writable_task_for(request.user, task):
            return Response({"detail": "无权评论该任务。"}, status=status.HTTP_403_FORBIDDEN)
        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        TaskComment.objects.create(task=task, author=request.user, content=serializer.validated_data["content"])
        return Response(TaskDetailSerializer(task, context={"request": request}).data, status=status.HTTP_201_CREATED)


class DashboardView(APIView):
    def get(self, request):
        tasks = visible_tasks_for(request.user)
        now = timezone.now()
        week_start = now - timezone.timedelta(days=7)
        active = tasks.exclude(status__in=[Task.Status.DONE, Task.Status.CANCELLED, Task.Status.CANCEL_PENDING])
        # 我转派出去的任务
        transferred_ids = FlowEvent.objects.filter(
            actor=request.user,
            from_owner__isnull=False,
            to_owner__isnull=False,
        ).exclude(from_owner_id=F("to_owner_id")).values_list("task_id", flat=True)
        return Response(
            {
                "my_todo": active.filter(Q(owner=request.user) | Q(owner__isnull=True, candidate_owners=request.user)).count(),
                "confirming": tasks.filter(status=Task.Status.CONFIRMING).filter(Q(confirmer=request.user) | Q(owner=request.user)).count(),
                "cancel_pending": tasks.filter(creator=request.user, status=Task.Status.CANCEL_PENDING).count(),
                "due_today": active.filter(due_at__date=now.date()).count(),
                "overdue": active.filter(Q(status=Task.Status.OVERDUE) | Q(due_at__lt=now)).count(),
                "done_week": tasks.filter(status=Task.Status.DONE, completed_at__gte=week_start).count(),
                "done": tasks.filter(status=Task.Status.DONE).count(),
                "cancelled": tasks.filter(status=Task.Status.CANCELLED).count(),
                "created": active.filter(creator=request.user).count(),
                "participated": active.filter(participants=request.user).count(),
                "transferred": tasks.filter(id__in=transferred_ids).exclude(status__in=[Task.Status.DONE, Task.Status.CANCELLED]).count(),
            }
        )


class MetaView(APIView):
    def get(self, request):
        return Response(
            {
                "users": UserSerializer(User.objects.order_by("username"), many=True).data,
                "departments": DepartmentSerializer(Department.objects.order_by("name"), many=True).data,
                "statuses": [{"value": value, "label": label} for value, label in Task.Status.choices],
                "priorities": [{"value": value, "label": label} for value, label in Task.Priority.choices],
            }
        )


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
