from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Department, FlowEvent, Task, TaskComment, TaskNotification, TaskReminder
from .services import (
    can_perform_action, current_duration_hours, display_user, duration_analysis,
    event_label, get_user_roles, is_limited_candidate_view, processing_duration_hours,
    sanitize_rich_text, TaskAction
)


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    default_department = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "display_name", "default_department"]

    def get_display_name(self, obj):
        return display_user(obj)

    def get_default_department(self, obj):
        department = getattr(getattr(obj, "profile", None), "default_department", None)
        return DepartmentSerializer(department).data if department else None


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "code"]


class TaskListSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    creator = UserSerializer(read_only=True)
    candidate_owners = UserSerializer(read_only=True, many=True)
    confirmer = UserSerializer(read_only=True)
    department = DepartmentSerializer(read_only=True)
    participants = UserSerializer(read_only=True, many=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    current_duration_hours = serializers.SerializerMethodField()
    flow_count = serializers.SerializerMethodField()
    reminder_count = serializers.SerializerMethodField()
    latest_reminder_at = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(source="is_due_overdue", read_only=True)
    can_claim = serializers.SerializerMethodField()
    is_limited_view = serializers.SerializerMethodField()
    # 新增权限字段
    user_roles = serializers.SerializerMethodField()
    can_remind = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()
    can_transfer = serializers.SerializerMethodField()
    can_comment = serializers.SerializerMethodField()
    can_confirm_complete = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id",
            "code",
            "title",
            "description",
            "creator",
            "owner",
            "candidate_owners",
            "confirmer",
            "participants",
            "department",
            "status",
            "status_label",
            "priority",
            "priority_label",
            "due_at",
            "current_duration_hours",
            "flow_count",
            "reminder_count",
            "latest_reminder_at",
            "is_overdue",
            "can_claim",
            "is_limited_view",
            "user_roles",
            "can_remind",
            "can_cancel",
            "can_transfer",
            "can_comment",
            "can_confirm_complete",
            "created_at",
            "updated_at",
        ]

    def get_current_duration_hours(self, obj):
        return current_duration_hours(obj)

    def get_flow_count(self, obj):
        # 列表页用流转次数帮助用户快速判断任务复杂度；优先使用列表查询中的聚合值。
        return getattr(obj, "flow_events_count", None) or obj.events.count()

    def get_reminder_count(self, obj):
        return getattr(obj, "reminders_count", None) or obj.reminders.count()

    def get_latest_reminder_at(self, obj):
        latest = getattr(obj, "latest_reminder_at", None)
        if latest:
            return latest
        latest_reminder = obj.reminders.order_by("-created_at", "-id").first()
        return latest_reminder.created_at if latest_reminder else None

    def get_can_claim(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and obj.owner_id is None and obj.candidate_owners.filter(id=user.id).exists())

    def get_is_limited_view(self, obj):
        request = self.context.get("request")
        return is_limited_candidate_view(obj, getattr(request, "user", None))

    def get_user_roles(self, obj):
        """获取当前用户在任务中的角色"""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return list(get_user_roles(user, obj))

    def get_can_remind(self, obj):
        """是否可以催办"""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return can_perform_action(user, obj, TaskAction.REMIND)

    def get_can_cancel(self, obj):
        """是否可以取消（创建人直接取消或责任人申请取消）"""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        roles = get_user_roles(user, obj)
        # 创建人可以直接取消，责任人可以申请取消
        return "creator" in roles or "owner" in roles

    def get_can_transfer(self, obj):
        """是否可以转派"""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return can_perform_action(user, obj, TaskAction.TRANSFER)

    def get_can_comment(self, obj):
        """是否可以评论"""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return can_perform_action(user, obj, TaskAction.COMMENT)

    def get_can_confirm_complete(self, obj):
        """是否可以确认完成"""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return can_perform_action(user, obj, TaskAction.CONFIRM_COMPLETE)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["description"] = sanitize_rich_text(data.get("description", ""))
        if data.get("is_limited_view"):
            allowed = {"id", "code", "title", "status", "status_label", "can_claim", "is_limited_view", "created_at", "updated_at"}
            return {key: value for key, value in data.items() if key in allowed}
        return data


class FlowEventSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)
    from_owner = UserSerializer(read_only=True)
    to_owner = UserSerializer(read_only=True)
    from_department = DepartmentSerializer(read_only=True)
    to_department = DepartmentSerializer(read_only=True)
    label = serializers.SerializerMethodField()
    duration_until_next_hours = serializers.SerializerMethodField()

    class Meta:
        model = FlowEvent
        fields = [
            "id",
            "event_type",
            "label",
            "actor",
            "from_status",
            "to_status",
            "from_owner",
            "to_owner",
            "from_department",
            "to_department",
            "note",
            "duration_until_next_hours",
            "created_at",
        ]

    def get_label(self, obj):
        return event_label(obj)

    def get_duration_until_next_hours(self, obj):
        events = self.context.get("events", [])
        for index, event in enumerate(events):
            if event.id == obj.id:
                end = events[index + 1].created_at if index + 1 < len(events) else obj.task.completed_at
                break
        else:
            end = None
        if end is None:
            from django.utils import timezone

            end = timezone.now()
        return round(max((end - obj.created_at).total_seconds(), 0) / 3600, 1)


class TaskCommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = TaskComment
        fields = ["id", "author", "content", "created_at"]


class TaskReminderSerializer(serializers.ModelSerializer):
    from_user = UserSerializer(read_only=True)
    to_user = UserSerializer(read_only=True)
    remind_type_label = serializers.CharField(source="get_remind_type_display", read_only=True)

    class Meta:
        model = TaskReminder
        fields = ["id", "from_user", "to_user", "remind_type", "remind_type_label", "remark", "created_at"]


class TaskDetailSerializer(TaskListSerializer):
    events = serializers.SerializerMethodField()
    comments = TaskCommentSerializer(read_only=True, many=True)
    reminders = TaskReminderSerializer(read_only=True, many=True)
    duration_analysis = serializers.SerializerMethodField()
    processing_duration_hours = serializers.SerializerMethodField()
    cancel_reason = serializers.CharField(read_only=True)
    completion_note = serializers.CharField(read_only=True)

    class Meta(TaskListSerializer.Meta):
        fields = TaskListSerializer.Meta.fields + ["events", "comments", "reminders", "duration_analysis", "processing_duration_hours", "cancel_reason", "cancelled_at", "completion_note"]

    def get_events(self, obj):
        events = list(obj.events.select_related("actor", "from_owner", "to_owner", "from_department", "to_department"))
        return FlowEventSerializer(events, many=True, context={"events": events}).data

    def get_duration_analysis(self, obj):
        return duration_analysis(obj)

    def get_processing_duration_hours(self, obj):
        return processing_duration_hours(obj)


class TaskWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=160)
    description = serializers.CharField(required=False, allow_blank=True)
    owner_id = serializers.IntegerField(required=False)
    candidate_owner_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    confirmer_id = serializers.IntegerField(required=False, allow_null=True)
    participant_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    department_id = serializers.IntegerField(required=False)
    status = serializers.ChoiceField(choices=Task.Status.choices, required=False)
    priority = serializers.ChoiceField(choices=Task.Priority.choices, required=False)
    due_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        if self.context.get("require_candidates") and not attrs.get("candidate_owner_ids") and not attrs.get("owner_id"):
            raise serializers.ValidationError({"candidate_owner_ids": "请至少选择一位候选负责人。"})
        return attrs


class CommentCreateSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=1000)


class ReminderCreateSerializer(serializers.Serializer):
    remark = serializers.CharField(max_length=500, required=False, allow_blank=True)


class TaskActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=[
        "change_status", "transfer", "confirm_complete",
        "cancel", "apply_cancel", "confirm_cancel", "reject_cancel", "claim_task"
    ])
    status = serializers.ChoiceField(choices=Task.Status.choices, required=False)
    owner_id = serializers.IntegerField(required=False)
    department_id = serializers.IntegerField(required=False)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True)
    completion_note = serializers.CharField(required=False, allow_blank=True)


class TaskNotificationSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)
    task = serializers.SerializerMethodField()
    notification_type_label = serializers.CharField(source="get_notification_type_display", read_only=True)

    class Meta:
        model = TaskNotification
        fields = ["id", "title", "content", "actor", "task", "notification_type", "notification_type_label", "is_read", "created_at"]

    def get_task(self, obj):
        return {
            "id": obj.task_id,
            "code": obj.task.code,
            "title": obj.task.title,
            "status": obj.task.status,
            "status_label": obj.task.get_status_display(),
            "due_at": obj.task.due_at,
        }
