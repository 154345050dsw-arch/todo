import json
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from ..models import FlowEvent, Task, TaskNotification, TaskReminder
from .task_flow import create_flow_event, display_user, format_duration_text

logger = logging.getLogger(__name__)


def push_notification_to_user(notification):
    """通过 WebSocket 实时推送通知给用户"""
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            logger.warning("Channel layer is not configured")
            return
        # 延迟导入避免循环依赖
        from ..serializers import TaskNotificationSerializer
        group_name = f"notifications_{notification.recipient.id}"
        serializer = TaskNotificationSerializer(notification)
        # 序列化为 JSON 字符串再解析，确保 datetime 被正确转换
        data = json.loads(json.dumps(serializer.data, default=str))
        logger.info(f"Pushing notification to group: {group_name}")
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "notification_message",
                "data": data,
            },
        )
        logger.info(f"Notification pushed successfully: {notification.id}")
    except Exception as exc:
        # Redis 不可用时静默失败，不影响通知创建
        logger.warning("Failed to push notification via WebSocket: %s", exc)

NOTIFICATION_CONFIGS = {
    TaskNotification.NotificationType.TASK_CREATED: {
        "title": "新任务",
        "content_template": "{actor} 创建了任务：{task_title}",
        "helper_template": "截止时间：{deadline}",
    },
    TaskNotification.NotificationType.TASK_REMIND: {
        "title": "任务催办",
        "content_template": "{actor} 催办你处理任务：{task_title}",
        "helper_template": "截止时间：{deadline}",
    },
    TaskNotification.NotificationType.TASK_COMPLETED: {
        "title": "任务已完成",
        "content_template": "{actor} 已完成任务：{task_title}",
        "helper_template": "等待你确认完成",
    },
    TaskNotification.NotificationType.TASK_CANCEL_REQUESTED: {
        "title": "任务取消申请",
        "content_template": "{actor} 申请取消任务：{task_title}",
        "helper_template": "等待你确认取消",
    },
    TaskNotification.NotificationType.TASK_TRANSFERRED: {
        "title": "新任务流转",
        "content_template": "{actor} 将任务流转给你：{task_title}",
        "helper_template": "请及时处理",
    },
    TaskNotification.NotificationType.COMPLETE_CONFIRM: {
        "title": "待完成确认",
        "content_template": "{actor} 提醒你确认任务：{task_title}",
        "helper_template": "点击查看详情",
    },
    TaskNotification.NotificationType.CANCEL_CONFIRM: {
        "title": "待取消确认",
        "content_template": "{actor} 提醒你确认取消：{task_title}",
        "helper_template": "点击查看详情",
    },
    TaskNotification.NotificationType.TASK_TIMEOUT: {
        "title": "任务超时",
        "content_template": "任务已超时：{task_title}",
        "helper_template": "已超时：{timeout_text}",
    },
    TaskNotification.NotificationType.TASK_REWORKED: {
        "title": "任务重办",
        "content_template": "{actor} 将任务退回重办：{task_title}",
        "helper_template": "请重新处理",
    },
}


def reminder_type_for_task(task):
    if task.status == Task.Status.CONFIRMING:
        return TaskReminder.RemindType.CONFIRM
    if task.status == Task.Status.CANCEL_PENDING:
        return TaskReminder.RemindType.CANCEL_CONFIRM
    return TaskReminder.RemindType.PROCESS


def current_reminder_target(task):
    if task.status in [Task.Status.DONE, Task.Status.CANCELLED]:
        return []
    if task.status == Task.Status.CONFIRMING:
        return [task.confirmer or task.creator]
    if task.status == Task.Status.CANCEL_PENDING:
        return [task.creator]
    if task.owner_id:
        return [task.owner]
    return list(task.candidate_owners.all())


def reminder_action_text(reminder):
    from_name = display_user(reminder.from_user)
    to_name = display_user(reminder.to_user)
    if reminder.remind_type == TaskReminder.RemindType.CONFIRM:
        return f"{from_name}催办{to_name}确认任务"
    if reminder.remind_type == TaskReminder.RemindType.CANCEL_CONFIRM:
        return f"{from_name}催办{to_name}确认取消"
    return f"{from_name}催办{to_name}处理任务"


def notification_due_text(task):
    if not task.due_at:
        return "截止时间：未设置"
    now = timezone.now()
    if task.due_at < now and task.status not in [Task.Status.DONE, Task.Status.CANCELLED]:
        return f"该任务已超时 {format_duration_text(now - task.due_at)}"
    local_due = timezone.localtime(task.due_at)
    local_date = local_due.date()
    today = timezone.localdate()
    time_text = local_due.strftime("%H:%M")
    if local_date == today:
        return f"截止时间：今日 {time_text}"
    if local_date == today + timezone.timedelta(days=1):
        return f"截止时间：明日 {time_text}"
    return f"截止时间：{local_due.strftime('%m-%d %H:%M')}"


def notification_action_text(remind_type):
    if remind_type == TaskReminder.RemindType.CONFIRM:
        return "确认任务"
    if remind_type == TaskReminder.RemindType.CANCEL_CONFIRM:
        return "确认取消"
    return "处理任务"


def create_reminder_notification(reminder):
    content = (
        f"{display_user(reminder.from_user)}催办你{notification_action_text(reminder.remind_type)}：{reminder.task.title}\n"
        f"{notification_due_text(reminder.task)}"
    )
    notification = TaskNotification.objects.create(
        recipient=reminder.to_user,
        actor=reminder.from_user,
        task=reminder.task,
        notification_type=TaskNotification.NotificationType.TASK_REMIND,
        title="任务催办",
        content=content,
    )
    push_notification_to_user(notification)
    return notification


def create_task_notification(notification_type, task, actor, receiver=None, extra=None, force_notify_self=False):
    extra = extra or {}

    if receiver is None:
        if notification_type == TaskNotification.NotificationType.TASK_COMPLETED:
            receiver = task.confirmer or task.creator
        elif notification_type == TaskNotification.NotificationType.TASK_CANCEL_REQUESTED:
            receiver = task.creator
        elif notification_type == TaskNotification.NotificationType.TASK_TRANSFERRED:
            receiver = task.owner
        elif notification_type == TaskNotification.NotificationType.TASK_REMIND:
            return None
        else:
            receiver = task.creator

    if not force_notify_self and receiver and actor and receiver.id == actor.id:
        return None

    config = NOTIFICATION_CONFIGS.get(notification_type)
    if not config:
        logger.warning("Unknown notification type: %s", notification_type)
        return None

    content = config["content_template"].format(
        actor=display_user(actor),
        task_title=task.title,
        **extra,
    )
    helper = config["helper_template"].format(
        deadline=extra.get("deadline_text") or notification_due_text(task),
        timeout_text=extra.get("timeout_text") or "",
        **extra,
    )
    full_content = f"{content}\n{helper}"

    try:
        notification = TaskNotification.objects.create(
            recipient=receiver,
            actor=actor,
            task=task,
            notification_type=notification_type,
            title=config["title"],
            content=full_content,
        )
        push_notification_to_user(notification)
        return notification
    except Exception as exc:
        logger.error("Failed to create notification: %s", exc)
        return None


def create_task_reminder(task, from_user, remark=""):
    if task.status in [Task.Status.DONE, Task.Status.CANCELLED]:
        return None, {"detail": "已完成或已取消任务不允许催办。", "status": 400}

    to_users = current_reminder_target(task)
    if not to_users:
        return None, {"detail": "当前任务暂无明确处理人，无法催办。", "status": 400}

    valid_targets = [u for u in to_users if u.id != from_user.id]
    if not valid_targets:
        return None, {"detail": "不能催办自己。", "status": 400}

    now = timezone.now()
    window_start = now - timezone.timedelta(minutes=30)
    reminded_users = []
    blocked_users = []
    for to_user in valid_targets:
        latest = (
            TaskReminder.objects.filter(task=task, to_user=to_user, created_at__gte=window_start)
            .order_by("-created_at", "-id")
            .first()
        )
        if latest:
            blocked_users.append((to_user, latest.created_at))
        else:
            reminded_users.append(to_user)

    if not reminded_users:
        latest_time = max(blocked_users, key=lambda x: x[1])[1]
        local_time = timezone.localtime(latest_time).strftime("%H:%M")
        return None, {"detail": f"已在 {local_time} 催办过，请稍后再试。", "status": 429, "last_reminded_at": latest_time}

    remind_type = reminder_type_for_task(task)
    remark_text = (remark or "请尽快处理该任务").strip()[:500]
    reminders = []
    for to_user in reminded_users:
        reminder = TaskReminder.objects.create(
            task=task,
            from_user=from_user,
            to_user=to_user,
            remind_type=remind_type,
            remark=remark_text,
            created_at=now,
        )
        create_flow_event(task, from_user, FlowEvent.EventType.REMIND, note=reminder_action_text(reminder))
        create_reminder_notification(reminder)
        reminders.append(reminder)

    return reminders[0], None
