from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from tasks.models import UserProfile, UserRole


class Command(BaseCommand):
    help = '设置指定用户为超级管理员'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='要设置为超级管理员的用户名')

    def handle(self, *args, **options):
        username = options['username']
        user = User.objects.filter(username=username).first()
        if not user:
            self.stdout.write(self.style.ERROR(f'用户 "{username}" 不存在'))
            return

        try:
            profile = user.profile
        except UserProfile.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'用户 "{username}" 没有对应的 UserProfile'))
            return

        profile.role = UserRole.SUPER_ADMIN
        profile.save()
        self.stdout.write(self.style.SUCCESS(f'已将用户 "{username}" 设置为超级管理员'))