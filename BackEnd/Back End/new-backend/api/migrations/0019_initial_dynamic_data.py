# api/migrations/0019_initial_dynamic_data.py
from django.db import migrations


def create_initial_data(apps, schema_editor):
    Location = apps.get_model('api', 'Location')
    Room = apps.get_model('api', 'Room')
    Team = apps.get_model('api', 'Team')
    Domain = apps.get_model('api', 'Domain')
    Activity = apps.get_model('api', 'Activity')
    Supplier = apps.get_model('api', 'Supplier')
    
    # ── Locations (for Transfer Modal) ──
    locations = ['SFAX', 'GARCHING', 'GAR', 'ALGAU', 'LEO']
    for loc in locations:
        Location.objects.get_or_create(name=loc)
    
    # ── Rooms (for Test Bench Modals) ──
    rooms = ['Training Room', 'TSP Room', 'Lab 1', 'Lab 2', 'Maintenance Area']
    for room in rooms:
        Room.objects.get_or_create(name=room)
    
    # ── Suppliers (for Return to Supplier Modal) ──
    suppliers_data = [
        {'name': 'LEAR', 'country': 'Germany', 'applicable_projects': 'BCP-21,IPB-25'},
        {'name': 'NISTEON', 'country': 'Germany', 'applicable_projects': 'BCP-21,BDC-18'},
        {'name': 'Bosch Automotive', 'country': 'Germany', 'applicable_projects': None},
        {'name': 'Continental AG', 'country': 'Germany', 'applicable_projects': None},
        {'name': 'Denso Corporation', 'country': 'Japan', 'applicable_projects': None},
    ]
    for sup in suppliers_data:
        Supplier.objects.get_or_create(name=sup['name'], defaults=sup)
    
    # ── Activities (for Booking Modal) ──
    activities = ['Full Validation', 'Bug Investigation', 'New Scenario', 'Intake', 'Fusion']
    for act in activities:
        Activity.objects.get_or_create(name=act)
    
    # ── Teams and Domains for IPB-25 ──
    ipb25_teams_domains = {
        'LIGHT-IPB': ['LCE', 'LCI'],
        'CoBo-IPB': ['AC', 'PW', 'SB', 'PIA'],
        'CACL': ['CDL', 'CA'],
        'SMACC': ['Sensores', 'WW', 'CF', 'OBD', 'LEV4ZEV', 'FBE'],
        'POWER MGT 1': ['JBR', 'TC', 'IM', 'IBS'],
        'POWER MGT 2': ['JBR', 'TC', 'IM', 'IBS'],
        'CLIMATE': ['ZGW', 'UGW', 'ZKS', 'Ethernet', 'PWF'],
        'SysFn': ['Platform'],
        'Gateway': ['ZGW', 'UGW', 'ZKS', 'Ethernet'],
        'SECURITY': ['IBS', 'CF'],
    }
    
    for team_name, domains in ipb25_teams_domains.items():
        team, _ = Team.objects.get_or_create(name=team_name, project='IPB-25')
        for domain_name in domains:
            Domain.objects.get_or_create(name=domain_name, team=team)
    
    # ── Teams and Domains for BCP-21 ──
    bcp21_teams_domains = {
        'LIGHT-BCP': ['LCE', 'LCI'],
        'CoBo-BCP': ['AC', 'PW', 'SB', 'PIA'],
        'CACL': ['CDL', 'CA'],
        'SMACC': ['Sensores', 'WW', 'CF', 'OBD', 'LEV4ZEV', 'FBE'],
        'PLATFORM': ['JBR', 'TC', 'IM', 'IBS', 'ZGW', 'UGW', 'ZKS', 'Ethernet', 'PWF'],
    }
    
    for team_name, domains in bcp21_teams_domains.items():
        team, _ = Team.objects.get_or_create(name=team_name, project='BCP-21')
        for domain_name in domains:
            Domain.objects.get_or_create(name=domain_name, team=team)
    
    # ── Teams and Domains for BDC-18 ──
    bdc18_teams_domains = {
        'LIGHT-BDC': ['LCE', 'LCI'],
        'CoBo-BDC': ['AC', 'PW', 'SB', 'PIA'],
        'CACL': ['CDL', 'CA'],
        'SMACC': ['Sensores', 'WW', 'CF', 'OBD', 'LEV4ZEV', 'FBE'],
        'PLATFORM': ['JBR', 'TC', 'IM', 'IBS', 'ZGW', 'UGW', 'ZKS', 'Ethernet', 'PWF'],
    }
    
    for team_name, domains in bdc18_teams_domains.items():
        team, _ = Team.objects.get_or_create(name=team_name, project='BDC-18')
        for domain_name in domains:
            Domain.objects.get_or_create(name=domain_name, team=team)


def reverse_data(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0018_add_dynamic_lists_tables'),
    ]

    operations = [
        migrations.RunPython(create_initial_data, reverse_code=reverse_data),
    ]