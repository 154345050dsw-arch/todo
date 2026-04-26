from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0009_add_department_hierarchy_and_user_role'),
    ]

    operations = [
        # 先更新现有数据，确保没有 null 值
        migrations.RunSQL(
            sql=[
                "UPDATE tasks_department SET created_at = NOW() WHERE created_at IS NULL",
                "UPDATE tasks_department SET updated_at = NOW() WHERE updated_at IS NULL",
                "UPDATE tasks_userprofile SET created_at = NOW() WHERE created_at IS NULL",
                "UPDATE tasks_userprofile SET updated_at = NOW() WHERE updated_at IS NULL",
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
        # 然后修改字段属性
        migrations.AlterField(
            model_name='department',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True),
        ),
        migrations.AlterField(
            model_name='department',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterField(
            model_name='userprofile',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True),
        ),
        migrations.AlterField(
            model_name='userprofile',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
    ]