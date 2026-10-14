from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, Category, SubCategory, TestBench, ECU, ECUHistory, Notification, QRCode, TransferRequest, Project, BookingRequest, Supplier, Location, Room, Team, Domain, Activity


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'role', 'date_joined']
        read_only_fields = ['id', 'date_joined']


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data['username'], password=data['password'])
        if user:
            data['user'] = user
        else:
            raise serializers.ValidationError("Invalid credentials")
        return data


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'bg_color', 'button_color', 'created_at']


class CategorySerializer(serializers.ModelSerializer):
    subcategories_count = serializers.IntegerField(source='subcategories.count', read_only=True)
    ecus_count = serializers.IntegerField(source='ecus.count', read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'created_at', 'updated_at', 'subcategories_count', 'ecus_count']


class SubCategorySerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = SubCategory
        fields = [
            'id', 'name', 'category', 'category_name',
            'project', 'icon_name', 'color', 'is_custom',
            'created_at', 'updated_at',
        ]


class TestBenchSerializer(serializers.ModelSerializer):
    ecus_count = serializers.IntegerField(source='ecus.count', read_only=True)

    class Meta:
        model = TestBench
        fields = ['id', 'name', 'project', 'location', 'room', 'bench_type', 'status', 'photo', 'created_at', 'updated_at', 'ecus_count']


class ECUSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    connection_name = serializers.CharField(source='connection.name', read_only=True, allow_null=True)
    
    # Explicitly include inventory_number (it's already in __all__, but being explicit for clarity)
    inventory_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = ECU
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class ECUHistorySerializer(serializers.ModelSerializer):
    date = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()

    class Meta:
        model = ECUHistory
        fields = ['id', 'ecu', 'action', 'action_type', 'details', 'ecu_snapshot', 'user', 'username', 'timestamp', 'date', 'time', 'additional_data']

    def get_date(self, obj):
        return obj.timestamp.strftime('%d/%m/%Y') if obj.timestamp else ''

    def get_time(self, obj):
        return obj.timestamp.strftime('%H:%M:%S') if obj.timestamp else ''


class NotificationSerializer(serializers.ModelSerializer):
    ecu_id = serializers.IntegerField(source='ecu.id', read_only=True, allow_null=True)

    class Meta:
        model = Notification
        fields = ['id', 'user', 'title', 'message', 'ecu', 'ecu_id', 'request_id', 'notification_type', 'missing_fields', 'ecu_data', 'read', 'timestamp', 'created_by', 'created_by_name']


class TransferRequestSerializer(serializers.ModelSerializer):
    ecu_serial = serializers.CharField(source='ecu.serial_number', read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TransferRequest
        fields = ['id', 'ecu', 'ecu_serial', 'requested_by', 'requested_by_name', 'requested_to_location', 'old_location', 'status', 'reviewed_by', 'reviewed_by_name', 'reviewed_at', 'review_notes', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'status', 'reviewed_by', 'reviewed_at']

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return obj.requested_by.full_name or obj.requested_by.username
        return None

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.full_name or obj.reviewed_by.username
        return None


# ── Excel Import ──
class ExcelRowSerializer(serializers.Serializer):
    ecu_id = serializers.IntegerField(required=True)
    inventory_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    serial_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    category = serializers.CharField(required=True)
    sub_category = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    status = serializers.CharField(required=False, default='active')
    location = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    connection = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    health_status = serializers.CharField(required=False, default='working')
    defect_reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    defect_ticket_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class BookingRequestSerializer(serializers.ModelSerializer):
    testbench_name = serializers.CharField(source='testbench.name', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True, allow_null=True)
    time_slot_display = serializers.SerializerMethodField()

    class Meta:
        model = BookingRequest
        fields = [
            'id', 'testbench', 'testbench_name', 'user', 'user_name',
            'date', 'time_slot_start', 'time_slot_end', 'time_slot_display',
            'team', 'domain', 'activity', 'test_case_file', 'test_case_filename',
            'status', 'reason',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'status', 'reviewed_by', 'reviewed_at']

    def get_time_slot_display(self, obj):
        return f"{obj.time_slot_start.strftime('%I:%M %p')} - {obj.time_slot_end.strftime('%I:%M %p')}"


# ==================== DYNAMIC LISTS SERIALIZERS ====================

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'country', 'description', 'applicable_projects', 'created_at', 'updated_at']


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ['id', 'name', 'is_active', 'created_at']


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'name', 'is_active', 'created_at']


class TeamSerializer(serializers.ModelSerializer):
    domains = serializers.StringRelatedField(many=True, read_only=True)
    
    class Meta:
        model = Team
        fields = ['id', 'name', 'project', 'is_active', 'domains', 'created_at', 'updated_at']


class DomainSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source='team.name', read_only=True)
    
    class Meta:
        model = Domain
        fields = ['id', 'name', 'team', 'team_name', 'created_at']


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = ['id', 'name', 'is_active', 'created_at']