from django.utils import timezone
from rest_framework import serializers

from ..models import FlowEvent, TaskComment, TaskReminder
from ..services import event_label
from .common_serializers import DepartmentSerializer, UserSerializer


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
