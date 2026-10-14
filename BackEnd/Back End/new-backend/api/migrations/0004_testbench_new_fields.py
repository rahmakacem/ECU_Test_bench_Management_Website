from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_subcategory_custom_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='testbench',
            name='project',
            field=models.CharField(max_length=50, blank=True, null=True),
        ),
        migrations.AddField(
            model_name='testbench',
            name='location',
            field=models.CharField(max_length=100, blank=True, null=True),
        ),
        migrations.AddField(
            model_name='testbench',
            name='room',
            field=models.CharField(max_length=100, blank=True, null=True),
        ),
        migrations.AddField(
            model_name='testbench',
            name='bench_type',
            field=models.CharField(max_length=10, blank=True, null=True),  # MTS or BTS
        ),
        migrations.AddField(
            model_name='testbench',
            name='status',
            field=models.CharField(max_length=20, default='available'),
        ),
        migrations.AddField(
            model_name='testbench',
            name='photo',
            field=models.TextField(blank=True, null=True),  # base64 photo
        ),
    ]
