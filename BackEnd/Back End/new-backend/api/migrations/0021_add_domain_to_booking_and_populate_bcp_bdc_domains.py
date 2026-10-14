# api/migrations/0021_add_domain_to_booking_and_populate_bcp_bdc_domains.py
"""
This migration:
1. Adds a `domain` CharField to BookingRequest (comma-separated selected domains)
2. Populates domains for BCP-21 and BDC-18 teams (which had 0 domains)

Domain structure per the agreed spec:
  LIGHT team:        LCE, LCI
  Platform team:     JBR, TC, IM, IBS, ZGW, UGW, ZKS, Ethernet, PWF
  CoBo team:         AC, PW, SB, PIA
  SMACC team:        Sensores, WW, CF, OBD, LEV4ZEV, FBE
  CACL team:         CDL, CA
  SECURITY/GATEWAY:  (IPB-25 only — already populated)
"""
from django.db import migrations, models


def populate_bcp_bdc_domains(apps, schema_editor):
    Team = apps.get_model('api', 'Team')
    Domain = apps.get_model('api', 'Domain')

    from django.utils import timezone
    now = timezone.now()

    # ── BCP-21 domains ──────────────────────────────────────────────────────
    bcp21_domains = {
        'LIGHT-BCP':  ['LCE', 'LCI'],
        'CoBo-BCP':   ['AC', 'PW', 'SB', 'PIA'],
        'CACL':       ['CDL', 'CA'],
        'SMACC':      ['Sensores', 'WW', 'CF', 'OBD', 'LEV4ZEV', 'FBE'],
        'PLATFORM':   ['JBR', 'TC', 'IM', 'IBS', 'ZGW', 'UGW', 'ZKS', 'Ethernet', 'PWF'],
    }
    for team_name, domain_names in bcp21_domains.items():
        try:
            team = Team.objects.get(name=team_name, project='BCP-21')
            for dname in domain_names:
                Domain.objects.get_or_create(name=dname, team=team, defaults={'created_at': now})
        except Team.DoesNotExist:
            pass

    # ── BDC-18 domains ──────────────────────────────────────────────────────
    bdc18_domains = {
        'LIGHT-BDC':  ['LCE', 'LCI'],
        'CoBo-BDC':   ['AC', 'PW', 'SB', 'PIA'],
        'CACL':       ['CDL', 'CA'],
        'SMACC':      ['Sensores', 'WW', 'CF', 'OBD', 'LEV4ZEV', 'FBE'],
        'PLATFORM':   ['JBR', 'TC', 'IM', 'IBS', 'ZGW', 'UGW', 'ZKS', 'Ethernet', 'PWF'],
    }
    for team_name, domain_names in bdc18_domains.items():
        try:
            team = Team.objects.get(name=team_name, project='BDC-18')
            for dname in domain_names:
                Domain.objects.get_or_create(name=dname, team=team, defaults={'created_at': now})
        except Team.DoesNotExist:
            pass


def reverse_domains(apps, schema_editor):
    pass  # Leave data in place on reverse


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0020_alter_bookingrequest_activity'),
    ]

    operations = [
        # 1. Add domain field to BookingRequest
        migrations.AddField(
            model_name='bookingrequest',
            name='domain',
            field=models.CharField(
                blank=True,
                max_length=500,
                null=True,
                help_text='Comma-separated selected domains (e.g., "LCE, LCI")',
            ),
        ),

        # 2. Populate BCP-21 and BDC-18 domains
        migrations.RunPython(populate_bcp_bdc_domains, reverse_code=reverse_domains),
    ]
