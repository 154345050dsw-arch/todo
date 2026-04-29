from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Department, FlowEvent, Task, TaskAssignment, TaskComment, TaskNotification, TaskReminder, UserProfile, UserRole
from ..serializers import DepartmentSerializer, UserSerializer
from ..services import (
    can_manage_department,
    can_manage_user,
    create_flow_event,
    get_department_descendant_ids,
    get_managed_department_ids,
    is_department_manager,
    is_super_admin,
    push_task_update,
)


class DepartmentTreeView(APIView):
    """获取部门树形结构"""

    def get(self, request):
        if not is_super_admin(request.user) and not is_department_manager(request.user):
            return Response({"detail": "无权访问组织管理。"}, status=status.HTTP_403_FORBIDDEN)

        managed_ids = get_managed_department_ids(request.user)

        def build_tree(depts, parent_id=None):
            tree = []
            for dept in depts:
                if dept.parent_id == parent_id:
                    node = DepartmentSerializer(dept).data
                    node["can_manage"] = is_super_admin(request.user) or dept.id in managed_ids
                    node["member_count"] = UserProfile.objects.filter(default_department=dept, is_active=True).count()
                    node["children"] = build_tree(depts, dept.id)
                    tree.append(node)
            return tree

        departments = Department.objects.filter(is_active=True).order_by("name")
        tree = build_tree(list(departments), None)
        return Response(tree)


class DepartmentInactiveListView(APIView):
    """获取已停用的部门列表"""

    def get(self, request):
        if not is_super_admin(request.user):
            return Response({"detail": "只有超管可以查看已停用部门。"}, status=status.HTTP_403_FORBIDDEN)

        inactive_depts = Department.objects.filter(is_active=False).order_by("name")

        results = []
        for dept in inactive_depts:
            dept_data = DepartmentSerializer(dept).data
            dept_data["parent_name"] = dept.parent.name if dept.parent else None
            dept_data["member_count"] = UserProfile.objects.filter(default_department=dept).count()
            results.append(dept_data)

        return Response(results)


class DepartmentCreateView(APIView):
    """创建部门"""

    def post(self, request):
        if not is_super_admin(request.user) and not is_department_manager(request.user):
            return Response({"detail": "无权创建部门。"}, status=status.HTTP_403_FORBIDDEN)

        name = (request.data.get("name") or "").strip()
        code = (request.data.get("code") or "").strip()
        parent_id = request.data.get("parent_id")
        manager_id = request.data.get("manager_id")

        if not name or not code:
            return Response({"detail": "部门名称和代码必填。"}, status=status.HTTP_400_BAD_REQUEST)

        if Department.objects.filter(name=name).exists():
            return Response({"detail": "部门名称已存在。"}, status=status.HTTP_400_BAD_REQUEST)

        if Department.objects.filter(code=code).exists():
            return Response({"detail": "部门代码已存在。"}, status=status.HTTP_400_BAD_REQUEST)

        if parent_id:
            parent = Department.objects.filter(id=parent_id, is_active=True).first()
            if not parent:
                return Response({"detail": "上级部门不存在。"}, status=status.HTTP_404_NOT_FOUND)
            if not can_manage_department(request.user, parent):
                return Response({"detail": "无权在该部门下创建子部门。"}, status=status.HTTP_403_FORBIDDEN)

        if manager_id and not is_super_admin(request.user):
            return Response({"detail": "只有超管可以设置部门负责人。"}, status=status.HTTP_403_FORBIDDEN)

        dept = Department.objects.create(
            name=name,
            code=code,
            parent_id=parent_id,
            manager_id=manager_id,
        )
        return Response(DepartmentSerializer(dept).data, status=status.HTTP_201_CREATED)


class DepartmentUpdateView(APIView):
    """更新部门"""

    def patch(self, request, pk):
        dept = Department.objects.filter(pk=pk, is_active=True).first()
        if not dept:
            return Response({"detail": "部门不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_department(request.user, dept):
            return Response({"detail": "无权修改该部门。"}, status=status.HTTP_403_FORBIDDEN)

        name = (request.data.get("name") or "").strip()
        code = (request.data.get("code") or "").strip()
        manager_id = request.data.get("manager_id")
        parent_id = request.data.get("parent_id")

        if name and name != dept.name:
            if Department.objects.filter(name=name).exclude(id=dept.id).exists():
                return Response({"detail": "部门名称已存在。"}, status=status.HTTP_400_BAD_REQUEST)
            dept.name = name

        if code and code != dept.code:
            if Department.objects.filter(code=code).exclude(id=dept.id).exists():
                return Response({"detail": "部门代码已存在。"}, status=status.HTTP_400_BAD_REQUEST)
            dept.code = code

        if manager_id is not None and not is_super_admin(request.user):
            return Response({"detail": "只有超管可以设置部门负责人。"}, status=status.HTTP_403_FORBIDDEN)

        if manager_id:
            manager = User.objects.filter(id=manager_id).first()
            dept.manager = manager

        if parent_id is not None:
            new_parent = Department.objects.filter(id=parent_id, is_active=True).first()
            if new_parent:
                descendant_ids = get_department_descendant_ids(dept.id)
                if parent_id in descendant_ids:
                    return Response({"detail": "不能将上级部门设置为当前部门的子部门。"}, status=status.HTTP_400_BAD_REQUEST)
                dept.parent = new_parent

        dept.save()
        return Response(DepartmentSerializer(dept).data)


class DepartmentDeactivateView(APIView):
    """停用部门"""

    def post(self, request, pk):
        dept = Department.objects.filter(pk=pk, is_active=True).first()
        if not dept:
            return Response({"detail": "部门不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_department(request.user, dept):
            return Response({"detail": "无权停用该部门。"}, status=status.HTTP_403_FORBIDDEN)

        if dept.children.filter(is_active=True).exists():
            return Response({"detail": "该部门有下级部门，请先停用下级部门。"}, status=status.HTTP_400_BAD_REQUEST)

        active_members = UserProfile.objects.filter(default_department=dept, is_active=True).count()
        if active_members > 0:
            return Response({"detail": f"该部门有 {active_members} 名活跃成员，请先调整成员部门。"}, status=status.HTTP_400_BAD_REQUEST)

        dept.is_active = False
        dept.save()
        return Response({"detail": "部门已停用。"})


class DepartmentActivateView(APIView):
    """启用部门"""

    def post(self, request, pk):
        dept = Department.objects.filter(pk=pk).first()
        if not dept:
            return Response({"detail": "部门不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not is_super_admin(request.user):
            return Response({"detail": "只有超管可以启用部门。"}, status=status.HTTP_403_FORBIDDEN)

        if dept.parent and not dept.parent.is_active:
            return Response({"detail": "父部门未启用，请先启用父部门。"}, status=status.HTTP_400_BAD_REQUEST)

        dept.is_active = True
        dept.save()
        return Response({"detail": "部门已启用。"})


class UserListView(APIView):
    """获取用户列表（带筛选）和创建用户"""

    def get(self, request):
        if not is_super_admin(request.user) and not is_department_manager(request.user):
            return Response({"detail": "无权访问成员管理。"}, status=status.HTTP_403_FORBIDDEN)

        managed_ids = get_managed_department_ids(request.user)
        department_id = request.query_params.get("department_id")
        no_department = request.query_params.get("no_department")
        include_inactive = request.query_params.get("include_inactive")
        role = request.query_params.get("role")
        search = (request.query_params.get("search") or "").strip()

        if include_inactive == "true" and is_super_admin(request.user):
            queryset = User.objects.all().select_related("profile", "profile__default_department")
        else:
            queryset = User.objects.filter(profile__is_active=True).select_related("profile", "profile__default_department")

        if not is_super_admin(request.user):
            queryset = queryset.filter(profile__default_department_id__in=managed_ids)

        if department_id:
            queryset = queryset.filter(profile__default_department_id=department_id)
        if no_department == "true":
            queryset = queryset.filter(profile__default_department__isnull=True)
        if role:
            queryset = queryset.filter(profile__role=role)
        if search:
            queryset = queryset.filter(Q(username__icontains=search) | Q(first_name__icontains=search))

        queryset = queryset.order_by("username")

        results = []
        for user in queryset:
            user_data = UserSerializer(user).data
            user_data["role"] = user.profile.role
            user_data["is_active"] = user.profile.is_active
            user_data["department_path"] = user.profile.default_department.full_path if user.profile.default_department else ""
            user_data["can_manage"] = can_manage_user(request.user, user)
            results.append(user_data)

        return Response(results)

    def post(self, request):
        if not is_super_admin(request.user) and not is_department_manager(request.user):
            return Response({"detail": "无权创建用户。"}, status=status.HTTP_403_FORBIDDEN)

        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        display_name = (request.data.get("display_name") or "").strip()
        department_id = request.data.get("department_id")
        role = request.data.get("role", UserRole.MEMBER)

        if not username or not password:
            return Response({"detail": "用户名和密码必填。"}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"detail": "用户名已存在。"}, status=status.HTTP_400_BAD_REQUEST)

        if department_id:
            dept = Department.objects.filter(id=department_id, is_active=True).first()
            if not dept:
                return Response({"detail": "部门不存在。"}, status=status.HTTP_404_NOT_FOUND)
            if not can_manage_department(request.user, dept):
                return Response({"detail": "无权在该部门创建用户。"}, status=status.HTTP_403_FORBIDDEN)

        if role in [UserRole.SUPER_ADMIN, UserRole.DEPARTMENT_MANAGER] and not is_super_admin(request.user):
            return Response({"detail": "只有超管可以创建管理员角色。"}, status=status.HTTP_403_FORBIDDEN)

        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=display_name or username,
        )

        profile = UserProfile.objects.create(
            user=user,
            default_department_id=department_id,
            role=role,
        )

        user_data = UserSerializer(user).data
        user_data["role"] = profile.role
        user_data["department_path"] = profile.default_department.full_path if profile.default_department else ""
        return Response(user_data, status=status.HTTP_201_CREATED)


class UserUpdateView(APIView):
    """更新用户信息"""

    def patch(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({"detail": "用户不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_user(request.user, target_user):
            return Response({"detail": "无权修改该用户。"}, status=status.HTTP_403_FORBIDDEN)

        profile = target_user.profile

        display_name = (request.data.get("display_name") or "").strip()
        if display_name:
            target_user.first_name = display_name
            target_user.save(update_fields=["first_name"])

        department_id = request.data.get("department_id")
        if department_id:
            new_dept = Department.objects.filter(id=department_id, is_active=True).first()
            if not new_dept:
                return Response({"detail": "部门不存在。"}, status=status.HTTP_404_NOT_FOUND)
            if not can_manage_department(request.user, new_dept):
                return Response({"detail": "无权将用户移动到该部门。"}, status=status.HTTP_403_FORBIDDEN)
            profile.default_department = new_dept

        role = request.data.get("role")
        if role:
            if role in [UserRole.SUPER_ADMIN, UserRole.DEPARTMENT_MANAGER] and not is_super_admin(request.user):
                return Response({"detail": "只有超管可以修改用户角色为管理员。"}, status=status.HTTP_403_FORBIDDEN)
            profile.role = role

        profile.save()

        user_data = UserSerializer(target_user).data
        user_data["role"] = profile.role
        user_data["department_path"] = profile.default_department.full_path if profile.default_department else ""
        return Response(user_data)


class UserDeactivateView(APIView):
    """禁用用户"""

    def post(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({"detail": "用户不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_user(request.user, target_user):
            return Response({"detail": "无权禁用该用户。"}, status=status.HTTP_403_FORBIDDEN)

        profile = target_user.profile
        profile.is_active = False
        profile.save(update_fields=["is_active"])

        if profile.role == UserRole.DEPARTMENT_MANAGER:
            target_user.managed_departments.update(manager=None)

        return Response({"detail": "用户已禁用。"})


class UserActivateView(APIView):
    """启用用户"""

    def post(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({"detail": "用户不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not is_super_admin(request.user):
            return Response({"detail": "只有超管可以启用用户。"}, status=status.HTTP_403_FORBIDDEN)

        profile = target_user.profile
        profile.is_active = True
        profile.save(update_fields=["is_active"])

        return Response({"detail": "用户已启用。"})


class UserResetPasswordView(APIView):
    """重置用户密码"""

    def post(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({"detail": "用户不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_user(request.user, target_user):
            return Response({"detail": "无权重置该用户密码。"}, status=status.HTTP_403_FORBIDDEN)

        new_password = request.data.get("new_password")
        if not new_password:
            return Response({"detail": "请提供新密码。"}, status=status.HTTP_400_BAD_REQUEST)

        target_user.set_password(new_password)
        target_user.save(update_fields=["password"])
        return Response({"detail": "密码已重置。"})


class UserDeleteView(APIView):
    """删除用户"""

    def delete(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({"detail": "用户不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_user(request.user, target_user):
            return Response({"detail": "无权删除该用户。"}, status=status.HTTP_403_FORBIDDEN)

        if target_user.id == request.user.id:
            return Response({"detail": "不能删除自己。"}, status=status.HTTP_400_BAD_REQUEST)

        active_tasks = Task.objects.filter(
            Q(creator=target_user)
            | Q(owner=target_user)
            | Q(confirmer=target_user)
            | Q(assignments__assignee=target_user)
            | Q(candidate_owners=target_user)
            | Q(participants=target_user)
        ).distinct().count()

        if active_tasks > 0:
            return Response(
                {"detail": f"该用户还有 {active_tasks} 个关联任务，请先转移或移除任务关系后再删除。"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        TaskComment.objects.filter(author=target_user).delete()
        TaskReminder.objects.filter(Q(from_user=target_user) | Q(to_user=target_user)).delete()
        TaskNotification.objects.filter(Q(recipient=target_user) | Q(actor=target_user)).delete()

        if hasattr(target_user, "managed_departments"):
            target_user.managed_departments.update(manager=None)

        if hasattr(target_user, "profile"):
            target_user.profile.delete()

        target_user.delete()

        return Response({"detail": "用户已删除。"})


class UserTransferTasksView(APIView):
    """转移用户任务给其他用户"""

    def post(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({"detail": "用户不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_user(request.user, target_user):
            return Response({"detail": "无权转移该用户的任务。"}, status=status.HTTP_403_FORBIDDEN)

        transfer_to_id = request.data.get("transfer_to_user_id")
        if not transfer_to_id:
            return Response({"detail": "请指定转移目标用户。"}, status=status.HTTP_400_BAD_REQUEST)

        transfer_to_user = User.objects.filter(pk=transfer_to_id).first()
        if not transfer_to_user:
            return Response({"detail": "目标用户不存在。"}, status=status.HTTP_404_NOT_FOUND)

        if transfer_to_user.id == target_user.id:
            return Response({"detail": "不能转移给自己。"}, status=status.HTTP_400_BAD_REQUEST)

        if not can_manage_user(request.user, transfer_to_user):
            return Response({"detail": "无权转移任务给该用户。"}, status=status.HTTP_403_FORBIDDEN)

        transferred_tasks = []

        owner_tasks = Task.objects.filter(owner=target_user)
        for task in owner_tasks:
            old_owner = task.owner
            previous = {"status": task.status, "owner": task.owner, "department": task.department}
            task.owner = transfer_to_user
            target_department = getattr(getattr(transfer_to_user, "profile", None), "default_department", None)
            update_fields = ["owner"]
            if target_department:
                task.department = target_department
                update_fields.append("department")
            task.save(update_fields=update_fields)
            assignment = TaskAssignment.objects.filter(task=task, assignee=target_user).first()
            if assignment:
                if TaskAssignment.objects.filter(task=task, assignee=transfer_to_user).exists():
                    assignment.delete()
                else:
                    assignment.assignee = transfer_to_user
                    assignment.status = TaskAssignment.Status.TODO
                    assignment.started_at = None
                    assignment.completed_at = None
                    assignment.completion_note = ""
                    assignment.save(update_fields=["assignee", "status", "started_at", "completed_at", "completion_note", "updated_at"])
            if transfer_to_user not in task.candidate_owners.all():
                task.candidate_owners.add(transfer_to_user)
            task.candidate_owners.remove(target_user)
            create_flow_event(
                task=task,
                actor=request.user,
                event_type=FlowEvent.EventType.OWNER,
                note=f"负责人由 {old_owner.username if old_owner else target_user.username} 转移给 {transfer_to_user.username}",
                previous=previous,
            )
            push_task_update(task, request.user, "organization_transfer")
            transferred_tasks.append(task.id)

        confirmer_tasks = Task.objects.filter(confirmer=target_user)
        for task in confirmer_tasks:
            old_confirmer = task.confirmer
            task.confirmer = transfer_to_user
            task.save(update_fields=["confirmer"])
            create_flow_event(
                task=task,
                actor=request.user,
                event_type=FlowEvent.EventType.ACTION,
                note=f"确认人由 {old_confirmer.username if old_confirmer else '空'} 转移给 {transfer_to_user.username}",
                previous={"status": task.status, "owner": task.owner, "department": task.department},
            )
            push_task_update(task, request.user, "organization_transfer")
            transferred_tasks.append(task.id)

        candidate_tasks = Task.objects.filter(candidate_owners__in=[target_user])
        for task in candidate_tasks:
            task.candidate_owners.remove(target_user)
            if transfer_to_user not in task.candidate_owners.all():
                task.candidate_owners.add(transfer_to_user)
            assignment = TaskAssignment.objects.filter(task=task, assignee=target_user).first()
            if assignment:
                if TaskAssignment.objects.filter(task=task, assignee=transfer_to_user).exists():
                    assignment.delete()
                else:
                    assignment.assignee = transfer_to_user
                    assignment.save(update_fields=["assignee", "updated_at"])
            create_flow_event(
                task=task,
                actor=request.user,
                event_type=FlowEvent.EventType.ACTION,
                note=f"候选负责人由 {target_user.username} 转移给 {transfer_to_user.username}",
                previous={"status": task.status, "owner": task.owner, "department": task.department},
            )
            push_task_update(task, request.user, "organization_transfer")
            transferred_tasks.append(task.id)

        return Response(
            {
                "detail": f"已转移 {len(set(transferred_tasks))} 个任务。",
                "transferred_count": len(set(transferred_tasks)),
            }
        )
