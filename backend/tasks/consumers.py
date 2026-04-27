import json
from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import AnonymousUser


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # 从 URL 参数获取 token
        query_string = self.scope.get("query_string", b"").decode()
        token_key = None
        for param in query_string.split("&"):
            if param.startswith("token="):
                token_key = param.split("=", 1)[1]
                break

        # 验证 token
        user = AnonymousUser()
        if token_key:
            token_obj = await sync_to_async(self._get_token_user)(token_key)
            if token_obj:
                user = token_obj.user

        # 拒绝未认证用户
        if user.is_anonymous:
            await self.close()
            return

        self.scope["user"] = user
        await self.accept()

        # 加入用户专属频道组
        self.group_name = f"notifications_{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)

    def _get_token_user(self, token_key):
        try:
            return Token.objects.select_related("user").get(key=token_key)
        except Token.DoesNotExist:
            return None

    async def disconnect(self, close_code):
        # 离开频道组
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notification_message(self, event):
        """接收并转发通知消息"""
        await self.send(text_data=json.dumps(event["data"]))