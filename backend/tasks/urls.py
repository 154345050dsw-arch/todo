from django.urls import path

from .views import (
    DashboardView,
    DailyActivityStatsView,
    DepartmentStatsView,
    LoginView,
    MeView,
    MetaView,
    PeopleStatsView,
    RegisterView,
    StatusStatsView,
    TaskActionView,
    TaskCommentsView,
    TaskDetailUpdateView,
    TaskListCreateView,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view()),
    path("auth/login/", LoginView.as_view()),
    path("auth/me/", MeView.as_view()),
    path("tasks/", TaskListCreateView.as_view()),
    path("tasks/<int:pk>/", TaskDetailUpdateView.as_view()),
    path("tasks/<int:pk>/actions/", TaskActionView.as_view()),
    path("tasks/<int:pk>/comments/", TaskCommentsView.as_view()),
    path("dashboard/", DashboardView.as_view()),
    path("stats/people/", PeopleStatsView.as_view()),
    path("stats/departments/", DepartmentStatsView.as_view()),
    path("stats/statuses/", StatusStatsView.as_view()),
    path("stats/daily-activity/", DailyActivityStatsView.as_view()),
    path("meta/", MetaView.as_view()),
]
