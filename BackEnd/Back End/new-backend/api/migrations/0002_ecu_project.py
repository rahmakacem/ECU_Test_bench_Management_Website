from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='ecu',
            name='project',
            field=models.CharField(blank=True, db_index=True, max_length=50, null=True),
        ),
    ]