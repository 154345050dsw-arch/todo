from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class Department(models.Model):
    name = models.CharField(max_length=80, unique=True)
    code = models.CharField(max_length=32, unique=True)
    parent = models.ForeignKey(
        'self',
        related_name='children',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        verbose_name='上级部门'
    )
    manager = models.ForeignKey(
        User,
        related_name='managed_departments',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        verbose_name='部门负责人'
    )
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = '部门'
        verbose_name_plural = '部门'

    def __str__(self):
        return self.name

    def get_descendants(self):
        """递归获取所有下级部门（仅启用状态）"""
        descendants = []
        for child in self.children.filter(is_active=True):
            descendants.append(child)
            descendants.extend(child.get_descendants())
        return descendants

    def get_all_descendant_ids(self):
        """获取所有下级部门ID列表"""
        return [d.id for d in self.get_descendants()]

    @property
    def full_path(self):
        """获取部门完整路径（从顶级到当前）"""
        path = [self.name]
        current = self.parent
        while current:
            path.insert(0, current.name)
            current = current.parent
        return ' / '.join(path)


class UserRole(models.TextChoices):
    SUPER_ADMIN = 'super_admin', '超级管理员'
    DEPARTMENT_MANAGER = 'department_manager', '部门负责人'
    MEMBER = 'member', '普通成员'


class UserProfile(models.Model):
    user = models.OneToOneField(User, related_name="profile", on_delete=models.CASCADE)
    default_department = models.ForeignKey(
        Department,
        related_name="default_users",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    frequent_owners = models.ManyToManyField(
        User,
        related_name="frequent_for_users",
        blank=True,
        verbose_name='常用负责人'
    )
    role = models.CharField(
        max_length=24,
        choices=UserRole.choices,
        default=UserRole.MEMBER,
        verbose_name='用户角色'
    )
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '用户档案'
        verbose_name_plural = '用户档案'

    def __str__(self):
        return f"{self.user.username} profile"


class Task(models.Model):
    class Status(models.TextChoices):
        TODO = "todo", "待处理"
        IN_PROGRESS = "in_progress", "处理中"
        CONFIRMING = "confirming", "待确认"
        OVERDUE = "overdue", "已超时"
        DONE = "done", "已完成"
        CANCEL_PENDING = "cancel_pending", "待取消确认"
        CANCELLED = "cancelled", "已取消"

    class Priority(models.TextChoices):
        LOW = "low", "低"
        MEDIUM = "medium", "中"
        HIGH = "high", "高"

    code = models.CharField(max_length=24, unique=True, blank=True)
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    creator = models.ForeignKey(User, related_name="created_tasks", on_delete=models.CASCADE)
    owner = models.ForeignKey(User, related_name="owned_tasks", null=True, blank=True, on_delete=models.SET_NULL)
    candidate_owners = models.ManyToManyField(User, related_name="candidate_tasks", blank=True)
    confirmer = models.ForeignKey(User, related_name="confirming_tasks", null=True, blank=True, on_delete=models.SET_NULL)
    participants = models.ManyToManyField(User, related_name="participating_tasks", blank=True)
    department = models.ForeignKey(Department, related_name="tasks", null=True, blank=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.TODO)
    priority = models.CharField(max_length=16, choices=Priority.choices, default=Priority.MEDIUM)
    due_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    owner_completed_at = models.DateTimeField(null=True, blank=True, verbose_name='责任人完成时间')
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.TextField(blank=True)
    completion_note = models.TextField(blank=True)
    rework_count = models.IntegerField(default=0, verbose_name='重办次数')
    rework_reason = models.TextField(blank=True, verbose_name='重办原因')
    rework_by = models.ForeignKey(
        User,
        related_name="reworked_tasks",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        verbose_name='重办发起人'
    )
    rework_at = models.DateTimeField(null=True, blank=True, verbose_name='重办时间')

    class Meta:
        ordering = ["-updated_at", "-id"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.code:
            self.code = "FD-%04d" % (1000 + self.id)
            super().save(update_fields=["code"])

    @property
    def is_cancelled(self):
        return self.status in [self.Status.CANCEL_PENDING, self.Status.CANCELLED]

    @property
    def is_due_overdue(self):
        if not self.due_at or self.status in [self.Status.DONE, self.Status.CANCELLED]:
            return False
        return self.due_at < timezone.now()

    def __str__(self):
        return f"{self.code} {self.title}"


class FlowEvent(models.Model):
    class EventType(models.TextChoices):
        CREATED = "created", "创建"
        STATUS = "status", "状态变更"
        OWNER = "owner", "负责人变更"
        DEPARTMENT = "department", "部门变更"
        ACTION = "action", "操作"
        REMIND = "remind", "催办"
        REWORK = "rework", "重办"

    task = models.ForeignKey(Task, related_name="events", on_delete=models.CASCADE)
    actor = models.ForeignKey(User, related_name="flow_events", on_delete=models.CASCADE)
    event_type = models.CharField(max_length=24, choices=EventType.choices, default=EventType.ACTION)
    from_status = models.CharField(max_length=24, choices=Task.Status.choices, blank=True)
    to_status = models.CharField(max_length=24, choices=Task.Status.choices, blank=True)
    from_owner = models.ForeignKey(User, related_name="+", null=True, blank=True, on_delete=models.SET_NULL)
    to_owner = models.ForeignKey(User, related_name="+", null=True, blank=True, on_delete=models.SET_NULL)
    from_department = models.ForeignKey(Department, related_name="+", null=True, blank=True, on_delete=models.SET_NULL)
    to_department = models.ForeignKey(Department, related_name="+", null=True, blank=True, on_delete=models.SET_NULL)
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.task.code} {self.get_event_type_display()} {self.created_at}"


class TaskComment(models.Model):
    task = models.ForeignKey(Task, related_name="comments", on_delete=models.CASCADE)
    author = models.ForeignKey(User, related_name="task_comments", on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.task.code} comment by {self.author.username}"


class TaskReminder(models.Model):
    class RemindType(models.TextChoices):
        PROCESS = "process_remind", "催处理"
        CONFIRM = "confirm_remind", "催确认"
        CANCEL_CONFIRM = "cancel_confirm_remind", "催取消确认"

    task = models.ForeignKey(Task, related_name="reminders", on_delete=models.CASCADE)
    from_user = models.ForeignKey(User, related_name="sent_task_reminders", on_delete=models.CASCADE)
    to_user = models.ForeignKey(User, related_name="received_task_reminders", on_delete=models.CASCADE)
    remind_type = models.CharField(max_length=32, choices=RemindType.choices)
    remark = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["task", "to_user", "-created_at"]),
            models.Index(fields=["remind_type", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.task.code} {self.get_remind_type_display()} {self.to_user_id}"


class TaskNotification(models.Model):
    class NotificationType(models.TextChoices):
        TASK_CREATED = "task_created", "新任务"
        TASK_REMIND = "task_remind", "任务催办"
        TASK_COMPLETED = "task_completed", "任务已完成"
        TASK_CANCEL_REQUESTED = "task_cancel_requested", "任务取消申请"
        TASK_TRANSFERRED = "task_transferred", "任务流转"
        COMPLETE_CONFIRM = "complete_confirm", "待完成确认"
        CANCEL_CONFIRM = "cancel_confirm", "待取消确认"
        TASK_TIMEOUT = "task_timeout", "任务超时"
        TASK_REWORKED = "task_reworked", "任务重办"

    recipient = models.ForeignKey(User, related_name="task_notifications", on_delete=models.CASCADE)
    actor = models.ForeignKey(User, related_name="sent_task_notifications", on_delete=models.CASCADE)
    task = models.ForeignKey(Task, related_name="notifications", on_delete=models.CASCADE)
    notification_type = models.CharField(max_length=32, choices=NotificationType.choices, default=NotificationType.TASK_REMIND)
    title = models.CharField(max_length=80)
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["recipient", "is_read", "-created_at"]),
            models.Index(fields=["task", "-created_at"]),
            models.Index(fields=["notification_type", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.title} -> {self.recipient_id}"
