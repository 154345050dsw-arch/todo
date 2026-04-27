from django.contrib.auth.models import User
from rest_framework import serializers

from ..models import Department
from ..services import display_user


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "code"]


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
