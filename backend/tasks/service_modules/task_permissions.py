from ..models import FlowEvent, Task


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


def get_user_roles(user, task):
    roles = set()
    if not user or not user.is_authenticated:
        return roles
    if task.creator_id == user.id:
        roles.add("creator")
    if task.owner_id == user.id:
        roles.add("owner")
    if task.confirmer_id == user.id:
        roles.add("confirmer")
    if task.participants.filter(id=user.id).exists():
        roles.add("participant")
    if FlowEvent.objects.filter(task=task, actor=user, event_type=FlowEvent.EventType.OWNER).exists():
        roles.add("transferrer")
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

    if "owner" in roles:
        return True

    if "creator" in roles:
        creator_allowed = [
            TaskAction.REMIND, TaskAction.CANCEL, TaskAction.TRANSFER,
            TaskAction.COMMENT, TaskAction.CONFIRM_CANCEL, TaskAction.REJECT_CANCEL,
        ]
        if action in creator_allowed:
            return True

    if action in [TaskAction.REMIND, TaskAction.COMMENT]:
        if "transferrer" in roles or "participant" in roles:
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
