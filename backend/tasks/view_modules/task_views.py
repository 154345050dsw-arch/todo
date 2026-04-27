from html import unescape

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Case, Count, IntegerField, Max, Q, Value, When
from django.utils import timezone
from django.utils.html import strip_tags
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Department, FlowEvent, Task, TaskNotification, TaskComment
from ..serializers import (
    CommentCreateSerializer,
    ReminderCreateSerializer,
    TaskActionSerializer,
    TaskDetailSerializer,
    TaskListSerializer,
    TaskWriteSerializer,
)
from ..services import (
    can_perform_action,
    create_flow_event,
    create_task_notification,
    create_task_reminder,
    display_user,
    get_user_roles,
    is_limited_candidate_view,
    sanitize_rich_text,
    task_scope,
    TaskAction,
    user_default_department,
    visible_tasks_for,
    writable_task_for,
)


def rich_text_has_content(value):
    return bool(unescape(strip_tags(value or "")).replace("\xa0", " ").strip())


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
        elif action == "cancel":
            roles = get_user_roles(request.user, task)
            if "creator" not in roles and "owner" not in roles:
                return Response({"detail": "只有创建人或责任人可以取消任务。"}, status=status.HTTP_403_FORBIDDEN)
            if "owner" in roles and "creator" not in roles:
                if not note:
                    return Response({"detail": "申请取消必须填写原因。"}, status=status.HTTP_400_BAD_REQUEST)
                task.status = Task.Status.CANCEL_PENDING
                task.cancel_reason = note
                create_task_notification(
                    TaskNotification.NotificationType.TASK_CANCEL_REQUESTED,
                    task,
                    request.user,
                )
            else:
                if not note:
                    return Response({"detail": "取消任务必须填写原因。"}, status=status.HTTP_400_BAD_REQUEST)
                task.status = Task.Status.CANCELLED
                task.cancelled_at = timezone.now()
                task.cancel_reason = note
        elif action == "confirm_cancel":
            if task.creator_id != request.user.id:
                return Response({"detail": "只有创建人可以确认取消。"}, status=status.HTTP_403_FORBIDDEN)
            if task.status != Task.Status.CANCEL_PENDING:
                return Response({"detail": "任务不在待取消确认状态。"}, status=status.HTTP_400_BAD_REQUEST)
            task.status = Task.Status.CANCELLED
            task.cancelled_at = timezone.now()
        elif action == "reject_cancel":
            if task.creator_id != request.user.id:
                return Response({"detail": "只有创建人可以拒绝取消。"}, status=status.HTTP_403_FORBIDDEN)
            if task.status != Task.Status.CANCEL_PENDING:
                return Response({"detail": "任务不在待取消确认状态。"}, status=status.HTTP_400_BAD_REQUEST)
            task.status = Task.Status.IN_PROGRESS
        elif action == "confirm_complete":
            if not can_perform_action(request.user, task, TaskAction.CONFIRM_COMPLETE):
                return Response({"detail": "只有责任人（处理中）或确认人（待确认）可以确认完成。"}, status=status.HTTP_403_FORBIDDEN)
            roles = get_user_roles(request.user, task)
            if task.status == Task.Status.IN_PROGRESS:
                if "owner" not in roles:
                    return Response({"detail": "只有负责人可以提交完成。"}, status=status.HTTP_403_FORBIDDEN)
                if not rich_text_has_content(data.get("completion_note")):
                    return Response({"detail": "确认完成必须填写完成说明。"}, status=status.HTTP_400_BAD_REQUEST)
                task.completion_note = sanitize_rich_text(data["completion_note"])
                task.owner_completed_at = timezone.now()
                confirmation_user_id = task.confirmer_id or task.creator_id
                if confirmation_user_id == request.user.id:
                    task.status = Task.Status.DONE
                    task.completed_at = timezone.now()
                    note = note or "确认完成"
                else:
                    confirmer = User.objects.filter(id=confirmation_user_id).first()
                    if confirmer:
                        task.owner = confirmer
                    task.status = Task.Status.CONFIRMING
                    note = note or "提交确认"
                    create_task_notification(
                        TaskNotification.NotificationType.TASK_COMPLETED,
                        task,
                        request.user,
                    )
            elif task.status == Task.Status.CONFIRMING:
                if "confirmer" not in roles and "owner" not in roles:
                    return Response({"detail": "只有确认人或责任人可以确认。"}, status=status.HTTP_403_FORBIDDEN)
                task.status = Task.Status.DONE
                task.completed_at = timezone.now()
                note = note or "确认"
            else:
                return Response({"detail": "当前状态不允许确认完成。"}, status=status.HTTP_400_BAD_REQUEST)
        elif action == "change_status":
            if not data.get("status"):
                return Response({"detail": "缺少目标状态。"}, status=status.HTTP_400_BAD_REQUEST)
            task.status = data["status"]
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
            task.status = Task.Status.TODO
            create_task_notification(
                TaskNotification.NotificationType.TASK_TRANSFERRED,
                task,
                request.user,
                extra={"from_user": display_user(previous_owner) if previous_owner else "待领取"},
            )

        task.save()
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
        if task.owner_id is None and task.candidate_owners.filter(id=request.user.id).exists() and task.creator_id != request.user.id:
            return Response({"detail": "请先开始处理任务。"}, status=status.HTTP_403_FORBIDDEN)
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
        if is_limited_candidate_view(task, request.user):
            return Response({"detail": "请先开始处理任务。"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ReminderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reminder, error = create_task_reminder(task, request.user, serializer.validated_data.get("remark", ""))
        if error:
            payload = {"detail": error["detail"]}
            if error.get("last_reminded_at"):
                payload["last_reminded_at"] = error["last_reminded_at"]
            return Response(payload, status=error["status"])

        if not reminder:
            return Response({"detail": "无权催办该任务。"}, status=status.HTTP_403_FORBIDDEN)

        return Response(TaskDetailSerializer(reminder.task, context={"request": request}).data, status=status.HTTP_201_CREATED)
