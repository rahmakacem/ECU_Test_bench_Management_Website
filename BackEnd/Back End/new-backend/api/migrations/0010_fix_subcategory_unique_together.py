from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_alter_testbench_status'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='subcategory',
            unique_together={('name', 'category', 'project')},
        ),
    ]
