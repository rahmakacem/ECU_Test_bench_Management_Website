# api/migrations/0016_add_inventory_number_to_ecu.py
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0015_add_year_to_project'),
    ]

    operations = [
        migrations.AddField(
            model_name='ecu',
            name='inventory_number',
            field=models.CharField(
                blank=True, 
                max_length=100, 
                null=True, 
                verbose_name='INV.NUM',
                db_index=True,
                help_text='Inventory number for the ECU'
            ),
        ),
    ]