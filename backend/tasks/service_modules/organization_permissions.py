from ..models import Department, Task, TaskNotification, TaskReminder, UserProfile, UserRole


def is_super_admin(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    try:
        profile = user.profile
        return profile.role == UserRole.SUPER_ADMIN
    except UserProfile.DoesNotExist:
        return False


def is_department_manager(user):
    if not user or not user.is_authenticated:
        return False
    try:
        profile = user.profile
        return profile.role == UserRole.DEPARTMENT_MANAGER
    except UserProfile.DoesNotExist:
        return False


def is_user_active(user):
    if not user:
        return False
    try:
        profile = user.profile
        return profile.is_active
    except UserProfile.DoesNotExist:
        return False


def get_managed_department_ids(user):
    if is_super_admin(user):
        return list(Department.objects.filter(is_active=True).values_list("id", flat=True))

    if is_department_manager(user):
        managed_ids = set()
        direct_managed = user.managed_departments.filter(is_active=True).values_list("id", flat=True)
        managed_ids.update(direct_managed)
        for dept_id in direct_managed:
            try:
                dept = Department.objects.get(id=dept_id)
                descendants = dept.get_descendants()
                managed_ids.update([d.id for d in descendants])
            except Department.DoesNotExist:
                continue
        return list(managed_ids)

    return []


def get_department_descendant_ids(dept_id):
    try:
        dept = Department.objects.get(id=dept_id, is_active=True)
        ids = [dept.id]
        descendants = dept.get_descendants()
        ids.extend([d.id for d in descendants])
        return ids
    except Department.DoesNotExist:
        return []


def can_manage_department(user, dept):
    if not dept or not dept.is_active:
        return False
    if is_super_admin(user):
        return True
    if is_department_manager(user):
        managed_ids = get_managed_department_ids(user)
        return dept.id in managed_ids
    return False


def can_manage_user(user, target_user):
    if not target_user:
        return False
    try:
        target_profile = target_user.profile
    except UserProfile.DoesNotExist:
        return False

    if not target_profile.is_active:
        return False

    if is_super_admin(user):
        if is_super_admin(target_user):
            return False
        return True

    if is_department_manager(user):
        if target_profile.role in [UserRole.SUPER_ADMIN, UserRole.DEPARTMENT_MANAGER]:
            return False
        managed_ids = get_managed_department_ids(user)
        target_dept = target_profile.default_department
        if target_dept and target_dept.id in managed_ids:
            return True

    return False
