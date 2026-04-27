from django.db.models import Q
from django.utils import timezone

from ..models import FlowEvent, Task, UserProfile


def user_default_department(user):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile.default_department


def is_limited_candidate_view(task, user):
    if not task or not user or not user.is_authenticated:
        return False
    if task.owner_id is not None or task.creator_id == user.id:
        return False
    return task.candidate_owners.filter(id=user.id).exists()


def visible_tasks_for(user):
    if not user or not user.is_authenticated:
        return Task.objects.none()
    return (
        Task.objects.filter(
            Q(creator=user)
            | Q(owner=user)
            | Q(owner__isnull=True, candidate_owners=user)
            | Q(confirmer=user)
            | Q(participants=user)
            | Q(comments__author=user)
            | Q(events__actor=user)
            | Q(reminders__from_user=user)
            | Q(reminders__to_user=user)
        )
        .select_related("creator", "owner", "confirmer", "department")
        .prefetch_related("participants", "candidate_owners")
        .distinct()
    )


def writable_task_for(user, task):
    if not user or not user.is_authenticated:
        return False
    if task.creator_id == user.id or task.owner_id == user.id or task.confirmer_id == user.id:
        return True
    return task.participants.filter(id=user.id).exists()


def task_scope(queryset, user, scope):
    today = timezone.localdate()
    active_excluded_statuses = [Task.Status.DONE, Task.Status.CANCELLED]
    active_for_owner = queryset.exclude(status__in=[Task.Status.CONFIRMING, Task.Status.DONE, Task.Status.CANCELLED, Task.Status.CANCEL_PENDING])
    active_for_creator = queryset.exclude(status__in=active_excluded_statuses).exclude(
        status=Task.Status.CONFIRMING,
        confirmer__isnull=True,
        creator=user,
    )

    schedulable_queryset = active_for_owner.exclude(status=Task.Status.OVERDUE)
    user_owned_queryset = schedulable_queryset.filter(Q(owner=user) | Q(owner__isnull=True, candidate_owners=user))

    if scope == "all":
        return queryset
    if scope == "created":
        return active_for_creator.filter(creator=user)
    if scope == "participated":
        return active_for_owner.filter(participants=user)
    if scope == "confirming":
        return queryset.filter(status=Task.Status.CONFIRMING).filter(Q(confirmer=user) | Q(confirmer__isnull=True, creator=user))
    if scope == "cancel_pending":
        return queryset.filter(creator=user, status=Task.Status.CANCEL_PENDING)
    if scope == "overdue":
        return active_for_owner.filter(Q(status=Task.Status.OVERDUE) | Q(due_at__date__lt=today))
    if scope == "done":
        done_queryset = queryset.filter(status=Task.Status.DONE)
        owner_completed_ids = FlowEvent.objects.filter(
            actor=user,
            event_type=FlowEvent.EventType.OWNER,
        ).values_list("task_id", flat=True)
        confirming_as_owner = queryset.filter(
            status=Task.Status.CONFIRMING,
            owner_completed_at__isnull=False,
            id__in=owner_completed_ids,
        )
        return done_queryset | confirming_as_owner
    if scope == "cancelled":
        return queryset.filter(status=Task.Status.CANCELLED)
    if scope == "transferred":
        transferred_task_ids = FlowEvent.objects.filter(
            actor=user,
            event_type=FlowEvent.EventType.OWNER,
        ).values_list("task_id", flat=True)
        return queryset.filter(id__in=transferred_task_ids).exclude(status__in=[Task.Status.DONE, Task.Status.CANCELLED])
    if scope == "future":
        return schedulable_queryset.filter(Q(due_at__date__gt=today) | Q(due_at__isnull=True))
    if scope in ["my_todo", "today_todo"]:
        active_today = user_owned_queryset.filter(due_at__date=today)
        confirming_for_user = queryset.filter(status=Task.Status.CONFIRMING, due_at__date=today).filter(
            Q(owner=user) | Q(confirmer=user) | Q(confirmer__isnull=True, creator=user)
        )
        return active_today | confirming_for_user
    return queryset
