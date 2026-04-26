from datetime import datetime
from html import unescape

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Case, Count, F, IntegerField, Max, Q, Value, When
from django.utils.html import strip_tags
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Department, FlowEvent, Task, TaskComment, TaskNotification, UserProfile, UserRole
from .serializers import (
    CommentCreateSerializer,
    DepartmentSerializer,
    ReminderCreateSerializer,
    TaskActionSerializer,
    TaskDetailSerializer,
    TaskListSerializer,
    TaskNotificationSerializer,
    TaskWriteSerializer,
    UserSerializer,
)
from .services import (
    can_manage_department,
    can_manage_user,
    can_perform_action,
    create_flow_event,
    create_task_notification,
    create_task_reminder,
    display_user,
    event_label,
    get_available_data_scopes,
    get_department_descendant_ids,
    get_managed_department_ids,
    get_tasks_for_scope,
    get_user_roles,
    is_department_manager,
    is_limited_candidate_view,
    is_super_admin,
    sanitize_rich_text,
    task_scope,
    TaskAction,
    user_default_department,
    visible_tasks_for,
    writable_task_for,
)


def token_payload(user):
    token, _ = Token.objects.get_or_create(user=user)
    return {"token": token.key, "user": UserSerializer(user).data}


def rich_text_has_content(value):
    return bool(unescape(strip_tags(value or "")).replace("\xa0", " ").strip())


class HealthView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok", "service": "FlowDesk API"})


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
        user_data = UserSerializer(request.user).data
        profile = getattr(request.user, 'profile', None)

        user_data['role'] = profile.role if profile else 'member'
        user_data['is_super_admin'] = is_super_admin(request.user)
        user_data['is_department_manager'] = is_department_manager(request.user)
        user_data['managed_department_ids'] = get_managed_department_ids(request.user)
        user_data['available_scopes'] = get_available_data_scopes(request.user)

        return Response(user_data)


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
            reminders_count=Count("reminders", distinct=True),
            latest_reminder_at=Max("reminders__created_at"),
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
        # 通知候选负责人
        for candidate in candidates:
            if candidate.id != request.user.id:
                create_task_notification(
                    TaskNotification.NotificationType.TASK_CREATED,
                    task,
                    request.user,
                    receiver=candidate,
                )
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
            # 使用新的权限检查：创建人和责任人都可以取消
            roles = get_user_roles(request.user, task)
            if "creator" not in roles and "owner" not in roles:
                return Response({"detail": "只有创建人或责任人可以取消任务。"}, status=status.HTTP_403_FORBIDDEN)
            # 责任人申请取消，创建人直接取消
            if "owner" in roles and "creator" not in roles:
                # 责任人走申请取消流程
                if not note:
                    return Response({"detail": "申请取消必须填写原因。"}, status=status.HTTP_400_BAD_REQUEST)
                task.status = Task.Status.CANCEL_PENDING
                task.cancel_reason = note
                # 通知创建人
                create_task_notification(
                    TaskNotification.NotificationType.TASK_CANCEL_REQUESTED,
                    task,
                    request.user,
                )
            else:
                # 创建人直接取消
                if not note:
                    return Response({"detail": "取消任务必须填写原因。"}, status=status.HTTP_400_BAD_REQUEST)
                task.status = Task.Status.CANCELLED
                task.cancelled_at = timezone.now()
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
            if not can_perform_action(request.user, task, TaskAction.CONFIRM_COMPLETE):
                return Response({"detail": "只有责任人（处理中）或确认人（待确认）可以确认完成。"}, status=status.HTTP_403_FORBIDDEN)
            roles = get_user_roles(request.user, task)
            if task.status == Task.Status.IN_PROGRESS:
                # 处理中状态：责任人提交完成
                if "owner" not in roles:
                    return Response({"detail": "只有负责人可以提交完成。"}, status=status.HTTP_403_FORBIDDEN)
                if not rich_text_has_content(data.get("completion_note")):
                    return Response({"detail": "确认完成必须填写完成说明。"}, status=status.HTTP_400_BAD_REQUEST)
                task.completion_note = sanitize_rich_text(data["completion_note"])
                # 记录责任人完成时间
                task.owner_completed_at = timezone.now()
                # 流转给确认人（创建人或指定确认人）
                confirmation_user_id = task.confirmer_id or task.creator_id
                if confirmation_user_id == request.user.id:
                    # 负责人自己就是确认人，直接完成
                    task.status = Task.Status.DONE
                    task.completed_at = timezone.now()
                    note = note or "确认完成"
                else:
                    # 转给确认人确认
                    confirmer = User.objects.filter(id=confirmation_user_id).first()
                    if confirmer:
                        task.owner = confirmer
                    task.status = Task.Status.CONFIRMING
                    note = note or "提交确认"
                    # 通知确认人
                    create_task_notification(
                        TaskNotification.NotificationType.TASK_COMPLETED,
                        task,
                        request.user,
                    )
            elif task.status == Task.Status.CONFIRMING:
                # 待确认状态：确认人确认完成
                if "confirmer" not in roles and "owner" not in roles:
                    return Response({"detail": "只有确认人或责任人可以确认。"}, status=status.HTTP_403_FORBIDDEN)
                task.status = Task.Status.DONE
                task.completed_at = timezone.now()
                note = note or "确认"
            else:
                return Response({"detail": "当前状态不允许确认完成。"}, status=status.HTTP_400_BAD_REQUEST)

        # 状态变更
        elif action == "change_status":
            if not data.get("status"):
                return Response({"detail": "缺少目标状态。"}, status=status.HTTP_400_BAD_REQUEST)
            task.status = data["status"]

        # 转派
        elif action == "transfer":
            if not can_perform_action(request.user, task, TaskAction.TRANSFER):
                return Response({"detail": "只有创建人或责任人可以转派任务。"}, status=status.HTTP_403_FORBIDDEN)
            if not data.get("owner_id"):
                return Response({"detail": "缺少目标负责人。"}, status=status.HTTP_400_BAD_REQUEST)
            target_owner = User.objects.filter(id=data["owner_id"]).first()
            if not target_owner:
                return Response({"detail": "目标负责人不存在。"}, status=status.HTTP_400_BAD_REQUEST)
            previous_owner = task.owner
            task.owner = target_owner
            if data.get("department_id"):
                target_department = Department.objects.filter(id=data["department_id"]).first()
                if not target_department:
                    return Response({"detail": "目标部门不存在。"}, status=status.HTTP_400_BAD_REQUEST)
                task.department = target_department
            # 转派后强制重置为待处理状态，等待接收人确认接收
            task.status = Task.Status.TODO
            # 通知被流转人
            create_task_notification(
                TaskNotification.NotificationType.TASK_TRANSFERRED,
                task,
                request.user,
                extra={"from_user": display_user(previous_owner) if previous_owner else "待领取"},
            )

        task.save()
        # 转派使用 OWNER 类型，便于识别
        create_flow_event(task, request.user, FlowEvent.EventType.OWNER, note=note or "转派", previous=previous)
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
        # 候选人受限视图检查
        if task.owner_id is None and task.candidate_owners.filter(id=request.user.id).exists() and task.creator_id != request.user.id:
            return Response({"detail": "请先开始处理任务。"}, status=status.HTTP_403_FORBIDDEN)
        # 使用新的权限检查函数
        if not can_perform_action(request.user, task, TaskAction.COMMENT):
            return Response({"detail": "无权评论该任务。"}, status=status.HTTP_403_FORBIDDEN)
        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        TaskComment.objects.create(task=task, author=request.user, content=serializer.validated_data["content"])
        return Response(TaskDetailSerializer(task, context={"request": request}).data, status=status.HTTP_201_CREATED)


class TaskReminderView(APIView):
    @transaction.atomic
    def post(self, request, pk):
        task = visible_tasks_for(request.user).filter(pk=pk).first()
        if not task:
            return Response({"detail": "未找到任务。"}, status=status.HTTP_404_NOT_FOUND)
        # 候选人受限视图检查
        if is_limited_candidate_view(task, request.user):
            return Response({"detail": "请先开始处理任务。"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ReminderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # create_task_reminder 内部会检查终态任务（返回400）和频率限制
        reminder, error = create_task_reminder(task, request.user, serializer.validated_data.get("remark", ""))
        if error:
            payload = {"detail": error["detail"]}
            if error.get("last_reminded_at"):
                payload["last_reminded_at"] = error["last_reminded_at"]
            return Response(payload, status=error["status"])

        # 如果 create_task_reminder 返回 None 且没有 error，说明权限问题
        if not reminder:
            return Response({"detail": "无权催办该任务。"}, status=status.HTTP_403_FORBIDDEN)

        return Response(TaskDetailSerializer(reminder.task, context={"request": request}).data, status=status.HTTP_201_CREATED)


class TaskNotificationListView(APIView):
    def get(self, request):
        queryset = TaskNotification.objects.filter(recipient=request.user).select_related("actor", "task")
        unread_count = queryset.filter(is_read=False).count()
        limit = request.query_params.get("limit", 20)
        try:
            limit_value = min(max(int(limit), 1), 50)
        except (TypeError, ValueError):
            limit_value = 20
        return Response(
            {
                "unread_count": unread_count,
                "results": TaskNotificationSerializer(queryset[:limit_value], many=True).data,
            }
        )


class TaskNotificationReadView(APIView):
    def post(self, request, pk):
        notification = TaskNotification.objects.filter(pk=pk, recipient=request.user).select_related("actor", "task").first()
        if not notification:
            return Response({"detail": "未找到通知。"}, status=status.HTTP_404_NOT_FOUND)
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read"])
        return Response(TaskNotificationSerializer(notification).data)


class DashboardView(APIView):
    def get(self, request):
        tasks = visible_tasks_for(request.user)
        now = timezone.now()
        today = timezone.localdate()
        week_start = now - timezone.timedelta(days=7)

        # 区分视角：责任人侧 vs 创建人侧
        # 责任人提交确认的任务（CONFIRMING 状态 + owner_completed_at 有值）
        # 这些任务对责任人算已完成，但对创建人算待确认
        owner_completed_ids = list(tasks.filter(
            status=Task.Status.CONFIRMING,
            owner_completed_at__isnull=False
        ).exclude(owner=request.user).values_list('id', flat=True))

        # 活跃任务（责任人视角）：排除 CONFIRMING/DONE/CANCELLED/CANCEL_PENDING
        active_for_owner = tasks.exclude(
            status__in=[Task.Status.CONFIRMING, Task.Status.DONE, Task.Status.CANCELLED, Task.Status.CANCEL_PENDING]
        )

        # 活跃任务（创建人视角）：包含 CONFIRMING（但排除默认确认人是创建人自己的）
        # 如果任务的 confirmer 是 null 且创建人是当前用户，那 CONFIRMING 状态不算活跃（已流转给确认人）
        active_for_creator = tasks.exclude(
            status__in=[Task.Status.DONE, Task.Status.CANCELLED]
        ).exclude(id__in=owner_completed_ids).exclude(
            status=Task.Status.CONFIRMING,
            confirmer__isnull=True,
            creator=request.user
        )

        schedulable = active_for_owner.exclude(status=Task.Status.OVERDUE)
        my_active = schedulable.filter(Q(owner=request.user) | Q(owner__isnull=True, candidate_owners=request.user))

        # 我转派出去的任务
        transferred_ids = FlowEvent.objects.filter(
            actor=request.user,
            event_type=FlowEvent.EventType.OWNER,
        ).values_list("task_id", flat=True)

        # 已完成统计
        my_done_count = tasks.filter(status=Task.Status.DONE).count()
        if owner_completed_ids:
            my_done_count += len(owner_completed_ids)

        return Response(
            {
                "my_todo": my_active.filter(due_at__date=today).count(),
                "future": schedulable.filter(Q(due_at__date__gt=today) | Q(due_at__isnull=True)).count(),
                "confirming": tasks.filter(status=Task.Status.CONFIRMING).filter(Q(confirmer=request.user) | Q(confirmer__isnull=True, creator=request.user)).count(),
                "cancel_pending": tasks.filter(creator=request.user, status=Task.Status.CANCEL_PENDING).count(),
                "due_today": my_active.filter(due_at__date=today).count(),
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


# ============================================================================
# 组织管理 API
# ============================================================================


class DepartmentTreeView(APIView):
    """获取部门树形结构"""

    def get(self, request):
        if not is_super_admin(request.user) and not is_department_manager(request.user):
            return Response({"detail": "无权访问组织管理。"}, status=status.HTTP_403_FORBIDDEN)

        managed_ids = get_managed_department_ids(request.user)

        def build_tree(depts, parent_id=None):
            tree = []
            for dept in depts:
                if dept.parent_id == parent_id:
                    node = DepartmentSerializer(dept).data
                    node["can_manage"] = is_super_admin(request.user) or dept.id in managed_ids
                    node["member_count"] = UserProfile.objects.filter(default_department=dept, is_active=True).count()
                    node["children"] = build_tree(depts, dept.id)
                    tree.append(node)
            return tree

        departments = Department.objects.filter(is_active=True).order_by("name")
        tree = build_tree(list(departments), None)
        return Response(tree)


class DepartmentInactiveListView(APIView):
    """获取已停用的部门列表"""

    def get(self, request):
        if not is_super_admin(request.user):
            return Response({"detail": "只有超管可以查看已停用部门。"}, status=status.HTTP_403_FORBIDDEN)

        inactive_depts = Department.objects.filter(is_active=False).order_by("name")

        results = []
        for dept in inactive_depts:
            dept_data = DepartmentSerializer(dept).data
            dept_data["parent_name"] = dept.parent.name if dept.parent else None
            dept_data["member_count"] = UserProfile.objects.filter(default_department=dept).count()
            results.append(dept_data)

        return Response(results)


class DepartmentCreateView(APIView):
    """创建部门"""

    def post(self, request):
        if not is_super_admin(request.user) and not is_department_manager(request.user):
            return Response({"detail": "无权创建部门。"}, status=status.HTTP_403_FORBIDDEN)

        name = (request.data.get("name") or "").strip()
        code = (request.data.get("code") or "").strip()
        parent_id = request.data.get("parent_id")
        manager_id = request.data.get("manager_id")

        if not name or not code:
            return Response({"detail": "部门名称和代码必填。"}, status=status.HTTP_400_BAD_REQUEST)

        if Department.objects.filter(name=name).exists():
            return Response({"detail": "部门名称已存在。"}, status=status.HTTP_400_BAD_REQUEST)

        if Department.objects.filter(code=code).exists():
            return Response({"detail": "部门代码已存在。"}, status=status.HTTP_400_BAD_REQUEST)

        # 权限检查：只能在管理的部门下创建子部门
        if parent_id:
            parent = Department.objects.filter(id=parent_id, is_active=True).first()
            if not parent:
                return Response({"detail": "上级部门不存在。"}, status=status.HTTP_404_NOT_FOUND)
            if not can_manage_department(request.user, parent):
                return Response({"detail": "无权在该部门下创建子部门。"}, status=status.HTTP_403_FORBIDDEN)

        # 只有超管可以设置部门负责人
        if manager_id and not is_super_admin(request.user):
            return Response({"detail": "只有超管可以设置部门负责人。"}, status=status.HTTP_403_FORBIDDEN)

        dept = Department.objects.create(
            name=name,
            code=code,
            parent_id=parent_id,
            manager_id=manager_id,
        )
        return Response(DepartmentSerializer(dept).data, status=status.HTTP_201_CREATED)


class DepartmentUpdateView(APIView):
    """更新部门"""

    def patch(self, request, pk):
        dept = Department.objects.filter(pk=pk, is_active=True).first()
        if not dept:
            return Response({"detail": "部门不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_department(request.user, dept):
            return Response({"detail": "无权修改该部门。"}, status=status.HTTP_403_FORBIDDEN)

        name = (request.data.get("name") or "").strip()
        code = (request.data.get("code") or "").strip()
        manager_id = request.data.get("manager_id")
        parent_id = request.data.get("parent_id")

        if name and name != dept.name:
            if Department.objects.filter(name=name).exclude(id=dept.id).exists():
                return Response({"detail": "部门名称已存在。"}, status=status.HTTP_400_BAD_REQUEST)
            dept.name = name

        if code and code != dept.code:
            if Department.objects.filter(code=code).exclude(id=dept.id).exists():
                return Response({"detail": "部门代码已存在。"}, status=status.HTTP_400_BAD_REQUEST)
            dept.code = code

        # 只有超管可以设置部门负责人
        if manager_id is not None and not is_super_admin(request.user):
            return Response({"detail": "只有超管可以设置部门负责人。"}, status=status.HTTP_403_FORBIDDEN)

        if manager_id:
            manager = User.objects.filter(id=manager_id).first()
            dept.manager = manager

        # 检查 parent_id 是否会导致循环引用
        if parent_id is not None:
            new_parent = Department.objects.filter(id=parent_id, is_active=True).first()
            if new_parent:
                # 检查新父级是否是当前部门的子部门（循环引用）
                descendant_ids = get_department_descendant_ids(dept.id)
                if parent_id in descendant_ids:
                    return Response({"detail": "不能将上级部门设置为当前部门的子部门。"}, status=status.HTTP_400_BAD_REQUEST)
                dept.parent = new_parent

        dept.save()
        return Response(DepartmentSerializer(dept).data)


class DepartmentDeactivateView(APIView):
    """停用部门"""

    def post(self, request, pk):
        dept = Department.objects.filter(pk=pk, is_active=True).first()
        if not dept:
            return Response({"detail": "部门不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_department(request.user, dept):
            return Response({"detail": "无权停用该部门。"}, status=status.HTTP_403_FORBIDDEN)

        # 检查是否有下级部门
        if dept.children.filter(is_active=True).exists():
            return Response({"detail": "该部门有下级部门，请先停用下级部门。"}, status=status.HTTP_400_BAD_REQUEST)

        # 检查是否有活跃成员
        active_members = UserProfile.objects.filter(default_department=dept, is_active=True).count()
        if active_members > 0:
            return Response({"detail": f"该部门有 {active_members} 名活跃成员，请先调整成员部门。"}, status=status.HTTP_400_BAD_REQUEST)

        dept.is_active = False
        dept.save()
        return Response({"detail": "部门已停用。"})


class DepartmentActivateView(APIView):
    """启用部门"""

    def post(self, request, pk):
        dept = Department.objects.filter(pk=pk).first()
        if not dept:
            return Response({"detail": "部门不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not is_super_admin(request.user):
            return Response({"detail": "只有超管可以启用部门。"}, status=status.HTTP_403_FORBIDDEN)

        # 检查父部门是否已启用
        if dept.parent and not dept.parent.is_active:
            return Response({"detail": "父部门未启用，请先启用父部门。"}, status=status.HTTP_400_BAD_REQUEST)

        dept.is_active = True
        dept.save()
        return Response({"detail": "部门已启用。"})


class UserListView(APIView):
    """获取用户列表（带筛选）和创建用户"""

    def get(self, request):
        if not is_super_admin(request.user) and not is_department_manager(request.user):
            return Response({"detail": "无权访问成员管理。"}, status=status.HTTP_403_FORBIDDEN)

        managed_ids = get_managed_department_ids(request.user)

        # 筛选条件
        department_id = request.query_params.get("department_id")
        no_department = request.query_params.get("no_department")
        include_inactive = request.query_params.get("include_inactive")
        role = request.query_params.get("role")
        search = (request.query_params.get("search") or "").strip()

        # 根据是否包含禁用用户调整查询
        if include_inactive == "true" and is_super_admin(request.user):
            queryset = User.objects.all().select_related("profile", "profile__default_department")
        else:
            queryset = User.objects.filter(profile__is_active=True).select_related("profile", "profile__default_department")

        # 部门负责人只能看自己管理的部门成员
        if not is_super_admin(request.user):
            queryset = queryset.filter(profile__default_department_id__in=managed_ids)

        if department_id:
            queryset = queryset.filter(profile__default_department_id=department_id)

        if no_department == "true":
            queryset = queryset.filter(profile__default_department__isnull=True)

        if role:
            queryset = queryset.filter(profile__role=role)

        if search:
            queryset = queryset.filter(Q(username__icontains=search) | Q(first_name__icontains=search))

        queryset = queryset.order_by("username")

        results = []
        for user in queryset:
            user_data = UserSerializer(user).data
            user_data["role"] = user.profile.role
            user_data["is_active"] = user.profile.is_active
            user_data["department_path"] = user.profile.default_department.full_path if user.profile.default_department else ""
            user_data["can_manage"] = can_manage_user(request.user, user)
            results.append(user_data)

        return Response(results)

    def post(self, request):
        """创建用户"""
        if not is_super_admin(request.user) and not is_department_manager(request.user):
            return Response({"detail": "无权创建用户。"}, status=status.HTTP_403_FORBIDDEN)

        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        display_name = (request.data.get("display_name") or "").strip()
        department_id = request.data.get("department_id")
        role = request.data.get("role", UserRole.MEMBER)

        if not username or not password:
            return Response({"detail": "用户名和密码必填。"}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"detail": "用户名已存在。"}, status=status.HTTP_400_BAD_REQUEST)

        # 权限检查：只能在管理的部门创建用户
        if department_id:
            dept = Department.objects.filter(id=department_id, is_active=True).first()
            if not dept:
                return Response({"detail": "部门不存在。"}, status=status.HTTP_404_NOT_FOUND)
            if not can_manage_department(request.user, dept):
                return Response({"detail": "无权在该部门创建用户。"}, status=status.HTTP_403_FORBIDDEN)

        # 超管才能创建其他超管或部门负责人
        if role in [UserRole.SUPER_ADMIN, UserRole.DEPARTMENT_MANAGER] and not is_super_admin(request.user):
            return Response({"detail": "只有超管可以创建管理员角色。"}, status=status.HTTP_403_FORBIDDEN)

        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=display_name or username,
        )

        profile = UserProfile.objects.create(
            user=user,
            default_department_id=department_id,
            role=role,
        )

        user_data = UserSerializer(user).data
        user_data["role"] = profile.role
        user_data["department_path"] = profile.default_department.full_path if profile.default_department else ""
        return Response(user_data, status=status.HTTP_201_CREATED)


class UserUpdateView(APIView):
    """更新用户信息"""

    def patch(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({"detail": "用户不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_user(request.user, target_user):
            return Response({"detail": "无权修改该用户。"}, status=status.HTTP_403_FORBIDDEN)

        profile = target_user.profile

        # 更新字段
        display_name = (request.data.get("display_name") or "").strip()
        if display_name:
            target_user.first_name = display_name
            target_user.save(update_fields=["first_name"])

        department_id = request.data.get("department_id")
        if department_id:
            new_dept = Department.objects.filter(id=department_id, is_active=True).first()
            if not new_dept:
                return Response({"detail": "部门不存在。"}, status=status.HTTP_404_NOT_FOUND)
            if not can_manage_department(request.user, new_dept):
                return Response({"detail": "无权将用户移动到该部门。"}, status=status.HTTP_403_FORBIDDEN)
            profile.default_department = new_dept

        role = request.data.get("role")
        if role:
            if role in [UserRole.SUPER_ADMIN, UserRole.DEPARTMENT_MANAGER] and not is_super_admin(request.user):
                return Response({"detail": "只有超管可以修改用户角色为管理员。"}, status=status.HTTP_403_FORBIDDEN)
            profile.role = role

        profile.save()

        user_data = UserSerializer(target_user).data
        user_data["role"] = profile.role
        user_data["department_path"] = profile.default_department.full_path if profile.default_department else ""
        return Response(user_data)


class UserDeactivateView(APIView):
    """禁用用户"""

    def post(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({"detail": "用户不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_user(request.user, target_user):
            return Response({"detail": "无权禁用该用户。"}, status=status.HTTP_403_FORBIDDEN)

        profile = target_user.profile
        profile.is_active = False
        profile.save(update_fields=["is_active"])

        # 同时清除其管理的部门
        if profile.role == UserRole.DEPARTMENT_MANAGER:
            target_user.managed_departments.update(manager=None)

        return Response({"detail": "用户已禁用。"})


class UserActivateView(APIView):
    """启用用户"""

    def post(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({"detail": "用户不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not is_super_admin(request.user):
            return Response({"detail": "只有超管可以启用用户。"}, status=status.HTTP_403_FORBIDDEN)

        profile = target_user.profile
        profile.is_active = True
        profile.save(update_fields=["is_active"])

        return Response({"detail": "用户已启用。"})


class UserResetPasswordView(APIView):
    """重置用户密码"""

    def post(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({"detail": "用户不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_user(request.user, target_user):
            return Response({"detail": "无权重置该用户密码。"}, status=status.HTTP_403_FORBIDDEN)

        new_password = request.data.get("new_password")
        if not new_password:
            return Response({"detail": "请提供新密码。"}, status=status.HTTP_400_BAD_REQUEST)

        target_user.set_password(new_password)
        target_user.save(update_fields=["password"])
        return Response({"detail": "密码已重置。"})


class UserDeleteView(APIView):
    """删除用户"""

    def delete(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({"detail": "用户不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_user(request.user, target_user):
            return Response({"detail": "无权删除该用户。"}, status=status.HTTP_403_FORBIDDEN)

        # 不能删除自己
        if target_user.id == request.user.id:
            return Response({"detail": "不能删除自己。"}, status=status.HTTP_400_BAD_REQUEST)

        # 检查用户是否还有未完成的任务
        active_tasks = Task.objects.filter(
            Q(owner=target_user) | Q(confirmer=target_user),
            status__in=['todo', 'in_progress', 'confirming']
        ).count()

        if active_tasks > 0:
            return Response({
                "detail": f"该用户还有 {active_tasks} 个未完成任务，请先转移任务后再删除。"
            }, status=status.HTTP_400_BAD_REQUEST)

        # 删除用户的评论
        TaskComment.objects.filter(user=target_user).delete()

        # 删除用户的提醒记录
        TaskReminder.objects.filter(sender=target_user).delete()

        # 删除用户的通知
        TaskNotification.objects.filter(user=target_user).delete()

        # 清除用户管理的部门
        if hasattr(target_user, 'managed_departments'):
            target_user.managed_departments.update(manager=None)

        # 删除 UserProfile
        if hasattr(target_user, 'profile'):
            target_user.profile.delete()

        # 删除用户
        target_user.delete()

        return Response({"detail": "用户已删除。"})


class UserTransferTasksView(APIView):
    """转移用户任务给其他用户"""

    def post(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({"detail": "用户不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_user(request.user, target_user):
            return Response({"detail": "无权转移该用户的任务。"}, status=status.HTTP_403_FORBIDDEN)

        transfer_to_id = request.data.get("transfer_to_user_id")
        if not transfer_to_id:
            return Response({"detail": "请指定转移目标用户。"}, status=status.HTTP_400_BAD_REQUEST)

        transfer_to_user = User.objects.filter(pk=transfer_to_id).first()
        if not transfer_to_user:
            return Response({"detail": "目标用户不存在。"}, status=status.HTTP_404_NOT_FOUND)

        # 不能转移给自己
        if transfer_to_user.id == target_user.id:
            return Response({"detail": "不能转移给自己。"}, status=status.HTTP_400_BAD_REQUEST)

        # 转移所有任务
        transferred_tasks = []

        # 转移作为 owner 的任务
        owner_tasks = Task.objects.filter(owner=target_user)
        for task in owner_tasks:
            old_owner = task.owner
            task.owner = transfer_to_user
            task.save(update_fields=['owner'])
            create_flow_event(
                task=task,
                actor=request.user,
                event_type='transfer',
                details={
                    'old_owner': old_owner.username,
                    'new_owner': transfer_to_user.username,
                    'reason': f'用户 {target_user.username} 任务转移'
                }
            )
            transferred_tasks.append(task.id)

        # 转移作为 confirmer 的任务
        confirmer_tasks = Task.objects.filter(confirmer=target_user)
        for task in confirmer_tasks:
            old_confirmer = task.confirmer
            task.confirmer = transfer_to_user
            task.save(update_fields=['confirmer'])
            create_flow_event(
                task=task,
                actor=request.user,
                event_type='transfer',
                details={
                    'old_confirmer': old_confirmer.username if old_confirmer else None,
                    'new_confirmer': transfer_to_user.username,
                    'reason': f'用户 {target_user.username} 任务转移'
                }
            )
            transferred_tasks.append(task.id)

        # 转移作为候选人的任务（candidate_owners）
        candidate_tasks = Task.objects.filter(candidate_owners__in=[target_user])
        for task in candidate_tasks:
            task.candidate_owners.remove(target_user)
            if transfer_to_user not in task.candidate_owners.all():
                task.candidate_owners.add(transfer_to_user)
            transferred_tasks.append(task.id)

        return Response({
            "detail": f"已转移 {len(set(transferred_tasks))} 个任务。",
            "transferred_count": len(set(transferred_tasks))
        })
