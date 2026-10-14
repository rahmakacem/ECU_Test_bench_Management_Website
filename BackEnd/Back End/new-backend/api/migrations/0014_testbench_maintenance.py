# 0014_testbench_maintenance.py
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_full_feature_update'),
    ]

    operations = [
        migrations.CreateModel(
            name='TestBenchMaintenance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('start_datetime', models.DateTimeField()),
                ('end_datetime', models.DateTimeField()),
                ('reason', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('testbench', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='maintenance_slots', to='api.testbench')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'testbench_maintenance',
                'ordering': ['start_datetime'],
                'indexes': [
                    models.Index(fields=['testbench', 'start_datetime', 'end_datetime'], name='testbench_m_testben_1cc63a_idx'),
                ],
            },
        ),
        
        # Add is_maintenance flag to booked_time_slots
        migrations.AddField(
            model_name='bookedtimeslot',
            name='is_maintenance',
            field=models.BooleanField(default=False),
        ),
    ]