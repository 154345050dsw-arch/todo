from ..models import Task, UserProfile
from .organization_permissions import get_managed_department_ids, is_department_manager, is_super_admin
from .task_visibility import visible_tasks_for


def get_available_data_scopes(user):
    scopes = ["related"]
    if is_department_manager(user) or is_super_admin(user):
        scopes.append("my_department")
        scopes.append("my_department_tree")
    if is_super_admin(user):
        scopes.append("all_departments")
        scopes.append("selected_departments")
    return scopes


def can_view_data_scope(user, scope):
    return scope in get_available_data_scopes(user)


def get_tasks_for_scope(user, scope, extra_params=None):
    extra_params = extra_params or {}

    if scope == "related":
        return visible_tasks_for(user)
    if scope == "my_department":
        try:
            profile = user.profile
            if not profile.default_department:
                return Task.objects.none()
            return Task.objects.filter(department=profile.default_department)
        except UserProfile.DoesNotExist:
            return Task.objects.none()
    if scope == "my_department_tree":
        managed_ids = get_managed_department_ids(user)
        if not managed_ids:
            return Task.objects.none()
        return Task.objects.filter(department_id__in=managed_ids)
    if scope == "all_departments":
        if not is_super_admin(user):
            return Task.objects.none()
        return Task.objects.all()
    if scope == "selected_departments":
        if not is_super_admin(user):
            return Task.objects.none()
        dept_ids = extra_params.get("department_ids", [])
        if not dept_ids:
            return Task.objects.none()
        return Task.objects.filter(department_id__in=dept_ids)
    return visible_tasks_for(user)
