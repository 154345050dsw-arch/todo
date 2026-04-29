from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_assignments(apps, schema_editor):
    Task = apps.get_model("tasks", "Task")
    TaskAssignment = apps.get_model("tasks", "TaskAssignment")

    for task in Task.objects.prefetch_related("candidate_owners").all():
        assignees = list(task.candidate_owners.all())
        if task.owner_id and all(user.id != task.owner_id for user in assignees):
            assignees.append(task.owner)
        if not assignees:
            continue

        for assignee in assignees:
            if task.status == "done":
                assignment_status = "done"
                completed_at = task.owner_completed_at or task.completed_at
            elif task.status == "cancelled":
                assignment_status = "cancelled"
                completed_at = None
            elif task.status in ["in_progress", "confirming", "cancel_pending", "overdue"] and task.owner_id == assignee.id:
                assignment_status = "in_progress"
                completed_at = None
            else:
                assignment_status = "todo"
                completed_at = None

            TaskAssignment.objects.get_or_create(
                task=task,
                assignee=assignee,
                defaults={
                    "status": assignment_status,
                    "started_at": task.created_at if assignment_status in ["in_progress", "done"] else None,
                    "completed_at": completed_at,
                    "completion_note": task.completion_note if assignment_status == "done" else "",
                },
            )


def remove_assignments(apps, schema_editor):
    TaskAssignment = apps.get_model("tasks", "TaskAssignment")
    TaskAssignment.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tasks", "0013_add_frequent_owners"),
    ]

    operations = [
        migrations.CreateModel(
            name="TaskAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("todo", "待处理"),
                            ("in_progress", "处理中"),
                            ("done", "已完成"),
                            ("cancelled", "已取消"),
                        ],
                        default="todo",
                        max_length=24,
                    ),
                ),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("completion_note", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "assignee",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="task_assignments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "task",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assignments",
                        to="tasks.task",
                    ),
                ),
            ],
            options={
                "ordering": ["created_at", "id"],
                "unique_together": {("task", "assignee")},
            },
        ),
        migrations.AddIndex(
            model_name="taskassignment",
            index=models.Index(fields=["task", "status"], name="tasks_taska_task_id_d49859_idx"),
        ),
        migrations.AddIndex(
            model_name="taskassignment",
            index=models.Index(fields=["assignee", "status"], name="tasks_taska_assigne_fc1132_idx"),
        ),
        migrations.RunPython(backfill_assignments, remove_assignments),
    ]
