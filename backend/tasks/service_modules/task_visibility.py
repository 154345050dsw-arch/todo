from django.db.models import Q
from django.utils import timezone

from ..models import FlowEvent, Task, UserProfile
from .organization_permissions import get_managed_department_ids, is_department_manager, is_super_admin
from .task_assignments import assignment_actionable_q


def user_default_department(user):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile.default_department


def is_limited_candidate_view(task, user):
    if not task or not user or not user.is_authenticated:
        return False
    if task.creator_id == user.id or task.owner_id == user.id:
        return False
    if task.assignments.filter(assignee=user, status="todo").exists():
        return True
    if task.owner_id is not None:
        return False
    return task.candidate_owners.filter(id=user.id).exists()


def _task_base_queryset():
    return (
        Task.objects
        .select_related("creator", "owner", "confirmer", "department")
        .prefetch_related("participants", "candidate_owners", "assignments__assignee")
        .distinct()
    )


def related_tasks_for(user):
    if not user or not user.is_authenticated:
        return Task.objects.none()
    return (
        Task.objects.filter(
            Q(creator=user)
            | Q(owner=user)
            | Q(assignments__assignee=user)
            | Q(owner__isnull=True, candidate_owners=user)
            | Q(confirmer=user)
            | Q(participants=user)
            | Q(comments__author=user)
            | Q(events__actor=user)
            | Q(events__from_owner=user)
            | Q(events__to_owner=user)
            | Q(reminders__from_user=user)
            | Q(reminders__to_user=user)
        )
        .select_related("creator", "owner", "confirmer", "department")
        .prefetch_related("participants", "candidate_owners", "assignments__assignee")
        .distinct()
    )


def managed_department_tasks_for(user):
    managed_ids = get_managed_department_ids(user)
    if not managed_ids:
        return Task.objects.none()
    return (
        Task.objects.filter(
            Q(department_id__in=managed_ids)
            | Q(creator__profile__default_department_id__in=managed_ids)
            | Q(owner__profile__default_department_id__in=managed_ids)
            | Q(assignments__assignee__profile__default_department_id__in=managed_ids)
            | Q(confirmer__profile__default_department_id__in=managed_ids)
            | Q(candidate_owners__profile__default_department_id__in=managed_ids)
            | Q(participants__profile__default_department_id__in=managed_ids)
        )
        .select_related("creator", "owner", "confirmer", "department")
        .prefetch_related("participants", "candidate_owners", "assignments__assignee")
        .distinct()
    )


def visible_tasks_for(user):
    if not user or not user.is_authenticated:
        return Task.objects.none()
    if is_super_admin(user):
        return _task_base_queryset()
    if is_department_manager(user):
        return (related_tasks_for(user) | managed_department_tasks_for(user)).distinct()
    return related_tasks_for(user)


def writable_task_for(user, task):
    if not user or not user.is_authenticated:
        return False
    if task.creator_id == user.id or task.owner_id == user.id or task.confirmer_id == user.id:
        return True
    if task.participants.filter(id=user.id).exists():
        return True
    from .task_permissions import can_manage_task_by_scope
    return can_manage_task_by_scope(user, task)


def task_scope(queryset, user, scope):
    today = timezone.localdate()
    active_excluded_statuses = [Task.Status.DONE, Task.Status.CANCELLED]
    # 创建人的活跃任务：排除已完成/已取消，但包含待确认（即使是别人确认的）
    active_for_creator = queryset.exclude(status__in=active_excluded_statuses)
    # 责任人的活跃任务：排除待确认/已完成/已取消/待取消确认
    active_for_owner = queryset.exclude(status__in=[Task.Status.CONFIRMING, Task.Status.DONE, Task.Status.CANCELLED, Task.Status.CANCEL_PENDING])

    schedulable_queryset = active_for_owner.exclude(status=Task.Status.OVERDUE)
    user_owned_queryset = schedulable_queryset.filter(
        Q(owner=user)
        | Q(owner__isnull=True, candidate_owners=user)
        | assignment_actionable_q(user)
    )

    if scope == "all":
        return queryset
    if scope == "created":
        # 我创建的：包含活跃任务 + 我创建的待确认任务 + 我创建的待取消确认任务
        confirming_created = queryset.filter(status=Task.Status.CONFIRMING, creator=user)
        cancel_pending_created = queryset.filter(status=Task.Status.CANCEL_PENDING, creator=user)
        return active_for_creator.filter(creator=user) | confirming_created | cancel_pending_created
    if scope == "participated":
        return active_for_owner.filter(participants=user)
    if scope == "confirming":
        return queryset.filter(status=Task.Status.CONFIRMING).filter(Q(confirmer=user) | Q(confirmer__isnull=True, creator=user))
    if scope == "cancel_pending":
        # 待取消确认：创建人的任务 + 认人的任务
        return queryset.filter(status=Task.Status.CANCEL_PENDING).filter(Q(creator=user) | Q(confirmer=user))
    if scope == "overdue":
        return active_for_owner.filter(Q(status=Task.Status.OVERDUE) | Q(due_at__date__lt=today))
    if scope == "done":
        done_queryset = queryset.filter(status=Task.Status.DONE)
        owner_completed_ids = FlowEvent.objects.filter(
            actor=user,
            to_status=Task.Status.CONFIRMING,
        ).values_list("task_id", flat=True)
        confirming_as_owner = queryset.filter(
            status=Task.Status.CONFIRMING,
            owner_completed_at__isnull=False,
            id__in=owner_completed_ids,
        )
        assignment_done = queryset.filter(assignments__assignee=user, assignments__status="done")
        return done_queryset | confirming_as_owner | assignment_done
    if scope == "cancelled":
        return queryset.filter(status=Task.Status.CANCELLED)
    if scope == "transferred":
        # 我转派的：actor 是当前用户，且 to_owner 不是当前用户（真正的转派，不包括自己认领）
        transferred_task_ids = FlowEvent.objects.filter(
            actor=user,
            event_type=FlowEvent.EventType.OWNER,
        ).exclude(
            to_owner=user
        ).exclude(
            to_status=Task.Status.CANCEL_PENDING
        ).exclude(
            note__icontains="拒绝取消"
        ).values_list("task_id", flat=True)
        return queryset.filter(id__in=transferred_task_ids).exclude(status__in=[Task.Status.DONE, Task.Status.CANCELLED])
    if scope == "future":
        return schedulable_queryset.filter(Q(due_at__date__gt=today) | Q(due_at__isnull=True))
    if scope in ["my_todo", "today_todo"]:
        active_today = user_owned_queryset.filter(due_at__date=today)
        confirming_for_user = queryset.filter(status=Task.Status.CONFIRMING, due_at__date=today).filter(
            Q(owner=user) | Q(confirmer=user) | Q(confirmer__isnull=True, creator=user)
        )
        # 待取消确认的任务：owner 是当前用户时需要处理
        cancel_pending_for_user = queryset.filter(status=Task.Status.CANCEL_PENDING, due_at__date=today, owner=user)
        return active_today | confirming_for_user | cancel_pending_for_user
    return queryset
