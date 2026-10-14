from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_ecu_project'),
    ]

    operations = [
        migrations.AddField(
            model_name='subcategory',
            name='project',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='subcategory',
            name='icon_name',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='subcategory',
            name='color',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='subcategory',
            name='is_custom',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterUniqueTogether(
            name='subcategory',
            unique_together=set(),
        ),
    ]
