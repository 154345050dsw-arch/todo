from collections import defaultdict
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

from django.db.models import F, Q
from django.utils import timezone

from .models import FlowEvent, Task, UserProfile


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


def task_scope(queryset, user, scope):
    now = timezone.now()
    if scope == "all":
        return queryset
    if scope == "created":
        return queryset.filter(creator=user).exclude(
            status__in=[Task.Status.DONE, Task.Status.CANCELLED, Task.Status.CANCEL_PENDING]
        )
    if scope == "participated":
        return queryset.filter(participants=user).exclude(
            status__in=[Task.Status.DONE, Task.Status.CANCELLED, Task.Status.CANCEL_PENDING]
        )
    if scope == "confirming":
        return queryset.filter(status=Task.Status.CONFIRMING).filter(Q(confirmer=user) | Q(owner=user))
    if scope == "cancel_pending":
        return queryset.filter(creator=user, status=Task.Status.CANCEL_PENDING)
    if scope == "overdue":
        return queryset.filter(Q(status=Task.Status.OVERDUE) | Q(due_at__lt=now)).exclude(
            status__in=[Task.Status.DONE, Task.Status.CANCELLED, Task.Status.CANCEL_PENDING]
        )
    if scope == "done":
        return queryset.filter(status=Task.Status.DONE)
    if scope == "cancelled":
        return queryset.filter(status=Task.Status.CANCELLED)
    if scope == "transferred":
        # 我转派出去的任务：通过 FlowEvent 查询 actor=user 且有转派行为（from_owner != to_owner）
        transferred_task_ids = FlowEvent.objects.filter(
            actor=user,
            from_owner__isnull=False,
            to_owner__isnull=False,
        ).exclude(from_owner=F("to_owner")).values_list("task_id", flat=True)
        return queryset.filter(id__in=transferred_task_ids).exclude(
            status__in=[Task.Status.DONE, Task.Status.CANCELLED]
        )
    if scope == "my_todo":
        return queryset.filter(Q(owner=user) | Q(owner__isnull=True, candidate_owners=user)).exclude(
            status__in=[Task.Status.DONE, Task.Status.CANCELLED, Task.Status.CANCEL_PENDING]
        )
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
    last_event = task.events.order_by("-created_at", "-id").first()
    start = last_event.created_at if last_event else task.created_at
    end = task.completed_at or timezone.now()
    return round(max((end - start).total_seconds(), 0) / 3600, 1)


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
