from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import TaskNotification
from ..serializers import TaskNotificationSerializer


class TaskNotificationListView(APIView):
    def get(self, request):
        queryset = TaskNotification.objects.filter(recipient=request.user).select_related("actor", "task")
        unread_count = queryset.filter(is_read=False).count()
        limit = request.query_params.get("limit", 20)
        try:
            limit_value = min(max(int(limit), 1), 50)
        except (TypeError, ValueError):
            limit_value = 20
        return Response(
            {
                "unread_count": unread_count,
                "results": TaskNotificationSerializer(queryset[:limit_value], many=True).data,
            }
        )


class TaskNotificationReadView(APIView):
    def post(self, request, pk):
        notification = TaskNotification.objects.filter(pk=pk, recipient=request.user).select_related("actor", "task").first()
        if not notification:
            return Response({"detail": "未找到通知。"}, status=status.HTTP_404_NOT_FOUND)
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read"])
        return Response(TaskNotificationSerializer(notification).data)


class TaskNotificationMarkAllReadView(APIView):
    def post(self, request):
        updated = TaskNotification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({"marked_count": updated})

