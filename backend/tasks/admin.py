from django.contrib import admin

from .models import Department, FlowEvent, Task, TaskComment, TaskNotification, TaskReminder

admin.site.register(Department)
admin.site.register(Task)
admin.site.register(FlowEvent)
admin.site.register(TaskComment)
admin.site.register(TaskReminder)
admin.site.register(TaskNotification)
