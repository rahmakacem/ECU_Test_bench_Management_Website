"""
Migration: 0013_full_feature_update.py

Run with: python manage.py migrate api 0013

This migration adds:
- inventory_number to ecus
- maintenance_start / maintenance_end to testbenches
- is_maintenance to booked_time_slots
- New tables: rooms, locations, suppliers
- Renames projects BCP-21, BDC-18, IPB-25 (run SQL block manually after migration)
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_ecu_invoice_id_ecu_invoice_pdf_and_more'),
    ]

    operations = [
        # ── #9: inventory_number on ECU ──
        migrations.AddField(
            model_name='ecu',
            name='inventory_number',
            field=models.CharField(blank=True, max_length=100, null=True, verbose_name='INV NUM'),
        ),

        # ── #5: Maintenance window on TestBench ──
        migrations.AddField(
            model_name='testbench',
            name='maintenance_start',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='testbench',
            name='maintenance_end',
            field=models.DateTimeField(blank=True, null=True),
        ),

        # ── #5: is_maintenance flag on BookedTimeSlot ──
        migrations.AddField(
            model_name='bookedtimeslot',
            name='is_maintenance',
            field=models.BooleanField(default=False),
        ),

        # ── #11: Rooms table ──
        migrations.CreateModel(
            name='Room',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'rooms', 'ordering': ['name']},
        ),

        # ── #10 & #15: Locations table ──
        migrations.CreateModel(
            name='Location',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'locations', 'ordering': ['name']},
        ),

        # ── #13 & #14: Suppliers table ──
        migrations.CreateModel(
            name='Supplier',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, unique=True)),
                ('country', models.CharField(blank=True, max_length=100, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('projects', models.CharField(blank=True, max_length=500, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'suppliers', 'ordering': ['name']},
        ),
    ]
