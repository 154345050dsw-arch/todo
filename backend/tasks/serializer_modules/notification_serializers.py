from rest_framework import serializers

from ..models import TaskNotification
from .common_serializers import UserSerializer


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
