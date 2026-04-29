from django.db import migrations, models
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('tasks', '0012_add_rework_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='UserProfile',
            name='frequent_owners',
            field=models.ManyToManyField(
                to=settings.AUTH_USER_MODEL,
                related_name='frequent_for_users',
                blank=True,
                verbose_name='常用负责人'
            ),
        ),
    ]
