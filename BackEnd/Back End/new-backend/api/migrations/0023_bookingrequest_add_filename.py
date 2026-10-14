from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0022_alter_bookingrequest_domain'),
    ]

    operations = [
        migrations.AddField(
            model_name='bookingrequest',
            name='test_case_filename',
            field=models.CharField(
                max_length=500,
                blank=True,
                null=True,
                help_text='Original filename of the uploaded test case file',
            ),
        ),
    ]
