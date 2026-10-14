# api/migrations/0020_alter_bookingrequest_activity.py
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0019_initial_dynamic_data'),
    ]

    operations = [
        migrations.AlterField(
            model_name='bookingrequest',
            name='activity',
            field=models.CharField(blank=True, max_length=500, null=True),
        ),
    ]