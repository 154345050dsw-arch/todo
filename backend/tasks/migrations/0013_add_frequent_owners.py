from django.db import migrations, models
from django.contrib.auth.models import User


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0012_add_rework_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='UserProfile',
            name='frequent_owners',
            field=models.ManyToManyField(
                to=User,
                related_name='frequent_for_users',
                blank=True,
                verbose_name='常用负责人'
            ),
        ),
    ]