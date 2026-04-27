from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Department, UserProfile
from ..serializers import UserSerializer
from ..services import get_available_data_scopes, get_managed_department_ids, is_department_manager, is_super_admin


def token_payload(user):
    token, _ = Token.objects.get_or_create(user=user)
    return {"token": token.key, "user": UserSerializer(user).data}


class HealthView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok", "service": "FlowDesk API"})


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        display_name = (request.data.get("display_name") or "").strip()
        if not username or not password:
            return Response({"detail": "用户名和密码必填。"}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({"detail": "用户名已存在。"}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.create_user(username=username, password=password, first_name=display_name or username)
        UserProfile.objects.get_or_create(user=user, defaults={"default_department": Department.objects.order_by("id").first()})
        return Response(token_payload(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        user = authenticate(username=request.data.get("username"), password=request.data.get("password"))
        if not user:
            return Response({"detail": "用户名或密码错误。"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(token_payload(user))


class MeView(APIView):
    def get(self, request):
        user_data = UserSerializer(request.user).data
        profile = getattr(request.user, "profile", None)

        user_data["role"] = profile.role if profile else "member"
        user_data["is_super_admin"] = is_super_admin(request.user)
        user_data["is_department_manager"] = is_department_manager(request.user)
        user_data["managed_department_ids"] = get_managed_department_ids(request.user)
        user_data["available_scopes"] = get_available_data_scopes(request.user)

        return Response(user_data)

