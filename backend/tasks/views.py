from .view_modules.auth_views import HealthView, LoginView, MeView, RegisterView
from .view_modules.notification_views import TaskNotificationListView, TaskNotificationReadView
from .view_modules.organization_views import (
    DepartmentActivateView,
    DepartmentCreateView,
    DepartmentDeactivateView,
    DepartmentInactiveListView,
    DepartmentTreeView,
    DepartmentUpdateView,
    UserActivateView,
    UserDeactivateView,
    UserDeleteView,
    UserListView,
    UserResetPasswordView,
    UserTransferTasksView,
    UserUpdateView,
)
from .view_modules.statistics_views import (
    DashboardView,
    DailyActivityStatsView,
    DepartmentStatsView,
    FrequentOwnersView,
    MetaView,
    PeopleStatsView,
    StatusStatsView,
)
from .view_modules.task_views import (
    TaskActionView,
    TaskCommentsView,
    TaskDetailUpdateView,
    TaskListCreateView,
    TaskReminderView,
)
# ============================================================================
