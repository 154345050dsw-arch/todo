from rest_framework import serializers

from ..models import Task, TaskAssignment
from ..services import (
    can_perform_action,
    current_assignment_for,
    current_duration_hours,
    duration_analysis,
    get_user_roles,
    is_limited_candidate_view,
    processing_duration_hours,
    sanitize_rich_text,
    TaskAction,
)
from .common_serializers import DepartmentSerializer, UserSerializer
from .flow_serializers import FlowEventSerializer, TaskCommentSerializer, TaskReminderSerializer


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
    processing_duration_hours = serializers.SerializerMethodField()
    flow_count = serializers.SerializerMethodField()
    reminder_count = serializers.SerializerMethodField()
    latest_reminder_at = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(source="is_due_overdue", read_only=True)
    can_claim = serializers.SerializerMethodField()
    is_limited_view = serializers.SerializerMethodField()
    user_roles = serializers.SerializerMethodField()
    can_remind = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()
    can_transfer = serializers.SerializerMethodField()
    can_comment = serializers.SerializerMethodField()
    can_confirm_complete = serializers.SerializerMethodField()
    can_rework = serializers.SerializerMethodField()
    assignments = serializers.SerializerMethodField()
    user_assignment = serializers.SerializerMethodField()
    user_effective_status = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id", "code", "title", "description", "creator", "owner", "candidate_owners",
            "confirmer", "participants", "department", "status", "status_label", "priority",
            "priority_label", "due_at", "current_duration_hours", "processing_duration_hours", "flow_count", "reminder_count",
            "latest_reminder_at", "is_overdue", "can_claim", "is_limited_view", "user_roles",
            "can_remind", "can_cancel", "can_transfer", "can_comment", "can_confirm_complete",
            "can_rework", "assignments", "user_assignment", "user_effective_status", "created_at", "updated_at",
        ]

    def get_current_duration_hours(self, obj):
        return current_duration_hours(obj)

    def get_processing_duration_hours(self, obj):
        return processing_duration_hours(obj)

    def get_flow_count(self, obj):
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
        if not user or not user.is_authenticated or obj.status in [Task.Status.DONE, Task.Status.CANCELLED]:
            return False
        assignment = current_assignment_for(obj, user)
        if assignment:
            return assignment.status == TaskAssignment.Status.TODO
        return bool(obj.owner_id is None and obj.candidate_owners.filter(id=user.id).exists())

    def get_is_limited_view(self, obj):
        request = self.context.get("request")
        return is_limited_candidate_view(obj, getattr(request, "user", None))

    def get_user_roles(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return list(get_user_roles(user, obj))

    def get_can_remind(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return can_perform_action(user, obj, TaskAction.REMIND)

    def get_can_cancel(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return can_perform_action(user, obj, TaskAction.CANCEL)

    def get_can_transfer(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return can_perform_action(user, obj, TaskAction.TRANSFER)

    def get_can_comment(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return can_perform_action(user, obj, TaskAction.COMMENT)

    def get_can_confirm_complete(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return can_perform_action(user, obj, TaskAction.CONFIRM_COMPLETE)

    def get_can_rework(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return can_perform_action(user, obj, TaskAction.REWORK)

    def _serialize_assignment(self, assignment):
        if not assignment:
            return None
        return {
            "id": assignment.id,
            "assignee": UserSerializer(assignment.assignee).data,
            "status": assignment.status,
            "status_label": assignment.get_status_display(),
            "started_at": assignment.started_at,
            "completed_at": assignment.completed_at,
            "completion_note": sanitize_rich_text(assignment.completion_note or ""),
        }

    def get_assignments(self, obj):
        assignments = obj.assignments.exclude(status=TaskAssignment.Status.CANCELLED).select_related("assignee")
        return [self._serialize_assignment(assignment) for assignment in assignments]

    def get_user_assignment(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return self._serialize_assignment(current_assignment_for(obj, user))

    def get_user_effective_status(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        assignment = current_assignment_for(obj, user)
        if obj.status in [Task.Status.DONE, Task.Status.CANCELLED, Task.Status.CONFIRMING, Task.Status.CANCEL_PENDING]:
            if assignment and assignment.status == TaskAssignment.Status.DONE and obj.status == Task.Status.CONFIRMING:
                return TaskAssignment.Status.DONE
            return obj.status
        return assignment.status if assignment else obj.status

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["description"] = sanitize_rich_text(data.get("description", ""))
        if data.get("is_limited_view"):
            data.pop("description", None)
        return data


class TaskDetailSerializer(TaskListSerializer):
    events = serializers.SerializerMethodField()
    comments = TaskCommentSerializer(read_only=True, many=True)
    reminders = TaskReminderSerializer(read_only=True, many=True)
    duration_analysis = serializers.SerializerMethodField()
    processing_duration_hours = serializers.SerializerMethodField()
    cancel_reason = serializers.CharField(read_only=True)
    completion_note = serializers.CharField(read_only=True)
    rework_count = serializers.IntegerField(read_only=True)
    rework_reason = serializers.CharField(read_only=True)
    rework_by = UserSerializer(read_only=True)
    rework_at = serializers.DateTimeField(read_only=True)

    class Meta(TaskListSerializer.Meta):
        fields = TaskListSerializer.Meta.fields + ["events", "comments", "reminders", "duration_analysis", "processing_duration_hours", "cancel_reason", "cancelled_at", "completion_note", "rework_count", "rework_reason", "rework_by", "rework_at", "owner_completed_at"]

    def get_events(self, obj):
        events = list(obj.events.select_related("actor", "from_owner", "to_owner", "from_department", "to_department"))
        return FlowEventSerializer(events, many=True, context={"events": events}).data

    def get_duration_analysis(self, obj):
        return duration_analysis(obj)

    def get_processing_duration_hours(self, obj):
        return processing_duration_hours(obj)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get("is_limited_view"):
            for key in [
                "description",
                "events",
                "comments",
                "reminders",
                "duration_analysis",
                "cancel_reason",
                "completion_note",
                "rework_reason",
                "rework_by",
                "rework_at",
                "owner_completed_at",
            ]:
                data.pop(key, None)
        return data


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
        "cancel", "apply_cancel", "confirm_cancel", "reject_cancel", "claim_task",
        "rework",
    ])
    status = serializers.ChoiceField(choices=Task.Status.choices, required=False)
    owner_id = serializers.IntegerField(required=False)
    department_id = serializers.IntegerField(required=False)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True)
    completion_note = serializers.CharField(required=False, allow_blank=True)
    rework_reason = serializers.CharField(required=False, allow_blank=False)
    rework_owner_id = serializers.IntegerField(required=False)
