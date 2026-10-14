from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_testbench_new_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='Project',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=50, unique=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('bg_color', models.CharField(max_length=20, default='#557486')),
                ('button_color', models.CharField(max_length=20, default='#354D6F')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'projects',
                'ordering': ['name'],
            },
        ),
    ]
