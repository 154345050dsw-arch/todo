from django.db.models import Q
from django.utils import timezone

from ..models import Task, TaskAssignment


ACTIVE_ASSIGNMENT_STATUSES = [TaskAssignment.Status.TODO, TaskAssignment.Status.IN_PROGRESS]
CURRENT_ASSIGNMENT_STATUSES = [
    TaskAssignment.Status.TODO,
    TaskAssignment.Status.IN_PROGRESS,
    TaskAssignment.Status.DONE,
]


def user_assignment_for(task, user, statuses=None):
    if not task or not user or not user.is_authenticated:
        return None
    queryset = task.assignments.filter(assignee=user)
    if statuses:
        queryset = queryset.filter(status__in=statuses)
    return queryset.order_by("-updated_at", "-id").first()


def current_assignment_for(task, user):
    return user_assignment_for(task, user, CURRENT_ASSIGNMENT_STATUSES)


def active_assignment_for(task, user):
    return user_assignment_for(task, user, ACTIVE_ASSIGNMENT_STATUSES)


def assignment_actionable_q(user):
    return Q(assignments__assignee=user, assignments__status__in=ACTIVE_ASSIGNMENT_STATUSES)


def sync_candidate_owners_from_assignments(task):
    assignee_ids = list(
        task.assignments.exclude(status=TaskAssignment.Status.CANCELLED)
        .values_list("assignee_id", flat=True)
        .distinct()
    )
    task.candidate_owners.set(assignee_ids)


def ensure_task_assignments(task):
    assignees = list(task.candidate_owners.all())
    if task.owner_id and all(user.id != task.owner_id for user in assignees):
        assignees.append(task.owner)
    for assignee in assignees:
        task.assignments.get_or_create(assignee=assignee, defaults={"status": TaskAssignment.Status.TODO})
    return task.assignments.all()


def create_task_assignments(task, assignees):
    assignments = []
    for assignee in assignees:
        assignment, _ = TaskAssignment.objects.get_or_create(
            task=task,
            assignee=assignee,
            defaults={"status": TaskAssignment.Status.TODO},
        )
        if assignment.status == TaskAssignment.Status.CANCELLED:
            assignment.status = TaskAssignment.Status.TODO
            assignment.started_at = None
            assignment.completed_at = None
            assignment.completion_note = ""
            assignment.save(update_fields=["status", "started_at", "completed_at", "completion_note", "updated_at"])
        assignments.append(assignment)
    sync_candidate_owners_from_assignments(task)
    return assignments


def start_assignment(task, user):
    existing_assignment = task.assignments.filter(assignee=user).first()
    if existing_assignment and existing_assignment.status == TaskAssignment.Status.CANCELLED:
        return None, "该责任人已被移出任务。"
    assignment = current_assignment_for(task, user)
    if not assignment and task.owner_id == user.id:
        assignment = TaskAssignment.objects.create(task=task, assignee=user, status=TaskAssignment.Status.TODO)
        sync_candidate_owners_from_assignments(task)
    if not assignment and task.candidate_owners.filter(id=user.id).exists():
        assignment = TaskAssignment.objects.create(task=task, assignee=user, status=TaskAssignment.Status.TODO)
        sync_candidate_owners_from_assignments(task)
    if not assignment:
        return None, "只有当前责任人可以开始处理。"
    if assignment.status == TaskAssignment.Status.DONE:
        return None, "该责任人已完成任务。"
    if assignment.status == TaskAssignment.Status.CANCELLED:
        return None, "该责任人已被移出任务。"
    if assignment.status == TaskAssignment.Status.IN_PROGRESS:
        return None, "任务已在处理中。"
    assignment.status = TaskAssignment.Status.IN_PROGRESS
    assignment.started_at = timezone.now()
    assignment.save(update_fields=["status", "started_at", "updated_at"])
    return assignment, None


def complete_assignment(task, user, completion_note):
    assignment = current_assignment_for(task, user)
    if not assignment and task.owner_id == user.id:
        assignment = TaskAssignment.objects.create(task=task, assignee=user, status=TaskAssignment.Status.IN_PROGRESS, started_at=timezone.now())
        sync_candidate_owners_from_assignments(task)
    if not assignment:
        return None, "只有当前责任人可以提交完成。"
    if assignment.status != TaskAssignment.Status.IN_PROGRESS:
        return None, "只有处理中的责任人可以提交完成。"
    assignment.status = TaskAssignment.Status.DONE
    assignment.completed_at = timezone.now()
    assignment.completion_note = completion_note
    assignment.save(update_fields=["status", "completed_at", "completion_note", "updated_at"])
    return assignment, None


def open_assignments(task):
    return task.assignments.filter(status__in=ACTIVE_ASSIGNMENT_STATUSES).select_related("assignee")


def next_open_assignment(task):
    return open_assignments(task).order_by("status", "created_at", "id").first()


def has_unfinished_assignments(task):
    return open_assignments(task).exists()


def status_from_open_assignments(task):
    if task.assignments.filter(status=TaskAssignment.Status.IN_PROGRESS).exists():
        return Task.Status.IN_PROGRESS
    if task.assignments.filter(status=TaskAssignment.Status.TODO).exists():
        return Task.Status.TODO
    return task.status


def cancel_active_assignments(task):
    task.assignments.filter(status__in=ACTIVE_ASSIGNMENT_STATUSES).update(status=TaskAssignment.Status.CANCELLED, updated_at=timezone.now())
    sync_candidate_owners_from_assignments(task)


def transfer_assignment(task, source_user, target_user):
    source_assignment = current_assignment_for(task, source_user) if source_user else None
    if source_assignment and source_assignment.assignee_id != target_user.id:
        source_assignment.status = TaskAssignment.Status.CANCELLED
        source_assignment.save(update_fields=["status", "updated_at"])

    target_assignment, _ = TaskAssignment.objects.get_or_create(
        task=task,
        assignee=target_user,
        defaults={"status": TaskAssignment.Status.TODO},
    )
    if target_assignment.status != TaskAssignment.Status.TODO:
        target_assignment.status = TaskAssignment.Status.TODO
        target_assignment.started_at = None
        target_assignment.completed_at = None
        target_assignment.completion_note = ""
        target_assignment.save(update_fields=["status", "started_at", "completed_at", "completion_note", "updated_at"])
    sync_candidate_owners_from_assignments(task)
    return target_assignment


def choose_transfer_source(task, actor):
    actor_assignment = active_assignment_for(task, actor)
    if actor_assignment:
        return actor
    if task.owner_id:
        return task.owner
    open_items = list(open_assignments(task))
    if len(open_items) == 1:
        return open_items[0].assignee
    return None


def reactivate_assignment(task, user):
    assignment, _ = TaskAssignment.objects.get_or_create(task=task, assignee=user)
    assignment.status = TaskAssignment.Status.TODO
    assignment.started_at = None
    assignment.completed_at = None
    assignment.completion_note = ""
    assignment.save(update_fields=["status", "started_at", "completed_at", "completion_note", "updated_at"])
    sync_candidate_owners_from_assignments(task)
    return assignment
