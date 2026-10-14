from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_fix_subcategory_unique_together'),
    ]

    operations = [
        migrations.AlterField(
            model_name='transferrequest',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('approved', 'Approved'),
                    ('declined', 'Declined'),
                    ('confirmed', 'Confirmed'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
    ]
