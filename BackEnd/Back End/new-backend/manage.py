#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
import threading
import time


def update_testbench_status():
    """Background thread to update testbench statuses every minute"""
    import django
    django.setup()
    from api.models import TestBench, BookedTimeSlot
    from django.utils import timezone
    
    while True:
        try:
            # ✅ FIX: Use local timezone (Africa/Tunis) instead of UTC
            now_tunis = timezone.localtime(timezone.now())
            today = now_tunis.date()
            current_time = now_tunis.time()
            
            # Debug print to show current local time
            print(f"[Status Updater] Local time check: {now_tunis.strftime('%Y-%m-%d %H:%M:%S %Z')}")
            print(f"[Status Updater] Today: {today}, Current time: {current_time}")
            
            # Get all testbenches
            testbenches = TestBench.objects.all()
            updated_count = 0
            
            for testbench in testbenches:
                # Skip faulty or maintenance testbenches (manual status)
                if testbench.status in ['faulty', 'maintenance']:
                    continue
                
                # Check if there's an active booking for this testbench right now
                active_booking = BookedTimeSlot.objects.filter(
                    testbench=testbench,
                    date=today,
                    time_slot_start__lte=current_time,
                    time_slot_end__gte=current_time,
                    is_maintenance=False
                ).exists()
                
                if active_booking:
                    if testbench.status != 'in-use':
                        testbench.status = 'in-use'
                        testbench.save(update_fields=['status'])
                        updated_count += 1
                        print(f"[Status Updater] ✅ Set {testbench.name} to IN-USE (active booking at {current_time})")
                else:
                    if testbench.status == 'in-use':
                        testbench.status = 'available'
                        testbench.save(update_fields=['status'])
                        updated_count += 1
                        print(f"[Status Updater] ✅ Set {testbench.name} to AVAILABLE (no active booking at {current_time})")
            
            if updated_count > 0:
                print(f"[Status Updater] Updated {updated_count} testbench(es) at {now_tunis.strftime('%H:%M:%S')}")
                
        except Exception as e:
            print(f"[Status Updater] Error: {e}")
        
        time.sleep(60)


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    
    # Check if we're running the development server
    if len(sys.argv) > 1 and sys.argv[1] == 'runserver':
        print("\n" + "="*60)
        print("🚀 Starting BTS Scheduler Backend")
        print("="*60)
        print("Starting background status updater thread...")
        
        # Start the background thread
        status_thread = threading.Thread(target=update_testbench_status, daemon=True)
        status_thread.start()
        print("✅ Background status updater thread started (runs every minute)")
        print("   - Checks active bookings and updates testbench statuses")
        print("   - Sets testbench to 'in-use' when a booking is active")
        print("   - Sets testbench to 'available' when no active bookings")
        print("="*60 + "\n")
    
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()