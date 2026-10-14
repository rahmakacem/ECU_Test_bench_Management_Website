from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


# ==================== USER MODEL - MUST BE FIRST ====================
class User(AbstractUser):
    ROLE_CHOICES = (('admin', 'Administrator'), ('viewer', 'Viewer'))
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='viewer')
    full_name = models.CharField(max_length=100, blank=True)
    def __str__(self): return f"{self.username} ({self.role})"
    class Meta:
        db_table = 'users'


# ==================== PROJECT MODEL - WITH YEAR FIELD ====================
class Project(models.Model):
    name = models.CharField(max_length=50, unique=True)
    year = models.IntegerField(null=True, blank=True)  # Year for styling and icon selection
    description = models.TextField(blank=True, null=True)
    bg_color = models.CharField(max_length=20, default='#557486')
    button_color = models.CharField(max_length=20, default='#354D6F')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self): return self.name

    class Meta:
        db_table = 'projects'
        ordering = ['name']


# ==================== CATEGORY MODEL ====================
class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    def __str__(self): return self.name
    class Meta:
        db_table = 'categories'
        ordering = ['name']


# ==================== SUBCATEGORY MODEL ====================
class SubCategory(models.Model):
    name = models.CharField(max_length=100)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='subcategories')
    project = models.CharField(max_length=50, blank=True, null=True)
    icon_name = models.CharField(max_length=100, blank=True, null=True)
    color = models.CharField(max_length=50, blank=True, null=True)
    is_custom = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    def __str__(self): return f"{self.category.name} - {self.name}"
    class Meta:
        db_table = 'subcategories'
        unique_together = ['name', 'category', 'project']
        ordering = ['category__name', 'name']


# ==================== TEST BENCH MODEL ====================
class TestBench(models.Model):
    STATUS_CHOICES = (
        ('available', 'Available'),
        ('in-use', 'In Use'),
        ('faulty', 'Faulty'),
        ('maintenance', 'Under Maintenance'),
    )
    
    name = models.CharField(max_length=100, unique=True)
    project = models.CharField(max_length=50, blank=True, null=True)
    location = models.CharField(max_length=100, blank=True, null=True)
    room = models.CharField(max_length=100, blank=True, null=True)
    bench_type = models.CharField(max_length=10, blank=True, null=True)  # MTS or BTS
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    photo = models.TextField(blank=True, null=True)  # base64
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self): 
        return self.name
    
    class Meta:
        db_table = 'testbenches'
        ordering = ['name']


# ==================== ECU MODEL ====================
class ECU(models.Model):
    STATUS_CHOICES = (('active', 'Active'), ('not-active', 'Not Active'))
    HEALTH_STATUS_CHOICES = (('working', 'Working'), ('defect', 'Defect'), ('recovered', 'Recovered'))
    
    id = models.BigIntegerField(primary_key=True)
    project = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    
    # NEW FIELD - Inventory Number (INV.NUM)
    inventory_number = models.CharField(
        max_length=100, 
        blank=True, 
        null=True, 
        verbose_name='INV.NUM',
        db_index=True,
        help_text='Inventory number for the ECU'
    )
    
    serial_number = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='ecus')
    sub_category = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    health_status = models.CharField(max_length=20, choices=HEALTH_STATUS_CHOICES, default='working')
    location = models.CharField(max_length=100, blank=True, null=True)
    connection = models.ForeignKey(TestBench, on_delete=models.SET_NULL, null=True, blank=True, related_name='ecus')
    power_amps = models.CharField(max_length=50, blank=True, null=True)
    power_volts = models.CharField(max_length=50, blank=True, null=True)
    measurement_system = models.CharField(max_length=50, blank=True, null=True)
    defect_reason = models.TextField(blank=True, null=True)
    defect_ticket_id = models.CharField(max_length=100, blank=True, null=True)
    defect_reported_date = models.DateTimeField(blank=True, null=True)
    qr_code_path = models.TextField(blank=True, null=True)
    
    # Invoice fields
    invoice_id = models.CharField(max_length=100, blank=True, null=True)
    invoice_pdf = models.TextField(blank=True, null=True)  # Store base64 of PDF
    invoice_uploaded_at = models.DateTimeField(blank=True, null=True)
    invoice_uploaded_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_invoices')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, related_name='created_ecus')
    updated_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, related_name='updated_ecus')
    
    def __str__(self): 
        inv_num = f" [{self.inventory_number}]" if self.inventory_number else ""
        return f"ECU {self.id}{inv_num} - {self.serial_number or 'No Serial'}"
    
    class Meta:
        db_table = 'ecus'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['inventory_number']),
            models.Index(fields=['serial_number']),
            models.Index(fields=['category']),
            models.Index(fields=['status']),
            models.Index(fields=['health_status']),
            models.Index(fields=['location']),
        ]


# ==================== ECU HISTORY MODEL ====================
class ECUHistory(models.Model):
    ACTION_TYPES = (
        ('add', 'Add'), ('update', 'Update'), ('delete', 'Delete'),
        ('excel', 'Excel Import'), ('bulk', 'Bulk Operation'), ('qr', 'QR Import'),
        ('transfer-pending', 'Transfer Pending'), ('transfer-approved', 'Transfer Approved'),
        ('transfer-declined', 'Transfer Declined'), ('transfer-confirmed', 'Transfer Confirmed'),
        ('booking-pending', 'Booking Pending'), ('booking-approved', 'Booking Approved'),
        ('booking-declined', 'Booking Declined'), ('return-to-supplier', 'Return to Supplier'),
        ('testbench-update', 'Test Bench Update'),
    )
    ecu = models.ForeignKey(ECU, on_delete=models.SET_NULL, null=True, blank=True, related_name='history')
    action = models.CharField(max_length=100)
    action_type = models.CharField(max_length=30, choices=ACTION_TYPES)
    details = models.TextField()
    ecu_snapshot = models.JSONField(null=True, blank=True)
    user = models.CharField(max_length=100)
    username = models.CharField(max_length=100)
    timestamp = models.DateTimeField(default=timezone.now)
    additional_data = models.JSONField(null=True, blank=True)
    class Meta:
        db_table = 'ecu_history'
        ordering = ['-timestamp']


# ==================== NOTIFICATION MODEL ====================
class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('transfer_request', 'Transfer Request'), ('transfer_approved', 'Transfer Approved'),
        ('transfer_declined', 'Transfer Declined'), ('excel_import', 'Excel Import'), ('system', 'System'),
    )
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    ecu = models.ForeignKey(ECU, on_delete=models.SET_NULL, null=True, blank=True)
    request_id = models.IntegerField(null=True, blank=True)
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES, null=True, blank=True)
    missing_fields = models.JSONField(null=True, blank=True)
    ecu_data = models.JSONField(null=True, blank=True)
    read = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=100)
    created_by_name = models.CharField(max_length=100)
    class Meta:
        db_table = 'notifications'
        ordering = ['-timestamp']


# ==================== QR CODE MODEL ====================
class QRCode(models.Model):
    ecu = models.OneToOneField(ECU, on_delete=models.CASCADE, related_name='qr_code')
    qr_image = models.TextField(blank=True, null=True)
    qr_data = models.TextField()
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True)
    class Meta:
        db_table = 'qr_codes'


# ==================== TRANSFER REQUEST MODEL ====================
class TransferRequest(models.Model):
    STATUS_CHOICES = (('pending', 'Pending'), ('approved', 'Approved'), ('declined', 'Declined'), ('confirmed', 'Confirmed'))
    id = models.BigAutoField(primary_key=True)
    ecu = models.ForeignKey(ECU, on_delete=models.CASCADE, related_name='transfer_requests')
    requested_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, related_name='transfer_requests_made')
    requested_to_location = models.CharField(max_length=100)
    old_location = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reviewed_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='transfer_reviews')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'transfer_requests'
        ordering = ['-created_at']


# ==================== BOOKING REQUEST MODEL ====================
class BookingRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('declined', 'Declined'),
    )
    
    id = models.BigAutoField(primary_key=True)
    testbench = models.ForeignKey(TestBench, on_delete=models.CASCADE, related_name='booking_requests')
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='booking_requests')
    date = models.DateField()
    time_slot_start = models.TimeField()
    time_slot_end = models.TimeField()
    team = models.CharField(max_length=200)
    domain = models.CharField(max_length=500, blank=True, null=True)   # Comma-separated selected domains
    activity = models.CharField(max_length=500, blank=True, null=True)  # Changed to support multiple activities
    test_case_file = models.TextField(blank=True, null=True)  # base64-encoded file content
    test_case_filename = models.CharField(max_length=500, blank=True, null=True)  # original filename for download
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reason = models.TextField(blank=True, null=True)
    reviewed_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_booking_requests')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'booking_requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['date']),
            models.Index(fields=['testbench']),
            models.Index(fields=['user']),
        ]
    
    def __str__(self):
        return f"Booking {self.id} - {self.testbench.name} - {self.date} {self.time_slot_start}-{self.time_slot_end}"


# ==================== BOOKED TIME SLOT MODEL ====================
class BookedTimeSlot(models.Model):
    """Track booked time slots for test benches"""
    testbench = models.ForeignKey(TestBench, on_delete=models.CASCADE, related_name='booked_slots')
    date = models.DateField()
    time_slot_start = models.TimeField()
    time_slot_end = models.TimeField()
    booking_request = models.OneToOneField(BookingRequest, on_delete=models.CASCADE, related_name='booked_slot', null=True, blank=True)
    is_maintenance = models.BooleanField(default=False)  # True if this slot is blocked for maintenance
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'booked_time_slots'
        unique_together = ['testbench', 'date', 'time_slot_start']
        indexes = [
            models.Index(fields=['testbench', 'date']),
        ]
    
    def __str__(self):
        return f"{self.testbench.name} - {self.date} {self.time_slot_start}-{self.time_slot_end}"


# ==================== TEST BENCH MAINTENANCE MODEL ====================
class TestBenchMaintenance(models.Model):
    """Track maintenance periods for test benches"""
    testbench = models.ForeignKey(TestBench, on_delete=models.CASCADE, related_name='maintenance_slots')
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True)
    
    class Meta:
        db_table = 'testbench_maintenance'
        ordering = ['start_datetime']
        indexes = [
            models.Index(fields=['testbench', 'start_datetime', 'end_datetime']),
        ]
    
    def __str__(self):
        return f"{self.testbench.name} maintenance: {self.start_datetime} - {self.end_datetime}"


# ==================== DYNAMIC LISTS MODELS (NEW) ====================

class Supplier(models.Model):
    """Supplier for Return to Supplier Modal"""
    name = models.CharField(max_length=200, unique=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    applicable_projects = models.CharField(
        max_length=500, 
        blank=True, 
        null=True,
        help_text='Comma-separated project names (e.g., "BCP-21,IPB-25")'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'suppliers'
        ordering = ['name']


class Location(models.Model):
    """Destination locations for Transfer Request Modal"""
    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'locations'
        ordering = ['name']


class Room(models.Model):
    """Rooms for Test Bench Modals"""
    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'rooms'
        ordering = ['name']


class Team(models.Model):
    """Teams for Booking Modal (project-specific)"""
    name = models.CharField(max_length=100)
    project = models.CharField(max_length=50, help_text='Project name this team belongs to (e.g., IPB-25, BCP-21, BDC-18)')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.project})"

    class Meta:
        db_table = 'teams'
        unique_together = ['name', 'project']
        ordering = ['project', 'name']


class Domain(models.Model):
    """Domains per team for Booking Modal"""
    name = models.CharField(max_length=100)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='domains')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.team.name})"

    class Meta:
        db_table = 'domains'
        unique_together = ['name', 'team']
        ordering = ['team__project', 'team__name', 'name']


class Activity(models.Model):
    """Activities for Booking Modal"""
    name = models.CharField(max_length=200, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'activities'
        ordering = ['name']