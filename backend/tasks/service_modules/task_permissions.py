from ..models import FlowEvent, Task, TaskAssignment
from .organization_permissions import get_managed_department_ids, is_department_manager, is_super_admin


class TaskAction:
    REMIND = "remind"
    CANCEL = "cancel"
    APPLY_CANCEL = "apply_cancel"
    CONFIRM_CANCEL = "confirm_cancel"
    REJECT_CANCEL = "reject_cancel"
    TRANSFER = "transfer"
    COMMENT = "comment"
    CONFIRM_COMPLETE = "confirm_complete"
    CHANGE_STATUS = "change_status"
    REWORK = "rework"


def can_manage_task_by_scope(user, task):
    if not user or not user.is_authenticated or not task:
        return False
    if is_super_admin(user):
        return True
    if not is_department_manager(user):
        return False
    managed_ids = set(get_managed_department_ids(user))
    if not managed_ids:
        return False
    if task.department_id in managed_ids:
        return True
    related_users = [task.creator, task.owner, task.confirmer]
    related_users.extend([assignment.assignee for assignment in task.assignments.select_related("assignee").all()])
    related_users.extend(list(task.candidate_owners.all()))
    related_users.extend(list(task.participants.all()))
    for related_user in related_users:
        department_id = getattr(getattr(related_user, "profile", None), "default_department_id", None)
        if department_id in managed_ids:
            return True
    return False


def get_user_roles(user, task):
    roles = set()
    if not user or not user.is_authenticated:
        return roles
    if task.creator_id == user.id:
        roles.add("creator")
    if task.owner_id == user.id:
        roles.add("owner")
    assignment = task.assignments.filter(assignee=user).exclude(status=TaskAssignment.Status.CANCELLED).first()
    if assignment:
        roles.add("assignee")
        if assignment.status == TaskAssignment.Status.TODO:
            roles.add("assignment_todo")
        elif assignment.status == TaskAssignment.Status.IN_PROGRESS:
            roles.add("assignment_in_progress")
        elif assignment.status == TaskAssignment.Status.DONE:
            roles.add("assignment_done")
    if task.confirmer_id == user.id:
        roles.add("confirmer")
    if task.participants.filter(id=user.id).exists():
        roles.add("participant")
    if FlowEvent.objects.filter(task=task, actor=user, event_type=FlowEvent.EventType.OWNER).exists():
        roles.add("transferrer")
    if can_manage_task_by_scope(user, task):
        roles.add("task_admin")
    return roles


def can_perform_action(user, task, action):
    roles = get_user_roles(user, task)
    if task.status in [Task.Status.DONE, Task.Status.CANCELLED]:
        if action in [
            TaskAction.REMIND, TaskAction.CANCEL, TaskAction.TRANSFER,
            TaskAction.CONFIRM_COMPLETE, TaskAction.APPLY_CANCEL, TaskAction.CHANGE_STATUS,
            TaskAction.REWORK,
        ]:
            return False

    if "task_admin" in roles:
        admin_allowed = [
            TaskAction.REMIND, TaskAction.CANCEL, TaskAction.TRANSFER,
            TaskAction.COMMENT,
        ]
        if action in admin_allowed:
            return True

    if "owner" in roles:
        return True

    if "assignment_in_progress" in roles:
        assignment_allowed = [
            TaskAction.REMIND, TaskAction.CANCEL, TaskAction.TRANSFER,
            TaskAction.COMMENT, TaskAction.CONFIRM_COMPLETE,
        ]
        if action in assignment_allowed:
            return True

    if "creator" in roles:
        creator_allowed = [
            TaskAction.REMIND, TaskAction.CANCEL, TaskAction.TRANSFER,
            TaskAction.COMMENT, TaskAction.CONFIRM_CANCEL, TaskAction.REJECT_CANCEL,
        ]
        if action in creator_allowed:
            return True

    if action in [TaskAction.REMIND, TaskAction.COMMENT]:
        if "transferrer" in roles or "participant" in roles or "assignment_done" in roles:
            return True

    if "confirmer" in roles:
        if action in [TaskAction.REMIND, TaskAction.COMMENT]:
            return True
        if action == TaskAction.CONFIRM_COMPLETE and task.status == Task.Status.CONFIRMING:
            return True
        if action == TaskAction.REWORK and task.status == Task.Status.CONFIRMING:
            return True

    # creator 在 confirming 状态下也可以重办
    if action == TaskAction.REWORK and task.status == Task.Status.CONFIRMING and "creator" in roles:
        return True

    return False
