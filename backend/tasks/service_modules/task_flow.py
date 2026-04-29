from collections import defaultdict

from django.utils import timezone

from ..models import FlowEvent, Task


def create_flow_event(task, actor, event_type, note="", previous=None):
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
    if event.event_type == FlowEvent.EventType.REWORK:
        return "重办"
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
