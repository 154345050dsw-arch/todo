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
    cancel_active_assignments,
    can_perform_action,
    create_flow_event,
    create_task_notification,
    create_task_reminder,
    display_user,
    can_manage_task_by_scope,
    can_view_data_scope,
    get_user_roles,
    get_tasks_for_scope,
    is_limited_candidate_view,
    is_user_active,
    sanitize_rich_text,
    task_scope,
    TaskAction,
    choose_transfer_source,
    complete_assignment,
    create_task_assignments,
    current_assignment_for,
    has_unfinished_assignments,
    next_open_assignment,
    push_task_update,
    reactivate_assignment,
    start_assignment,
    status_from_open_assignments,
    sync_candidate_owners_from_assignments,
    user_default_department,
    transfer_assignment,
    visible_tasks_for,
    writable_task_for,
)


def rich_text_has_content(value):
    return bool(unescape(strip_tags(value or "")).replace("\xa0", " ").strip())


def active_users_from_ids(user_ids, label):
    ids = [int(user_id) for user_id in user_ids or []]
    if len(ids) != len(set(ids)):
        return [], f"{label}不能重复。"
    users_by_id = {
        user.id: user
        for user in User.objects.filter(id__in=ids).select_related("profile")
    }
    invalid_ids = [user_id for user_id in ids if user_id not in users_by_id or not is_user_active(users_by_id[user_id])]
    if invalid_ids:
        return [], f"{label}不存在或已停用。"
    return [users_by_id[user_id] for user_id in ids], ""


def active_user_from_id(user_id, label):
    if not user_id:
        return None, ""
    users, error = active_users_from_ids([user_id], label)
    return (users[0], "") if users else (None, error)


class TaskListCreateView(APIView):
    def get(self, request):
        data_scope = request.query_params.get("data_scope", "related")
        if not can_view_data_scope(request.user, data_scope):
            return Response({"detail": "无权访问该数据范围。"}, status=status.HTTP_403_FORBIDDEN)
        queryset = get_tasks_for_scope(
            request.user,
            data_scope,
            {"department_ids": request.query_params.getlist("department_ids")},
        )
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
        candidates, candidate_error = active_users_from_ids(candidate_ids, "候选负责人")
        if candidate_error:
            return Response({"detail": candidate_error}, status=status.HTTP_400_BAD_REQUEST)
        confirmer, confirmer_error = active_user_from_id(data.get("confirmer_id"), "确认人")
        if confirmer_error:
            return Response({"detail": confirmer_error}, status=status.HTTP_400_BAD_REQUEST)
        participants, participant_error = active_users_from_ids(data.get("participant_ids", []), "参与人")
        if participant_error:
            return Response({"detail": participant_error}, status=status.HTTP_400_BAD_REQUEST)
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
        create_task_assignments(task, candidates)
        if participants:
            task.participants.set(participants)
        create_flow_event(task, request.user, FlowEvent.EventType.CREATED, note="创建任务")
        for candidate in candidates:
            if candidate.id != request.user.id:
                create_task_notification(
                    TaskNotification.NotificationType.TASK_CREATED,
                    task,
                    request.user,
                    receiver=candidate,
                )
        push_task_update(task, request.user, "created")
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
        workflow_fields = {"status", "owner_id", "candidate_owner_ids", "department_id"}
        if workflow_fields.intersection(request.data.keys()):
            return Response({"detail": "状态、负责人和部门变更请使用任务动作接口。"}, status=status.HTTP_400_BAD_REQUEST)
        task_detail_fields = {"title", "description", "due_at", "priority", "confirmer_id", "participant_ids"}
        updating_task_detail = bool(task_detail_fields.intersection(request.data.keys()))
        if updating_task_detail and task.creator_id != request.user.id and not can_manage_task_by_scope(request.user, task):
            return Response({"detail": "只有创建人可以修改任务详情。"}, status=status.HTTP_403_FORBIDDEN)
        if updating_task_detail and task.status in [Task.Status.DONE, Task.Status.CANCELLED]:
            return Response({"detail": "已完成或已取消任务不可修改任务详情。"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = TaskWriteSerializer(data={**TaskDetailSerializer(task, context={"request": request}).data, **request.data}, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        confirmer = None
        participants = None
        if "confirmer_id" in data:
            confirmer, confirmer_error = active_user_from_id(data["confirmer_id"], "确认人")
            if confirmer_error:
                return Response({"detail": confirmer_error}, status=status.HTTP_400_BAD_REQUEST)
        if "participant_ids" in data:
            participants, participant_error = active_users_from_ids(data["participant_ids"], "参与人")
            if participant_error:
                return Response({"detail": participant_error}, status=status.HTTP_400_BAD_REQUEST)
        previous = {"status": task.status, "owner": task.owner, "department": task.department}

        for field in ["title", "description", "status", "priority", "due_at"]:
            if field in data:
                setattr(task, field, sanitize_rich_text(data[field]) if field == "description" else data[field])
        if "confirmer_id" in data:
            task.confirmer = confirmer
        if task.status == Task.Status.DONE and not task.completed_at:
            task.completed_at = timezone.now()
        task.save()
        if "participant_ids" in data:
            task.participants.set(participants)

        if previous["status"] != task.status or getattr(previous["owner"], "id", None) != task.owner_id or getattr(previous["department"], "id", None) != task.department_id:
            create_flow_event(task, request.user, FlowEvent.EventType.ACTION, note=request.data.get("note", "更新任务"), previous=previous)
        push_task_update(task, request.user, "updated")
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
        if action == "apply_cancel":
            action = "cancel"
        note = data.get("note", "")

        if task.status in [Task.Status.DONE, Task.Status.CANCELLED] and action not in []:
            return Response({"detail": "已完成或已取消任务不可继续流转。"}, status=status.HTTP_400_BAD_REQUEST)

        user_assignment = current_assignment_for(task, request.user)
        if (
            action != "claim_task"
            and task.creator_id != request.user.id
            and (
                (user_assignment and user_assignment.status == Task.Status.TODO)
                or (task.owner_id is None and task.candidate_owners.filter(id=request.user.id).exists())
            )
        ):
            return Response({"detail": "请先开始处理任务。"}, status=status.HTTP_403_FORBIDDEN)

        if action == "claim_task":
            department = user_default_department(request.user)
            if not department:
                return Response({"detail": "当前用户未设置默认部门，无法自动匹配部门。"}, status=status.HTTP_400_BAD_REQUEST)
            assignment, error = start_assignment(task, request.user)
            if error:
                if not task.candidate_owners.filter(id=request.user.id).exists():
                    return Response({"detail": "只有候选负责人可以开始处理。"}, status=status.HTTP_403_FORBIDDEN)
                return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)
            task.owner = request.user
            task.department = department
            task.status = Task.Status.IN_PROGRESS
        elif action == "cancel":
            roles = get_user_roles(request.user, task)
            if not can_perform_action(request.user, task, TaskAction.CANCEL):
                return Response({"detail": "只有创建人、责任人或管理员可以取消任务。"}, status=status.HTTP_403_FORBIDDEN)
            requester_needs_confirmation = ("owner" in roles or "assignment_in_progress" in roles) and "creator" not in roles and "task_admin" not in roles
            if requester_needs_confirmation:
                if not note:
                    return Response({"detail": "申请取消必须填写原因。"}, status=status.HTTP_400_BAD_REQUEST)
                if "assignment_in_progress" in roles and "owner" not in roles:
                    previous["owner"] = request.user
                task.status = Task.Status.CANCEL_PENDING
                task.cancel_reason = note
                # 转给确认人来确认取消，如果没有确认人则转给创建人
                task.owner = task.confirmer or task.creator
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
                cancel_active_assignments(task)
        elif action == "confirm_cancel":
            if task.creator_id != request.user.id and task.confirmer_id != request.user.id:
                return Response({"detail": "只有创建人或确认人可以确认取消。"}, status=status.HTTP_403_FORBIDDEN)
            if task.status != Task.Status.CANCEL_PENDING:
                return Response({"detail": "任务不在待取消确认状态。"}, status=status.HTTP_400_BAD_REQUEST)
            task.status = Task.Status.CANCELLED
            task.cancelled_at = timezone.now()
            cancel_active_assignments(task)
        elif action == "reject_cancel":
            if task.creator_id != request.user.id and task.confirmer_id != request.user.id:
                return Response({"detail": "只有创建人或确认人可以拒绝取消。"}, status=status.HTTP_403_FORBIDDEN)
            if task.status != Task.Status.CANCEL_PENDING:
                return Response({"detail": "任务不在待取消确认状态。"}, status=status.HTTP_400_BAD_REQUEST)
            # 找到发起取消之前的 owner，还给原来的处理人
            cancel_event = task.events.filter(
                event_type=FlowEvent.EventType.OWNER,
                to_status=Task.Status.CANCEL_PENDING
            ).order_by("-created_at", "-id").first()
            if cancel_event and cancel_event.from_owner:
                task.owner = cancel_event.from_owner
            else:
                next_assignment = next_open_assignment(task)
                task.owner = next_assignment.assignee if next_assignment else None
            restored_status = status_from_open_assignments(task)
            task.status = Task.Status.IN_PROGRESS if restored_status == Task.Status.CANCEL_PENDING else restored_status
            note = "拒绝取消，继续执行"
        elif action == "confirm_complete":
            if not can_perform_action(request.user, task, TaskAction.CONFIRM_COMPLETE):
                return Response({"detail": "只有责任人（处理中）或确认人（待确认）可以确认完成。"}, status=status.HTTP_403_FORBIDDEN)
            roles = get_user_roles(request.user, task)
            if task.status in [Task.Status.IN_PROGRESS, Task.Status.OVERDUE]:
                if "owner" not in roles and "assignment_in_progress" not in roles:
                    return Response({"detail": "只有负责人可以提交完成。"}, status=status.HTTP_403_FORBIDDEN)
                if not rich_text_has_content(data.get("completion_note")):
                    return Response({"detail": "确认完成必须填写完成说明。"}, status=status.HTTP_400_BAD_REQUEST)
                completion_note = sanitize_rich_text(data["completion_note"])
                assignment, error = complete_assignment(task, request.user, completion_note)
                if error:
                    return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)
                task.completion_note = completion_note
                task.owner_completed_at = timezone.now()
                if has_unfinished_assignments(task):
                    next_assignment = next_open_assignment(task)
                    task.owner = next_assignment.assignee if next_assignment and next_assignment.status == Task.Status.IN_PROGRESS else None
                    task.status = Task.Status.IN_PROGRESS
                    note = note or f"{display_user(request.user)}完成个人任务"
                else:
                    confirmation_user_id = task.confirmer_id or task.creator_id
                    if confirmation_user_id == request.user.id:
                        task.owner = request.user
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
            if data["status"] != Task.Status.IN_PROGRESS:
                return Response({"detail": "请使用专用操作完成、取消、转派或重办任务。"}, status=status.HTTP_400_BAD_REQUEST)
            if task.status not in [Task.Status.TODO, Task.Status.OVERDUE]:
                return Response({"detail": "只有待处理或已超时任务可以开始处理。"}, status=status.HTTP_400_BAD_REQUEST)
            if task.owner_id != request.user.id and not can_manage_task_by_scope(request.user, task):
                return Response({"detail": "只有当前负责人可以开始处理。"}, status=status.HTTP_403_FORBIDDEN)
            if task.owner_id == request.user.id:
                assignment, error = start_assignment(task, request.user)
                if error and error != "任务已在处理中。":
                    return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)
            task.status = data["status"]
        elif action == "transfer":
            if not can_perform_action(request.user, task, TaskAction.TRANSFER):
                return Response({"detail": "只有创建人或责任人可以转派任务。"}, status=status.HTTP_403_FORBIDDEN)
            if not data.get("owner_id"):
                return Response({"detail": "缺少目标负责人。"}, status=status.HTTP_400_BAD_REQUEST)
            target_owner = User.objects.filter(id=data["owner_id"]).first()
            if not target_owner or not is_user_active(target_owner):
                return Response({"detail": "目标负责人不存在或已停用。"}, status=status.HTTP_400_BAD_REQUEST)
            previous_owner = choose_transfer_source(task, request.user)
            if not previous_owner:
                return Response({"detail": "多人待领取任务请先由责任人开始处理后再转派。"}, status=status.HTTP_400_BAD_REQUEST)
            transfer_assignment(task, previous_owner, target_owner)
            task.owner = target_owner
            if data.get("department_id"):
                target_department = Department.objects.filter(id=data["department_id"], is_active=True).first()
                if not target_department:
                    return Response({"detail": "目标部门不存在或已停用。"}, status=status.HTTP_400_BAD_REQUEST)
                task.department = target_department
            else:
                target_department = getattr(getattr(target_owner, "profile", None), "default_department", None)
                if target_department:
                    task.department = target_department
            task.status = Task.Status.IN_PROGRESS if has_unfinished_assignments(task) and task.assignments.filter(status=Task.Status.IN_PROGRESS).exists() else Task.Status.TODO
            create_task_notification(
                TaskNotification.NotificationType.TASK_TRANSFERRED,
                task,
                request.user,
                extra={"from_user": display_user(previous_owner) if previous_owner else "待领取"},
            )
        elif action == "rework":
            if task.status != Task.Status.CONFIRMING:
                return Response({"detail": "只有待确认状态的任务可以重办。"}, status=status.HTTP_400_BAD_REQUEST)
            roles = get_user_roles(request.user, task)
            if "confirmer" not in roles and "creator" not in roles:
                return Response({"detail": "只有确认人或创建人可以发起重办。"}, status=status.HTTP_403_FORBIDDEN)
            rework_reason = data.get("rework_reason")
            if not rework_reason or not rich_text_has_content(rework_reason):
                return Response({"detail": "重办原因必填。"}, status=status.HTTP_400_BAD_REQUEST)
            rework_owner_id = data.get("rework_owner_id")
            if rework_owner_id:
                rework_owner = User.objects.filter(id=rework_owner_id).first()
                if not rework_owner or not is_user_active(rework_owner):
                    return Response({"detail": "指定的重办人不存在或已停用。"}, status=status.HTTP_400_BAD_REQUEST)
            else:
                # 默认重办人：查找 owner_completed_at 时对应的 owner
                # 通过 FlowEvent 查找最后一次提交确认前的 owner
                last_confirm_event = task.events.filter(
                    event_type=FlowEvent.EventType.STATUS,
                    to_status=Task.Status.CONFIRMING
                ).order_by("-created_at", "-id").first()
                if last_confirm_event and last_confirm_event.from_owner:
                    rework_owner = last_confirm_event.from_owner
                else:
                    rework_owner = task.owner
            if not rework_owner:
                return Response({"detail": "无法确定重办人。"}, status=status.HTTP_400_BAD_REQUEST)
            if not is_user_active(rework_owner):
                return Response({"detail": "重办人已停用。"}, status=status.HTTP_400_BAD_REQUEST)
            # 执行重办
            previous = {"status": task.status, "owner": task.owner}
            reactivate_assignment(task, rework_owner)
            task.owner = rework_owner
            task.status = Task.Status.TODO
            task.rework_count += 1
            task.rework_reason = sanitize_rich_text(rework_reason)
            task.rework_by = request.user
            task.rework_at = timezone.now()
            task.owner_completed_at = None
            # 保留 completion_note，便于重办人参考
            create_task_notification(
                TaskNotification.NotificationType.TASK_REWORKED,
                task,
                request.user,
                receiver=rework_owner,
            )
            note = f"重办任务，原因：{task.rework_reason[:100]}"

        task.save()
        # 负责人变更：转派、认领、发起取消（转给确认人）、拒绝取消（还给原处理人）
        is_owner_change = action in ["transfer", "claim_task", "reject_cancel"] or (action == "cancel" and task.status == Task.Status.CANCEL_PENDING)
        event_type = FlowEvent.EventType.OWNER if is_owner_change else FlowEvent.EventType.STATUS
        if action == "rework":
            event_type = FlowEvent.EventType.REWORK
        create_flow_event(task, request.user, event_type, note=note or action, previous=previous)
        push_task_update(task, request.user, action)
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
        user_assignment = current_assignment_for(task, request.user)
        if (
            task.creator_id != request.user.id
            and (
                (user_assignment and user_assignment.status == Task.Status.TODO)
                or (task.owner_id is None and task.candidate_owners.filter(id=request.user.id).exists())
            )
        ):
            return Response({"detail": "请先开始处理任务。"}, status=status.HTTP_403_FORBIDDEN)
        if not can_perform_action(request.user, task, TaskAction.COMMENT):
            return Response({"detail": "无权评论该任务。"}, status=status.HTTP_403_FORBIDDEN)
        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        TaskComment.objects.create(task=task, author=request.user, content=serializer.validated_data["content"])
        push_task_update(task, request.user, "commented")
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

        push_task_update(reminder.task, request.user, "reminded")
        return Response(TaskDetailSerializer(reminder.task, context={"request": request}).data, status=status.HTTP_201_CREATED)
