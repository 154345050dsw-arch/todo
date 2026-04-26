from collections import defaultdict
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

from django.db.models import F, Q
from django.utils import timezone

from .models import Department, FlowEvent, Task, TaskNotification, TaskReminder, UserProfile, UserRole

import logging

logger = logging.getLogger(__name__)


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
}


ALLOWED_RICH_TEXT_TAGS = {"p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "img", "div"}
VOID_RICH_TEXT_TAGS = {"br", "img"}
BLOCKED_RICH_TEXT_TAGS = {"script", "style", "iframe", "object"}


class RichTextSanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.blocked_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in BLOCKED_RICH_TEXT_TAGS:
            self.blocked_depth += 1
            return
        if self.blocked_depth:
            return
        if tag not in ALLOWED_RICH_TEXT_TAGS:
            return
        safe_attrs = []
        attrs = dict(attrs)
        if tag == "a":
            href = attrs.get("href", "").strip()
            if href and urlparse(href).scheme in {"http", "https", "mailto"}:
                safe_attrs.append(("href", href))
                safe_attrs.append(("target", "_blank"))
                safe_attrs.append(("rel", "noopener noreferrer"))
        elif tag == "img":
            src = attrs.get("src", "").strip()
            if src.startswith("data:image/") and ";base64," in src[:40]:
                safe_attrs.append(("src", src))
                safe_attrs.append(("alt", attrs.get("alt", "")))
        attr_text = "".join(f' {name}="{escape(value, quote=True)}"' for name, value in safe_attrs)
        self.parts.append(f"<{tag}{attr_text}>")

    def handle_endtag(self, tag):
        if tag in BLOCKED_RICH_TEXT_TAGS and self.blocked_depth:
            self.blocked_depth -= 1
            return
        if self.blocked_depth:
            return
        if tag in ALLOWED_RICH_TEXT_TAGS and tag not in VOID_RICH_TEXT_TAGS:
            self.parts.append(f"</{tag}>")

    def handle_data(self, data):
        if self.blocked_depth:
            return
        self.parts.append(escape(data))

    def handle_entityref(self, name):
        if self.blocked_depth:
            return
        self.parts.append(f"&{name};")

    def handle_charref(self, name):
        if self.blocked_depth:
            return
        self.parts.append(f"&#{name};")


def sanitize_rich_text(value):
    value = value or ""
    if "<" not in value and ">" not in value:
        return escape(value).replace("\n", "<br>")
    parser = RichTextSanitizer()
    parser.feed(value)
    parser.close()
    return "".join(parser.parts)


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
    """所有任务接口都必须从这里开始，避免遗漏“只看相关任务”的限制。"""
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
    """不做复杂权限，但写操作限制在任务创建人、负责人、参与人、确认人。"""
    if not user or not user.is_authenticated:
        return False
    if task.creator_id == user.id or task.owner_id == user.id or task.confirmer_id == user.id:
        return True
    return task.participants.filter(id=user.id).exists()


class TaskAction:
    """任务操作类型常量"""
    REMIND = "remind"
    CANCEL = "cancel"
    APPLY_CANCEL = "apply_cancel"
    CONFIRM_CANCEL = "confirm_cancel"
    REJECT_CANCEL = "reject_cancel"
    TRANSFER = "transfer"
    COMMENT = "comment"
    CONFIRM_COMPLETE = "confirm_complete"
    CHANGE_STATUS = "change_status"


def get_user_roles(user, task):
    """
    获取用户在任务中的所有角色（返回集合）

    角色类型：
    - creator: 创建人
    - owner: 责任人
    - confirmer: 确认人
    - participant: 参与人
    - transferrer: 转派人（通过FlowEvent识别）
    """
    roles = set()
    if not user or not user.is_authenticated:
        return roles

    # 创建人
    if task.creator_id == user.id:
        roles.add("creator")

    # 责任人
    if task.owner_id == user.id:
        roles.add("owner")

    # 确认人
    if task.confirmer_id == user.id:
        roles.add("confirmer")

    # 参与人
    if task.participants.filter(id=user.id).exists():
        roles.add("participant")

    # 转派人：通过 FlowEvent 查询执行过负责人变更的用户（event_type='owner'）
    if FlowEvent.objects.filter(
        task=task,
        actor=user,
        event_type=FlowEvent.EventType.OWNER,
    ).exists():
        roles.add("transferrer")

    return roles


def can_perform_action(user, task, action):
    """
    判断用户是否可以执行指定操作（OR逻辑：只要有一个角色允许就允许）

    Args:
        user: 当前用户
        task: 任务对象
        action: 操作类型（TaskAction 常量）

    Returns:
        bool: 是否允许执行
    """
    roles = get_user_roles(user, task)

    # 终态任务限制：已完成或已取消的任务不允许大部分操作
    if task.status in [Task.Status.DONE, Task.Status.CANCELLED]:
        if action in [
            TaskAction.REMIND, TaskAction.CANCEL, TaskAction.TRANSFER,
            TaskAction.CONFIRM_COMPLETE, TaskAction.APPLY_CANCEL, TaskAction.CHANGE_STATUS
        ]:
            return False

    # 责任人拥有所有权限
    if "owner" in roles:
        return True

    # 创建人权限：催办/取消/转派/评论/确认取消/拒绝取消
    if "creator" in roles:
        creator_allowed = [
            TaskAction.REMIND, TaskAction.CANCEL, TaskAction.TRANSFER,
            TaskAction.COMMENT, TaskAction.CONFIRM_CANCEL, TaskAction.REJECT_CANCEL
        ]
        if action in creator_allowed:
            return True

    # 转派人/参与人权限：查看进度/评论/催办
    if action in [TaskAction.REMIND, TaskAction.COMMENT]:
        if "transferrer" in roles or "participant" in roles:
            return True

    # 确认人权限：与参与人相同 + 确认完成（仅待确认状态）
    if "confirmer" in roles:
        if action in [TaskAction.REMIND, TaskAction.COMMENT]:
            return True
        # 待确认状态下的确认完成权限
        if action == TaskAction.CONFIRM_COMPLETE and task.status == Task.Status.CONFIRMING:
            return True

    return False


def task_scope(queryset, user, scope):
    today = timezone.localdate()
    active_excluded_statuses = [
        Task.Status.CONFIRMING,
        Task.Status.DONE,
        Task.Status.CANCELLED,
        Task.Status.CANCEL_PENDING,
    ]
    active_queryset = queryset.exclude(status__in=active_excluded_statuses)
    schedulable_queryset = active_queryset.exclude(status=Task.Status.OVERDUE)
    user_owned_queryset = schedulable_queryset.filter(Q(owner=user) | Q(owner__isnull=True, candidate_owners=user))
    if scope == "all":
        return queryset
    if scope == "created":
        return active_queryset.filter(creator=user)
    if scope == "participated":
        return active_queryset.filter(participants=user)
    if scope == "confirming":
        return queryset.filter(status=Task.Status.CONFIRMING).filter(Q(confirmer=user) | Q(confirmer__isnull=True, creator=user))
    if scope == "cancel_pending":
        return queryset.filter(creator=user, status=Task.Status.CANCEL_PENDING)
    if scope == "overdue":
        return active_queryset.filter(Q(status=Task.Status.OVERDUE) | Q(due_at__date__lt=today))
    if scope == "done":
        return queryset.filter(status=Task.Status.DONE)
    if scope == "cancelled":
        return queryset.filter(status=Task.Status.CANCELLED)
    if scope == "transferred":
        # 我转派出去的任务：通过 FlowEvent 查询 event_type='owner' 表示负责人变更
        transferred_task_ids = FlowEvent.objects.filter(
            actor=user,
            event_type=FlowEvent.EventType.OWNER,
        ).values_list("task_id", flat=True)
        return queryset.filter(id__in=transferred_task_ids).exclude(status__in=[Task.Status.DONE, Task.Status.CANCELLED])
    if scope == "future":
        return schedulable_queryset.filter(Q(due_at__date__gt=today) | Q(due_at__isnull=True))
    if scope in ["my_todo", "today_todo"]:
        return user_owned_queryset.filter(due_at__date=today)
    return queryset


def create_flow_event(task, actor, event_type, note="", previous=None):
    """集中写入流转事件，保证时间线和耗时分析的数据来源一致。"""
    previous = previous or {}
    return FlowEvent.objects.create(
        task=task,
        actor=actor,
        event_type=event_type,
        from_status=previous.get("status", ""),
        to_status=task.status,
        from_owner=previous.get("owner"),
        to_owner=task.owner,
        from_department=previous.get("department"),
        to_department=task.department,
        note=note,
    )


def display_user(user):
    if not user:
        return ""
    return user.first_name or user.username


def event_label(event):
    if event.event_type == FlowEvent.EventType.REMIND:
        return "催办"
    if event.event_type == FlowEvent.EventType.CREATED:
        return "创建"
    if event.from_status and event.from_status != event.to_status:
        return dict(Task.Status.choices).get(event.to_status, event.to_status)
    if event.from_owner_id and event.from_owner_id != event.to_owner_id:
        return "转派"
    if event.from_department_id and event.from_department_id != event.to_department_id:
        return "部门变更"
    return event.get_event_type_display()


def current_duration_hours(task):
    last_event = task.events.exclude(event_type=FlowEvent.EventType.REMIND).order_by("-created_at", "-id").first()
    start = last_event.created_at if last_event else task.created_at
    end = task.completed_at or timezone.now()
    return round(max((end - start).total_seconds(), 0) / 3600, 1)


def format_duration_text(delta):
    minutes = max(int(delta.total_seconds() // 60), 0)
    if minutes < 1:
        return "少于1分钟"
    if minutes < 60:
        return f"{minutes}分钟"
    hours = minutes // 60
    rest = minutes % 60
    if hours < 24:
        return f"{hours}小时{rest}分钟" if rest else f"{hours}小时"
    days = hours // 24
    day_hours = hours % 24
    return f"{days}天{day_hours}小时" if day_hours else f"{days}天"


def reminder_type_for_task(task):
    if task.status == Task.Status.CONFIRMING:
        return TaskReminder.RemindType.CONFIRM
    if task.status == Task.Status.CANCEL_PENDING:
        return TaskReminder.RemindType.CANCEL_CONFIRM
    return TaskReminder.RemindType.PROCESS


def current_reminder_target(task):
    """返回催办目标用户列表，支持多人催办"""
    if task.status in [Task.Status.DONE, Task.Status.CANCELLED]:
        return []
    if task.status == Task.Status.CONFIRMING:
        return [task.confirmer or task.creator]
    if task.status == Task.Status.CANCEL_PENDING:
        return [task.creator]
    if task.owner_id:
        return [task.owner]
    # 多候选负责人：通知所有候选人
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
    return notification


def create_task_notification(notification_type, task, actor, receiver=None, extra=None, force_notify_self=False):
    """
    统一通知创建函数

    Args:
        notification_type: 通知类型（TaskNotification.NotificationType）
        task: 任务对象
        actor: 触发动作的用户
        receiver: 接收者（可选，默认根据类型自动确定）
        extra: 扩展信息字典，可包含 from_user, to_user, deadline_text, timeout_text 等
        force_notify_self: 是否允许通知自己（默认 False）

    Returns:
        TaskNotification 对象或 None（跳过时）
    """
    extra = extra or {}

    # 1. 自动确定接收者
    if receiver is None:
        if notification_type == TaskNotification.NotificationType.TASK_COMPLETED:
            receiver = task.confirmer or task.creator
        elif notification_type == TaskNotification.NotificationType.TASK_CANCEL_REQUESTED:
            receiver = task.creator
        elif notification_type == TaskNotification.NotificationType.TASK_TRANSFERRED:
            receiver = task.owner
        elif notification_type == TaskNotification.NotificationType.TASK_REMIND:
            # 催办通知需要明确指定接收者
            return None
        else:
            receiver = task.creator

    # 2. 检查是否跳过自通知
    if not force_notify_self and receiver and actor and receiver.id == actor.id:
        return None

    # 3. 获取通知配置
    config = NOTIFICATION_CONFIGS.get(notification_type)
    if not config:
        logger.warning(f"Unknown notification type: {notification_type}")
        return None

    # 4. 生成通知文案
    actor_name = display_user(actor)
    task_title = task.title

    content = config["content_template"].format(
        actor=actor_name,
        task_title=task_title,
        **extra
    )

    helper = config["helper_template"].format(
        deadline=extra.get("deadline_text") or notification_due_text(task),
        timeout_text=extra.get("timeout_text") or "",
        **extra
    )

    full_content = f"{content}\n{helper}"

    # 5. 写入通知表（失败不影响主业务）
    try:
        notification = TaskNotification.objects.create(
            recipient=receiver,
            actor=actor,
            task=task,
            notification_type=notification_type,
            title=config["title"],
            content=full_content,
        )
        return notification
    except Exception as e:
        logger.error(f"Failed to create notification: {e}")
        return None


def create_task_reminder(task, from_user, remark=""):
    """创建催办，支持多人催办，前置检查自我催办和频率限制"""
    if task.status in [Task.Status.DONE, Task.Status.CANCELLED]:
        return None, {"detail": "已完成或已取消任务不允许催办。", "status": 400}

    # 1. 获取所有催办目标
    to_users = current_reminder_target(task)
    if not to_users:
        return None, {"detail": "当前任务暂无明确处理人，无法催办。", "status": 400}

    # 2. 前置检查：过滤掉自我催办的目标
    valid_targets = [u for u in to_users if u.id != from_user.id]
    if not valid_targets:
        return None, {"detail": "不能催办自己。", "status": 400}

    # 3. 前置检查：频率限制（30分钟内）
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
        # 所有目标都在30分钟内已催办
        latest_time = max(blocked_users, key=lambda x: x[1])[1]
        local_time = timezone.localtime(latest_time).strftime("%H:%M")
        return None, {"detail": f"已在 {local_time} 催办过，请稍后再试。", "status": 429, "last_reminded_at": latest_time}

    # 4. 为每个有效目标创建催办记录和通知
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

    # 返回第一个 reminder（兼容旧接口）
    return reminders[0], None


def processing_duration_hours(task):
    first_processing_event = (
        task.events.filter(to_status=Task.Status.IN_PROGRESS)
        .exclude(from_status=Task.Status.IN_PROGRESS)
        .order_by("created_at", "id")
        .first()
    )
    if not first_processing_event:
        return None
    end = task.completed_at or task.cancelled_at or timezone.now()
    return round(max((end - first_processing_event.created_at).total_seconds(), 0) / 3600, 1)


def duration_analysis(task):
    """按事件切片聚合负责人、部门、状态停留时间。"""
    events = list(task.events.select_related("to_owner", "to_department").order_by("created_at", "id"))
    if not events:
        return {"owner": [], "department": [], "status": []}

    owner_hours = defaultdict(float)
    department_hours = defaultdict(float)
    status_hours = defaultdict(float)
    now = task.completed_at or timezone.now()
    status_labels = dict(Task.Status.choices)

    for index, event in enumerate(events):
        next_at = events[index + 1].created_at if index + 1 < len(events) else now
        hours = max((next_at - event.created_at).total_seconds(), 0) / 3600
        if event.to_owner:
            owner_hours[display_user(event.to_owner)] += hours
        if event.to_department:
            department_hours[event.to_department.name] += hours
        if event.to_status:
            status_hours[status_labels.get(event.to_status, event.to_status)] += hours

    def pack(mapping):
        total = sum(mapping.values()) or 1
        return [
            {"label": label, "hours": round(hours, 1), "percent": round(hours / total * 100)}
            for label, hours in sorted(mapping.items(), key=lambda item: item[1], reverse=True)
        ]

    return {"owner": pack(owner_hours), "department": pack(department_hours), "status": pack(status_hours)}


# ============================================================================
# 权限服务方法
# ============================================================================


def is_super_admin(user):
    """判断用户是否超级管理员"""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    try:
        profile = user.profile
        return profile.role == UserRole.SUPER_ADMIN
    except UserProfile.DoesNotExist:
        return False


def is_department_manager(user):
    """判断用户是否部门负责人"""
    if not user or not user.is_authenticated:
        return False
    try:
        profile = user.profile
        return profile.role == UserRole.DEPARTMENT_MANAGER
    except UserProfile.DoesNotExist:
        return False


def is_user_active(user):
    """判断用户是否启用状态"""
    if not user:
        return False
    try:
        profile = user.profile
        return profile.is_active
    except UserProfile.DoesNotExist:
        return False


def get_managed_department_ids(user):
    """
    获取用户管理的部门ID列表（包含下级部门）

    超管：返回所有启用部门
    部门负责人：返回直接管理的部门及其所有下级部门
    普通成员：返回空列表
    """
    if is_super_admin(user):
        return list(Department.objects.filter(is_active=True).values_list('id', flat=True))

    if is_department_manager(user):
        managed_ids = set()
        # 直接管理的部门
        direct_managed = user.managed_departments.filter(is_active=True).values_list('id', flat=True)
        managed_ids.update(direct_managed)
        # 下级部门
        for dept_id in direct_managed:
            try:
                dept = Department.objects.get(id=dept_id)
                descendants = dept.get_descendants()
                managed_ids.update([d.id for d in descendants])
            except Department.DoesNotExist:
                continue
        return list(managed_ids)

    return []


def get_department_descendant_ids(dept_id):
    """获取部门及其所有下级部门的ID列表"""
    try:
        dept = Department.objects.get(id=dept_id, is_active=True)
        ids = [dept.id]
        descendants = dept.get_descendants()
        ids.extend([d.id for d in descendants])
        return ids
    except Department.DoesNotExist:
        return []


def can_manage_department(user, dept):
    """
    判断用户是否可以管理某个部门

    超管：可以管理所有启用部门
    部门负责人：可以管理自己负责部门及下级部门
    """
    if not dept or not dept.is_active:
        return False
    if is_super_admin(user):
        return True
    if is_department_manager(user):
        managed_ids = get_managed_department_ids(user)
        return dept.id in managed_ids
    return False


def can_manage_user(user, target_user):
    """
    判断用户是否可以管理另一个用户

    超管：可以管理所有人（除其他超管）
    部门负责人：可以管理自己部门及下级部门的普通成员
    """
    if not target_user:
        return False
    try:
        target_profile = target_user.profile
    except UserProfile.DoesNotExist:
        return False

    if not target_profile.is_active:
        return False

    # 超管可以管理所有人（除其他超管）
    if is_super_admin(user):
        if is_super_admin(target_user):
            return False  # 不能管理其他超管
        return True

    # 部门负责人可以管理自己部门及下级部门的普通成员
    if is_department_manager(user):
        # 不能管理其他部门负责人或超管
        if target_profile.role in [UserRole.SUPER_ADMIN, UserRole.DEPARTMENT_MANAGER]:
            return False
        managed_ids = get_managed_department_ids(user)
        target_dept = target_profile.default_department
        if target_dept and target_dept.id in managed_ids:
            return True

    return False


def get_available_data_scopes(user):
    """
    获取用户可用的数据范围选项

    返回列表，如 ['related'], ['related', 'my_department', 'my_department_tree'] 等
    """
    scopes = ['related']  # 所有用户都有"仅我相关"
    if is_department_manager(user) or is_super_admin(user):
        scopes.append('my_department')
        scopes.append('my_department_tree')
    if is_super_admin(user):
        scopes.append('all_departments')
        scopes.append('selected_departments')
    return scopes


def can_view_data_scope(user, scope):
    """判断用户是否可以使用某个数据范围"""
    available = get_available_data_scopes(user)
    return scope in available


def get_tasks_for_scope(user, scope, extra_params=None):
    """
    根据数据范围获取任务 QuerySet

    scope 选项：
    - 'related': 仅我相关（使用 visible_tasks_for）
    - 'my_department': 本部门（用户所在部门）
    - 'my_department_tree': 本部门及下级
    - 'all_departments': 全部部门（仅超管）
    - 'selected_departments': 选中部门（仅超管）
    """
    extra_params = extra_params or {}

    if scope == 'related':
        return visible_tasks_for(user)

    if scope == 'my_department':
        try:
            profile = user.profile
            if not profile.default_department:
                return Task.objects.none()
            return Task.objects.filter(department=profile.default_department)
        except UserProfile.DoesNotExist:
            return Task.objects.none()

    if scope == 'my_department_tree':
        managed_ids = get_managed_department_ids(user)
        if not managed_ids:
            return Task.objects.none()
        return Task.objects.filter(department_id__in=managed_ids)

    if scope == 'all_departments':
        if not is_super_admin(user):
            return Task.objects.none()
        return Task.objects.all()

    if scope == 'selected_departments':
        if not is_super_admin(user):
            return Task.objects.none()
        dept_ids = extra_params.get('department_ids', [])
        if not dept_ids:
            return Task.objects.none()
        return Task.objects.filter(department_id__in=dept_ids)

    return visible_tasks_for(user)
