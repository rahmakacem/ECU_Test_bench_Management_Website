# api/migrations/0018_add_dynamic_lists_tables.py
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0017_add_inventory_number_to_ecu'),
    ]

    operations = [
        # Suppliers table
        migrations.CreateModel(
            name='Supplier',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, unique=True)),
                ('country', models.CharField(blank=True, max_length=100, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('applicable_projects', models.CharField(blank=True, help_text='Comma-separated project names (e.g., "BCP-21,IPB-25")', max_length=500, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'suppliers',
                'ordering': ['name'],
            },
        ),

        # Locations table (for transfer destinations)
        migrations.CreateModel(
            name='Location',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'locations',
                'ordering': ['name'],
            },
        ),

        # Rooms table (for test benches)
        migrations.CreateModel(
            name='Room',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'rooms',
                'ordering': ['name'],
            },
        ),

        # Teams table
        migrations.CreateModel(
            name='Team',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('project', models.CharField(max_length=50, help_text='Project name this team belongs to (e.g., IPB-25, BCP-21, BDC-18)')),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'teams',
                'unique_together': {('name', 'project')},
                'ordering': ['project', 'name'],
            },
        ),

        # Domains table (each team has multiple domains)
        migrations.CreateModel(
            name='Domain',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('team', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='domains', to='api.team')),
            ],
            options={
                'db_table': 'domains',
                'unique_together': {('name', 'team')},
                'ordering': ['team__project', 'team__name', 'name'],
            },
        ),

        # Activities table
        migrations.CreateModel(
            name='Activity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, unique=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'activities',
                'ordering': ['name'],
            },
        ),
    ]