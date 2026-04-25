from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class Department(models.Model):
    name = models.CharField(max_length=80, unique=True)
    code = models.CharField(max_length=32, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    user = models.OneToOneField(User, related_name="profile", on_delete=models.CASCADE)
    default_department = models.ForeignKey(
        Department,
        related_name="default_users",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

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
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.TextField(blank=True)
    completion_note = models.TextField(blank=True)

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
