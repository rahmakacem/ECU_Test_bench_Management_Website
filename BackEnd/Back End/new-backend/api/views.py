import qrcode
import io
import base64
import time
import json
import re
import psycopg2
import psycopg2.extras
from groq import Groq
from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.conf import settings
from datetime import datetime, timedelta

from .models import (
    Category, SubCategory, TestBench, ECU, ECUHistory, Notification, 
    QRCode, TransferRequest, Project, BookingRequest, BookedTimeSlot, 
    TestBenchMaintenance, Supplier, Location, Room, Team, Domain, Activity
)
from .serializers import (
    UserSerializer, LoginSerializer,
    CategorySerializer, SubCategorySerializer, TestBenchSerializer,
    ECUSerializer, ECUHistorySerializer, NotificationSerializer,
    TransferRequestSerializer, ExcelRowSerializer, BookingRequestSerializer,
    SupplierSerializer, LocationSerializer, RoomSerializer,
    TeamSerializer, DomainSerializer, ActivitySerializer
)

User = get_user_model()

# ==================== GROQ CONFIGURATION ====================
# Get your free API key at: console.groq.com (no credit card needed)
GROQ_API_KEY = "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"  
GROQ_MODEL = "llama-3.3-70b-versatile"  

_db = settings.DATABASES['default']
DB_CONFIG = {
    "dbname":   _db['NAME'],
    "user":     _db['USER'],
    "password": _db['PASSWORD'],
    "host":     _db['HOST'],
    "port":     int(_db['PORT']),
}

# ==================== COMPREHENSIVE DATABASE SCHEMA ====================
SCHEMA = """
================================================================================
BTS SCHEDULER SYSTEM - COMPLETE DATABASE SCHEMA WITH BUSINESS LOGIC
================================================================================

This is a Test Bench Management System for automotive ECU testing.

HIERARCHY STRUCTURE:
- PROJECTS (e.g., 2021, 2018, 2025) contain multiple CATEGORIES
- CATEGORIES (e.g., BMW, Measurement Style, Power Supply) contain multiple SUBCATEGORIES
- SUBCATEGORIES (e.g., ANTENNA, SZT, HEADLIGHT) contain multiple ECUs
- TESTBENCHES are physical testing stations where ECUs are connected and tested
- ECUs are electronic units that belong to a specific SUBCATEGORY within a CATEGORY and PROJECT

BUSINESS RULES:
- Each ECU belongs to ONE PROJECT, ONE CATEGORY, and ONE SUBCATEGORY
- Each ECU can be connected to ONE TESTBENCH (or none)
- Each TESTBENCH can have multiple ECUs connected
- BOOKING REQUESTS allow users to reserve TESTBENCHES for specific time slots
- TRANSFER REQUESTS move ECUs between locations (SFAX ↔ GAR)

================================================================================
TABLES WITH RELATIONSHIPS
================================================================================

1. users
   - id (BIGINT, PRIMARY KEY)
   - username (TEXT) - login username
   - full_name (TEXT) - display name
   - role (TEXT: 'admin' or 'viewer')
   - email (TEXT)
   - date_joined (TIMESTAMP)

2. projects
   - id (BIGINT, PRIMARY KEY)
   - name (TEXT, UNIQUE) - e.g., '2021', '2018', '2025'
   - description (TEXT)
   - bg_color (TEXT) - UI color for the project card
   - button_color (TEXT) - UI button color
   - created_at (TIMESTAMP)

3. categories
   - id (BIGINT, PRIMARY KEY)
   - name (TEXT, UNIQUE) - e.g., 'BMW', 'Measurement Style', 'Power Supply'
   - created_at (TIMESTAMP)
   - updated_at (TIMESTAMP)

4. subcategories
   - id (BIGINT, PRIMARY KEY)
   - name (TEXT) - DYNAMIC! Users can add/remove (e.g., 'ANTENNA', 'SZT', 'HEADLIGHT')
   - category_id (BIGINT, FOREIGN KEY -> categories.id)
   - project (TEXT) - which project this subcategory belongs to
   - icon_name (TEXT)
   - color (TEXT)
   - is_custom (BOOLEAN) - TRUE if user-created
   - created_at (TIMESTAMP)
   - updated_at (TIMESTAMP)

5. testbenches
   - id (BIGINT, PRIMARY KEY)
   - name (TEXT, UNIQUE) - e.g., 'BCP21-TSP1', 'BCP21-TSP2'
   - project (TEXT) - which project this testbench belongs to
   - location (TEXT) - 'SFAX' or 'GAR'
   - room (TEXT) - 'Training Room', 'TSP Room'
   - bench_type (TEXT) - 'MTS' or 'BTS'
   - status (TEXT) - 'available', 'in-use', 'faulty', 'maintenance'
   - photo (TEXT) - base64 encoded
   - created_at (TIMESTAMP)
   - updated_at (TIMESTAMP)

6. ecus
   - id (BIGINT, PRIMARY KEY)
   - project (TEXT) - which project this ECU belongs to
   - inventory_number (TEXT) - INV.NUM, inventory number for the ECU
   - serial_number (TEXT) - unique serial number
   - description (TEXT)
   - category_id (BIGINT, FOREIGN KEY -> categories.id)
   - sub_category (TEXT) - matches subcategories.name
   - status (TEXT) - 'active' or 'not-active'
   - health_status (TEXT) - 'working', 'defect', 'recovered'
   - location (TEXT) - 'SFAX' or 'GAR'
   - connection_id (BIGINT, FOREIGN KEY -> testbenches.id, NULL if not connected)
   - power_amps (TEXT)
   - power_volts (TEXT)
   - defect_reason (TEXT)
   - defect_ticket_id (TEXT)
   - invoice_id (TEXT)
   - invoice_pdf (TEXT) - base64 encoded
   - created_at (TIMESTAMP)
   - updated_at (TIMESTAMP)

7. booking_requests
   - id (BIGINT, PRIMARY KEY)
   - testbench_id (BIGINT, FOREIGN KEY -> testbenches.id)
   - user_id (BIGINT, FOREIGN KEY -> users.id)
   - date (DATE)
   - time_slot_start (TIME) - 30-minute intervals (08:00 to 18:00)
   - time_slot_end (TIME)
   - team (TEXT)
   - activity (TEXT)
   - status (TEXT) - 'pending', 'approved', 'declined'
   - reason (TEXT)
   - created_at (TIMESTAMP)

8. booked_time_slots
   - id (BIGINT, PRIMARY KEY)
   - testbench_id (BIGINT, FOREIGN KEY -> testbenches.id)
   - date (DATE)
   - time_slot_start (TIME)
   - time_slot_end (TIME)
   - booking_request_id (BIGINT, FOREIGN KEY -> booking_requests.id)
   - is_maintenance (BOOLEAN) - True if this slot is blocked for maintenance
   - created_at (TIMESTAMP)
   - UNIQUE(testbench_id, date, time_slot_start) - prevents double booking

9. transfer_requests
   - id (BIGINT, PRIMARY KEY)
   - ecu_id (BIGINT, FOREIGN KEY -> ecus.id)
   - requested_by_id (BIGINT, FOREIGN KEY -> users.id)
   - requested_to_location (TEXT) - 'SFAX' or 'GAR'
   - old_location (TEXT)
   - status (TEXT) - 'pending', 'approved', 'declined', 'confirmed'
   - reviewed_by_id (BIGINT, FOREIGN KEY -> users.id)
   - reviewed_at (TIMESTAMP)
   - review_notes (TEXT)
   - created_at (TIMESTAMP)

10. ecu_history
    - id (BIGINT, PRIMARY KEY)
    - ecu_id (BIGINT, FOREIGN KEY -> ecus.id, NULL if ECU deleted)
    - action (TEXT)
    - action_type (TEXT) - 'add', 'update', 'delete', 'transfer-pending', 'transfer-approved', 'transfer-declined', 'transfer-confirmed', 'booking-pending', 'booking-approved', 'booking-declined', 'return-to-supplier', 'testbench-update'
    - details (TEXT)
    - ecu_snapshot (JSONB)
    - user (TEXT)
    - username (TEXT)
    - timestamp (TIMESTAMP)

11. notifications
    - id (BIGINT, PRIMARY KEY)
    - user_id (BIGINT, FOREIGN KEY -> users.id)
    - title (TEXT)
    - message (TEXT)
    - ecu_id (BIGINT, FOREIGN KEY -> ecus.id)
    - read (BOOLEAN)
    - timestamp (TIMESTAMP)

12. testbench_maintenance
    - id (BIGINT, PRIMARY KEY)
    - testbench_id (BIGINT, FOREIGN KEY -> testbenches.id)
    - start_datetime (TIMESTAMP)
    - end_datetime (TIMESTAMP)
    - reason (TEXT)
    - created_at (TIMESTAMP)
    - created_by_id (BIGINT, FOREIGN KEY -> users.id)

================================================================================
IMPORTANT DATA TYPE NOTES
================================================================================

- id fields are BIGINT (numbers)
- project fields are TEXT (strings like '2021', '2018', '2025') - NOT foreign keys!
- To filter by project, use: WHERE project = '2021'
- To join testbenches with ecus, use: ecus.connection_id = testbenches.id
- time_slot_start and time_slot_end are TIME types, format 'HH:MM:SS'
- date fields are DATE types
- status fields have specific allowed values (see above)

================================================================================
HOW TO ANSWER COMMON QUESTIONS (USE REAL DATA FROM DATABASE)
================================================================================

Step 1 - DISCOVER: First query the database to understand what exists
Step 2 - ANALYZE: Based on real data, generate the appropriate SQL
Step 3 - ANSWER: Execute and summarize results

Example discovery queries:
- What subcategories exist? SELECT DISTINCT sub_category FROM ecus WHERE sub_category IS NOT NULL
- What projects exist? SELECT DISTINCT project FROM ecus
- What testbenches exist? SELECT id, name, status FROM testbenches
- What booking statuses? SELECT DISTINCT status FROM booking_requests
- What are the booked slots? SELECT * FROM booked_time_slots WHERE date >= CURRENT_DATE

================================================================================
EXAMPLES OF NATURAL LANGUAGE TO SQL MAPPING
================================================================================

1. "How many ECUs are in the database?" → SELECT COUNT(*) FROM ecus;

2. "How many steering wheels?" (subcategory question)
   → First: SELECT DISTINCT sub_category FROM ecus WHERE sub_category ILIKE '%steering%'
   → Then: SELECT COUNT(*) FROM ecus WHERE sub_category ILIKE 'STEERING WHEEL'

3. "What is the most used testbench?"
   → Most ECUs connected: SELECT tb.name, COUNT(e.id) as ecu_count 
      FROM testbenches tb LEFT JOIN ecus e ON e.connection_id = tb.id 
      GROUP BY tb.id ORDER BY ecu_count DESC LIMIT 1
   → Most bookings: SELECT tb.name, COUNT(br.id) as booking_count 
      FROM testbenches tb LEFT JOIN booking_requests br ON br.testbench_id = tb.id 
      GROUP BY tb.id ORDER BY booking_count DESC LIMIT 1

4. "Show me booked slots for [testbench]"
   → SELECT * FROM booked_time_slots WHERE testbench_id = (SELECT id FROM testbenches WHERE name ILIKE '%name%') AND date >= CURRENT_DATE

5. "What are the pending booking requests?"
   → SELECT br.*, tb.name as testbench_name FROM booking_requests br 
      JOIN testbenches tb ON br.testbench_id = tb.id WHERE br.status = 'pending'

6. "How many ECUs are defective?"
   → SELECT COUNT(*) FROM ecus WHERE health_status = 'defect'

7. "Show me all transfers that happened this month"
   → SELECT * FROM transfer_requests WHERE created_at >= date_trunc('month', CURRENT_DATE)

================================================================================
CRITICAL RULES FOR THE LLM
================================================================================

- NEVER hardcode subcategory names, project names, or any values
- ALWAYS use ILIKE for text matching (case-insensitive)
- DISCOVER what exists in the database before answering
- The database is DYNAMIC - users can add/remove subcategories, testbenches, etc.
- For "most used testbench": ask clarifying questions or provide both interpretations
- Use LEFT JOIN to include items with zero counts when appropriate
- Limit results to 100 rows unless user asks for all
- For time-based questions: use CURRENT_DATE, date_trunc, etc.
"""

SUMMARY_SYSTEM = """You are a helpful assistant summarizing database query results. Be concise and friendly.
Format as a short paragraph or bullet list — no raw JSON.
If there are 0 rows, say nothing was found.
For numbers, state the count clearly.
For lists, format as bullet points."""

# ==================== SQL SAFETY VALIDATION ====================
# These are the only real tables in the DB — anything else is LLM hallucination
REAL_TABLES = {
    'users', 'projects', 'categories', 'subcategories', 'testbenches',
    'ecus', 'booking_requests', 'booked_time_slots', 'transfer_requests',
    'ecu_history', 'notifications', 'testbench_maintenance'
}

def _validate_sql_tables(sql):
    """Returns list of fake/hallucinated table names found in SQL, empty = OK."""
    referenced = re.findall(r'\b(?:FROM|JOIN)\s+(\w+)', sql, re.IGNORECASE)
    return [t for t in referenced if t.lower() not in REAL_TABLES]


def _run_sql(sql):
    """Execute SQL query and return results as list of dicts"""
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SET statement_timeout = '8s'")  # kill queries that take too long
        cur.execute(sql)
        rows = [dict(r) for r in cur.fetchall()]
        cur.close()
    finally:
        conn.close()
    return rows


def _extract_sql(text):
    """Extract SQL query from markdown code block"""
    m = re.search(r"```(?:sql)?\s*(SELECT[\s\S]+?)```", text, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(r"(SELECT\s[\s\S]+?(?:;|$))", text, re.IGNORECASE)
    if m:
        return m.group(1).strip().rstrip(';')
    return None


def _ask_llm(system, user_msg, max_tokens=800):
    """Call Groq LLM — fast, free, 70B model"""
    client = Groq(api_key=GROQ_API_KEY)
    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user_msg},
        ],
        max_tokens=max_tokens,
        temperature=0.1,  # low temperature = more consistent SQL generation
    )
    return resp.choices[0].message.content.strip()


# ── Fetch DB snapshot for LLM context ─────────────────────────────────────
def _fetch_db_snapshot():
    """
    Query the database directly for all dynamic values the LLM needs.
    Returns a formatted string injected into the LLM prompt.
    """
    queries = {
        "projects": """
            SELECT name, description FROM projects ORDER BY name
        """,

        "categories": """
            SELECT id, name FROM categories ORDER BY name
        """,

        "subcategories_in_ecus": """
            SELECT sub_category, COUNT(*) AS ecu_count
            FROM ecus
            WHERE sub_category IS NOT NULL
            GROUP BY sub_category
            ORDER BY ecu_count DESC
        """,

        "testbenches": """
            SELECT id, name, project, location, room, bench_type, status
            FROM testbenches
            ORDER BY name
        """,

        "testbenches_ecu_count": """
            SELECT tb.name, tb.status, COUNT(e.id) AS connected_ecus
            FROM testbenches tb
            LEFT JOIN ecus e ON e.connection_id = tb.id
            GROUP BY tb.id, tb.name, tb.status
            ORDER BY connected_ecus DESC
        """,

        "testbenches_booking_count": """
            SELECT tb.name, COUNT(br.id) AS total_bookings,
                   COUNT(br.id) FILTER (WHERE br.status = 'approved') AS approved_bookings
            FROM testbenches tb
            LEFT JOIN booking_requests br ON br.testbench_id = tb.id
            GROUP BY tb.id, tb.name
            ORDER BY total_bookings DESC
        """,

        "ecu_health_statuses": """
            SELECT health_status, COUNT(*) AS count
            FROM ecus
            GROUP BY health_status
        """,

        "ecu_locations": """
            SELECT location, COUNT(*) AS count
            FROM ecus
            GROUP BY location
        """,

        "ecu_statuses": """
            SELECT status, COUNT(*) AS count
            FROM ecus
            GROUP BY status
        """,

        "ecu_project_distribution": """
            SELECT project, COUNT(*) AS ecu_count
            FROM ecus
            GROUP BY project
            ORDER BY ecu_count DESC
        """,

        "booking_statuses": """
            SELECT status, COUNT(*) AS count
            FROM booking_requests
            GROUP BY status
        """,

        "booking_time_slot_usage": """
            SELECT time_slot_start, COUNT(*) AS booking_count
            FROM booking_requests
            GROUP BY time_slot_start
            ORDER BY booking_count DESC
        """,

        "booking_day_of_week": """
            SELECT EXTRACT(DOW FROM date) AS day_of_week, COUNT(*) AS bookings
            FROM booking_requests
            GROUP BY day_of_week
            ORDER BY day_of_week
        """,

        "recent_bookings_30d": """
            SELECT date, COUNT(*) AS bookings
            FROM booking_requests
            WHERE date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY date
            ORDER BY date DESC
        """,

        "booked_time_slots_upcoming": """
            SELECT bts.date, bts.time_slot_start, bts.time_slot_end, tb.name AS testbench, bts.is_maintenance
            FROM booked_time_slots bts
            JOIN testbenches tb ON bts.testbench_id = tb.id
            WHERE bts.date >= CURRENT_DATE
            ORDER BY bts.date, bts.time_slot_start
        """,

        "transfer_statuses": """
            SELECT status, COUNT(*) AS count
            FROM transfer_requests
            GROUP BY status
        """,

        "transfer_location_flows": """
            SELECT old_location, requested_to_location, COUNT(*) AS count
            FROM transfer_requests
            GROUP BY old_location, requested_to_location
            ORDER BY count DESC
        """,

        "ecu_monthly_growth": """
            SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS new_ecus
            FROM ecus
            GROUP BY month
            ORDER BY month DESC
        """,

        "ecu_history_action_types": """
            SELECT action_type, COUNT(*) AS count
            FROM ecu_history
            GROUP BY action_type
            ORDER BY count DESC
        """,

        "testbench_utilization_30d": """
            SELECT tb.name,
                   COUNT(DISTINCT br.date) AS days_used,
                   ROUND(COUNT(DISTINCT br.date) * 100.0 / 30, 2) AS utilization_percent
            FROM testbenches tb
            LEFT JOIN booking_requests br
                   ON br.testbench_id = tb.id
                  AND br.date >= CURRENT_DATE - INTERVAL '30 days'
                  AND br.status = 'approved'
            GROUP BY tb.id, tb.name
            ORDER BY utilization_percent DESC
        """,

        "system_summary_counts": """
            SELECT
                (SELECT COUNT(*) FROM ecus)                                                   AS total_ecus,
                (SELECT COUNT(*) FROM testbenches)                                            AS total_testbenches,
                (SELECT COUNT(*) FROM categories)                                             AS total_categories,
                (SELECT COUNT(DISTINCT sub_category) FROM ecus WHERE sub_category IS NOT NULL) AS distinct_subcategories,
                (SELECT COUNT(*) FROM users)                                                  AS total_users,
                (SELECT COUNT(*) FROM booking_requests WHERE status = 'pending')             AS pending_bookings,
                (SELECT COUNT(*) FROM booking_requests WHERE status = 'approved')            AS approved_bookings,
                (SELECT COUNT(*) FROM transfer_requests WHERE status = 'pending')            AS pending_transfers,
                (SELECT COUNT(*) FROM transfer_requests WHERE status = 'confirmed')          AS confirmed_transfers,
                (SELECT COUNT(*) FROM ecus WHERE health_status = 'defect')                   AS defect_ecus,
                (SELECT COUNT(*) FROM ecus WHERE health_status = 'working')                  AS working_ecus,
                (SELECT COUNT(*) FROM ecus WHERE status = 'active')                          AS active_ecus,
                (SELECT COUNT(*) FROM ecus WHERE created_at::date = CURRENT_DATE)            AS ecus_added_today
        """,
    }

    parts = ["=== LIVE DATABASE SNAPSHOT (fetched right now) ===\n"]
    for label, sql in queries.items():
        try:
            rows = _run_sql(sql.strip())
            parts.append(f"-- {label}")
            parts.append(json.dumps(rows, default=str))
            parts.append("")
        except Exception as e:
            parts.append(f"-- {label}: ERROR {e}")
            parts.append("")

    return "\n".join(parts)


# ==================== CHAT VIEW ====================
@api_view(['POST'])
@permission_classes([AllowAny])
def chat_view(request):
    question = (request.data.get('message') or '').strip()
    if not question:
        return Response({'error': 'message is required'}, status=400)

    print(f"\n{'='*60}")
    print(f"CHAT QUESTION: {question}")
    print(f"{'='*60}")

    db_snapshot = _fetch_db_snapshot()
    print(f"DB snapshot fetched ({len(db_snapshot)} chars)")

    final_prompt = f"""Generate a SQL query to answer this question: `{question}`

### PostgreSQL Database Schema (use ONLY these table names):
-- Table: users
-- Table: projects
-- Table: categories
-- Table: subcategories (column: category_id FK -> categories.id, column: project TEXT)
-- Table: testbenches (column: id, name, project, location, room, bench_type, status)
-- Table: ecus (column: id, project TEXT, inventory_number TEXT, serial_number, category_id FK->categories.id, sub_category TEXT, status, health_status, location, connection_id FK->testbenches.id)
-- Table: booking_requests (column: id, testbench_id FK->testbenches.id, user_id FK->users.id, date DATE, time_slot_start TIME, time_slot_end TIME, team, activity, status TEXT ['pending','approved','declined'])
-- Table: booked_time_slots (column: id, testbench_id FK->testbenches.id, date DATE, time_slot_start TIME, time_slot_end TIME, booking_request_id FK->booking_requests.id, is_maintenance BOOLEAN)
-- Table: transfer_requests (column: id, ecu_id FK->ecus.id, requested_by_id FK->users.id, requested_to_location TEXT, old_location TEXT, status TEXT ['pending','approved','declined','confirmed'])
-- Table: ecu_history (column: id, ecu_id FK->ecus.id, action TEXT, action_type TEXT, details TEXT, user TEXT, username TEXT, timestamp TIMESTAMP)
-- Table: notifications (column: id, user_id FK->users.id, title, message, ecu_id FK->ecus.id, read BOOLEAN, timestamp TIMESTAMP)
-- Table: testbench_maintenance (column: id, testbench_id FK->testbenches.id, start_datetime TIMESTAMP, end_datetime TIMESTAMP, reason TEXT)

### Key JOIN paths:
- ECUs on a testbench: ecus.connection_id = testbenches.id
- Bookings for a testbench: booking_requests.testbench_id = testbenches.id
- Confirmed time slots: booked_time_slots.testbench_id = testbenches.id
- "most booked testbench" means COUNT of booking_requests grouped by testbench

### LIVE DATA SNAPSHOT (pre-computed, these are NOT table names — do NOT query them directly):
{db_snapshot}

### Rules:
- Use ONLY the real table names listed in the schema above
- Use ILIKE for case-insensitive text matching
- Limit to 100 rows unless asked for all
- Output ONLY a SELECT query inside a ```sql ... ``` block
- If the question cannot be answered with SQL, say: CANNOT_SQL: <reason>
"""

    try:
        llm_response = _ask_llm(final_prompt, question, max_tokens=600)
        print(f"LLM SQL response: {llm_response[:500]}...")
    except Exception as e:
        return Response({'answer': f'LLM error: {e}', 'sql_used': None, 'row_count': 0})

    if llm_response.startswith('CANNOT_SQL:'):
        return Response({'answer': llm_response.replace('CANNOT_SQL:', '').strip(), 'sql_used': None, 'row_count': 0})

    sql = _extract_sql(llm_response)
    if not sql:
        return Response({'answer': llm_response, 'sql_used': None, 'row_count': 0})

    # Safety: reject any non-SELECT statements
    sql_lower = sql.lower().strip()
    forbidden_words = ['insert', 'update', 'delete', 'drop', 'alter',
                       'truncate', 'create', 'grant', 'revoke', 'execute']
    if not (sql_lower.startswith('select') or sql_lower.startswith('with')):
        return Response({
            'answer': "I can only answer questions by reading data — I cannot modify the database.",
            'sql_used': sql, 'row_count': 0,
        })
    if any(w in sql_lower for w in forbidden_words):
        return Response({
            'answer': "That query contains operations I'm not allowed to perform for safety reasons.",
            'sql_used': sql, 'row_count': 0,
        })

    bad_tables = _validate_sql_tables(sql)
    if bad_tables:
        print(f"SQL validation failed — hallucinated tables: {bad_tables}")
        return Response({
            'answer': (
                f"I couldn't answer that correctly — the model referenced non-existent tables: `{'`, `'.join(bad_tables)}`. "
                f"Try rephrasing your question. For example: \"which testbench has the most bookings?\""
            ),
            'sql_used': sql,
            'row_count': 0,
        })

    print(f"Executing SQL: {sql}")

    try:
        rows = _run_sql(sql)
        print(f"Query returned {len(rows)} rows")
    except Exception as e:
        return Response({
            'answer': f'I generated this SQL but it failed:\n```sql\n{sql}\n```\nError: {str(e)}',
            'sql_used': sql,
            'row_count': 0,
        })

    if not rows:
        answer = 'No results found for your query.'
    elif len(rows) == 1 and len(rows[0]) == 1:
        val = list(rows[0].values())[0]
        key = list(rows[0].keys())[0]
        answer = f"**{val}** ({key})"
    elif len(rows) <= 5:
        lines = [f"Found **{len(rows)}** result(s):"]
        for r in rows:
            lines.append('• ' + ', '.join(f"{k}: {v}" for k, v in r.items()))
        answer = '\n'.join(lines)
    else:
        data_preview = json.dumps(rows[:50], indent=2, default=str)
        summary_prompt = (
            f'User asked: "{question}"\n'
            f'SQL used: {sql}\n'
            f'Results ({len(rows)} row(s)):\n{data_preview}\n\n'
            f'Give a clear, friendly answer. '
            f'If there are many rows, summarize the key points. '
            f'For numbers, state the count clearly. '
            f'For lists, format as bullet points.'
        )
        try:
            answer = _ask_llm(SUMMARY_SYSTEM, summary_prompt, max_tokens=400)
        except Exception:
            answer = f'Found {len(rows)} results. Here are the first 5:\n' + '\n'.join(f'• {r}' for r in rows[:5])

    print(f"Final answer: {answer[:200]}...")
    print(f"{'='*60}\n")

    return Response({'answer': answer, 'sql_used': sql, 'row_count': len(rows)})


# ==================== QR Code generator ====================
def generate_qr_base64(data: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()


# ==================== AUTH ====================

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        login(request, user)
        request.session.save()

        user_data = UserSerializer(user).data
        csrf_token = get_token(request)

        response = Response({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'full_name': user.full_name,
                'role': user.role,
                'email': user.email,
                'date_joined': user.date_joined
            },
            'user_id': user.id,
            'username': user.username,
            'full_name': user.full_name,
            'role': user.role,
            'csrf_token': csrf_token,
            'message': 'Login successful'
        })

        response.set_cookie(
            key='sessionid',
            value=request.session.session_key,
            max_age=1209600,
            expires=None,
            path='/',
            domain=None,
            secure=False,
            httponly=True,
            samesite='Lax',
        )

        response.set_cookie(
            key='csrftoken',
            value=csrf_token,
            max_age=1209600,
            expires=None,
            path='/',
            domain=None,
            secure=False,
            httponly=False,
            samesite='Lax',
        )

        print(f"\n{'='*50}")
        print(f"✅ User logged in: {user.username} (ID: {user.id})")
        print(f"🔑 Session created: {request.session.session_key}")
        print(f"🍪 CSRF token set: {csrf_token}")
        print(f"📦 User data sent: {user_data}")
        print(f"{'='*50}\n")

        return response
    return Response(serializer.errors, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({'success': True, 'message': 'Logout successful'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    return Response(UserSerializer(request.user).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    token = get_token(request)
    return Response({'csrfToken': token})


# ==================== ECU VIEWSET ====================

class ECUViewSet(viewsets.ModelViewSet):
    queryset = ECU.objects.select_related('category', 'connection', 'created_by', 'updated_by').all()
    serializer_class = ECUSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        project = self.request.query_params.get('project')
        category = self.request.query_params.get('category')
        status_filter = self.request.query_params.get('status')
        health_status = self.request.query_params.get('health_status')
        location = self.request.query_params.get('location')
        connection = self.request.query_params.get('connection')
        search = self.request.query_params.get('search')
        inventory_number = self.request.query_params.get('inventory_number')

        if project:
            qs = qs.filter(project=project)
        if category:
            qs = qs.filter(category__name__iexact=category)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if health_status:
            qs = qs.filter(health_status=health_status)
        if location:
            qs = qs.filter(location__iexact=location)
        if connection:
            qs = qs.filter(connection__name__icontains=connection)
        if search:
            qs = qs.filter(
                Q(inventory_number__icontains=search) |
                Q(serial_number__icontains=search) | 
                Q(id__icontains=search)
            )
        if inventory_number:
            qs = qs.filter(inventory_number__icontains=inventory_number)
        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        project = self.request.data.get('project', '')
        inventory_number = self.request.data.get('inventory_number', '')
        
        ecu = serializer.save(created_by=user, updated_by=user, project=project)
        
        qr_b64 = generate_qr_base64(str(ecu.id))
        ecu.qr_code_path = qr_b64
        ecu.save(update_fields=['qr_code_path'])
        
        QRCode.objects.update_or_create(ecu=ecu, defaults={'qr_image': qr_b64, 'qr_data': str(ecu.id), 'generated_by': user})
        
        inv_num_display = f" (INV: {inventory_number})" if inventory_number else ""
        ECUHistory.objects.create(
            ecu=ecu, action='ECU Added', action_type='add',
            details=f'ECU {ecu.id}{inv_num_display} added',
            ecu_snapshot=ECUSerializer(ecu).data,
            user=user.full_name if user else 'System',
            username=user.username if user else 'system',
        )

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        instance = self.get_object()
        
        old_data = ECUSerializer(instance).data
        ecu = serializer.save(updated_by=user)
        
        new_data = ECUSerializer(ecu).data
        changes = {}
        
        field_display_names = {
            'inventory_number': 'INV.NUM',
            'serial_number': 'SERIAL NUMBER',
            'description': 'DESCRIPTION',
            'sub_category': 'SUB-CATEGORY',
            'status': 'STATUS',
            'health_status': 'HEALTH STATUS',
            'location': 'LOCATION',
            'defect_reason': 'DEFECT REASON',
            'defect_ticket_id': 'HOPE TICKET ID',
            'power_volts': 'POWER VOLTAGE',
            'power_amps': 'POWER CURRENT',
            'invoice_id': 'INVOICE ID',
        }
        
        for field, display_name in field_display_names.items():
            old_value = old_data.get(field)
            new_value = new_data.get(field)
            old_value = old_value if old_value and old_value != '' else '(empty)'
            new_value = new_value if new_value and new_value != '' else '(empty)'
            if str(old_value) != str(new_value):
                changes[display_name] = {'old': old_value, 'new': new_value}
        
        old_pdf = bool(old_data.get('invoice_pdf'))
        new_pdf = bool(new_data.get('invoice_pdf'))
        if old_pdf != new_pdf:
            if new_pdf:
                changes['INVOICE PDF'] = {'old': '(none)', 'new': '(uploaded)'}
            else:
                changes['INVOICE PDF'] = {'old': '(had file)', 'new': '(removed)'}
        
        old_connection = old_data.get('connection_name')
        new_connection = new_data.get('connection_name')
        old_connection_val = old_connection if old_connection else '(none)'
        new_connection_val = new_connection if new_connection else '(none)'
        if old_connection_val != new_connection_val:
            changes['CONNECTION'] = {'old': old_connection_val, 'new': new_connection_val}
        
        old_category = old_data.get('category_name')
        new_category = new_data.get('category_name')
        old_category_val = old_category if old_category else '(none)'
        new_category_val = new_category if new_category else '(none)'
        if old_category_val != new_category_val:
            changes['CATEGORY'] = {'old': old_category_val, 'new': new_category_val}
        
        if changes:
            changes_list = [f"{field}: {change['old']} → {change['new']}" for field, change in changes.items()]
            details = f"ECU {ecu.id} updated: " + " • ".join(changes_list)
        else:
            details = f"ECU {ecu.id} updated (no field changes detected)"
        
        ECUHistory.objects.create(
            ecu=ecu,
            action='ECU Updated',
            action_type='update',
            details=details,
            ecu_snapshot=new_data,
            user=user.full_name if user else 'System',
            username=user.username if user else 'system',
            additional_data={'changes': changes}
        )

    def perform_destroy(self, instance):
        user = self.request.user if self.request.user.is_authenticated else None
        inv_num_display = f" (INV: {instance.inventory_number})" if instance.inventory_number else ""
        ECUHistory.objects.create(
            ecu=None, action='ECU Deleted', action_type='delete',
            details=f'ECU {instance.id}{inv_num_display} ({instance.serial_number}) deleted',
            ecu_snapshot=ECUSerializer(instance).data,
            user=user.full_name if user else 'System',
            username=user.username if user else 'system',
        )
        instance.delete()

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        ids = request.data.get('ecu_ids', [])
        if not ids:
            return Response({'error': 'No IDs provided'}, status=400)
        ecus = ECU.objects.filter(id__in=ids)
        count = ecus.count()
        user = request.user if request.user.is_authenticated else None
        for ecu in ecus:
            inv_num_display = f" (INV: {ecu.inventory_number})" if ecu.inventory_number else ""
            ECUHistory.objects.create(
                ecu=None, action='ECU Deleted (Bulk)', action_type='bulk',
                details=f'ECU {ecu.id}{inv_num_display} deleted in bulk operation',
                ecu_snapshot=ECUSerializer(ecu).data,
                user=user.full_name if user else 'System',
                username=user.username if user else 'system',
            )
        ecus.delete()
        return Response({'deleted': count})

    @action(detail=True, methods=['get'], url_path='qr-code')
    def qr_code(self, request, pk=None):
        ecu = self.get_object()
        if ecu.qr_code_path:
            return Response({'qr_code': ecu.qr_code_path, 'ecu_id': ecu.id})
        qr_b64 = generate_qr_base64(str(ecu.id))
        ecu.qr_code_path = qr_b64
        ecu.save(update_fields=['qr_code_path'])
        return Response({'qr_code': qr_b64, 'ecu_id': ecu.id})

    @action(detail=False, methods=['get'], url_path='history')
    def history(self, request):
        ecu_id = request.query_params.get('ecu_id')
        qs = ECUHistory.objects.all().order_by('-timestamp')
        if ecu_id:
            qs = qs.filter(ecu__id=ecu_id)
        return Response(ECUHistorySerializer(qs[:500], many=True).data)

    @action(detail=False, methods=['post'], url_path='return-to-supplier')
    def return_to_supplier(self, request):
        ids = request.data.get('ecu_ids', [])
        supplier_name = request.data.get('supplier_name', '')
        
        if not ids:
            return Response({'error': 'No ECU IDs provided'}, status=400)
        if not supplier_name:
            return Response({'error': 'Supplier name is required'}, status=400)
        
        ecus = ECU.objects.filter(id__in=ids)
        count = ecus.count()
        user = request.user if request.user.is_authenticated else None
        
        for ecu in ecus:
            ecu_data = ECUSerializer(ecu).data
            inv_num_display = f" (INV: {ecu.inventory_number})" if ecu.inventory_number else ""
            ECUHistory.objects.create(
                ecu=None,
                action='Returned to Supplier',
                action_type='return-to-supplier',
                details=f'ECU {ecu.id}{inv_num_display} ({ecu.serial_number}) - {ecu.sub_category} returned to supplier: {supplier_name}',
                ecu_snapshot=ecu_data,
                user=user.full_name if user else 'System',
                username=user.username if user else 'system',
                additional_data={
                    'supplier_name': supplier_name,
                    'ecu_serial': ecu.serial_number,
                    'ecu_inventory_number': ecu.inventory_number,
                    'ecu_subcategory': ecu.sub_category,
                    'return_date': timezone.now().isoformat()
                }
            )
        
        ecus.delete()
        
        return Response({
            'success': True,
            'returned_count': count,
            'supplier_name': supplier_name,
            'message': f'{count} ECU(s) returned to {supplier_name}'
        })


# ==================== TEST BENCH VIEWSET ====================

class TestBenchViewSet(viewsets.ModelViewSet):
    queryset = TestBench.objects.all()
    serializer_class = TestBenchSerializer
    permission_classes = [AllowAny]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        testbench = serializer.save()
        ECUHistory.objects.create(
            ecu=None,
            action='Test Bench Added',
            action_type='add',
            details=f'Test bench "{testbench.name}" was added',
            user=user.full_name if user else 'System',
            username=user.username if user else 'system',
            additional_data={
                'testbench_id': testbench.id,
                'testbench_name': testbench.name,
                'testbench_data': TestBenchSerializer(testbench).data
            }
        )

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        instance = self.get_object()
        
        old_data = TestBenchSerializer(instance).data
        testbench = serializer.save()
        new_data = TestBenchSerializer(testbench).data
        
        changes = {}
        
        field_display_names = {
            'name': 'NAME',
            'project': 'PROJECT',
            'location': 'LOCATION',
            'room': 'ROOM',
            'bench_type': 'TYPE',
            'status': 'STATUS',
        }
        
        for field, display_name in field_display_names.items():
            old_value = old_data.get(field)
            new_value = new_data.get(field)
            old_value = old_value if old_value and old_value != '' else '(empty)'
            new_value = new_value if new_value and new_value != '' else '(empty)'
            if str(old_value) != str(new_value):
                if field == 'status':
                    status_map = {
                        'available': 'Available',
                        'in-use': 'In Use',
                        'faulty': 'Faulty',
                        'maintenance': 'Under Maintenance'
                    }
                    old_value = status_map.get(old_value, old_value)
                    new_value = status_map.get(new_value, new_value)
                if field == 'bench_type':
                    old_value = old_value if old_value else '(none)'
                    new_value = new_value if new_value else '(none)'
                changes[display_name] = {'old': old_value, 'new': new_value}
        
        old_photo = old_data.get('photo')
        new_photo = new_data.get('photo')
        if bool(old_photo) != bool(new_photo):
            if new_photo:
                changes['PHOTO'] = {'old': '(none)', 'new': '(updated)'}
            else:
                changes['PHOTO'] = {'old': '(had photo)', 'new': '(removed)'}
        
        if changes:
            changes_list = [f"{field}: {change['old']} → {change['new']}" for field, change in changes.items()]
            details = f"Test bench '{testbench.name}' updated: " + " • ".join(changes_list)
        else:
            details = f"Test bench '{testbench.name}' updated (no field changes detected)"
        
        ECUHistory.objects.create(
            ecu=None,
            action='Test Bench Updated',
            action_type='testbench-update',
            details=details,
            user=user.full_name if user else 'System',
            username=user.username if user else 'system',
            additional_data={
                'testbench_id': testbench.id,
                'testbench_name': testbench.name,
                'changes': changes,
                'old_data': old_data,
                'new_data': new_data
            }
        )

    def perform_destroy(self, instance):
        user = self.request.user if self.request.user.is_authenticated else None
        testbench_name = instance.name
        ECUHistory.objects.create(
            ecu=None,
            action='Test Bench Deleted',
            action_type='delete',
            details=f'Test bench "{testbench_name}" was deleted',
            user=user.full_name if user else 'System',
            username=user.username if user else 'system',
            additional_data={
                'testbench_id': instance.id,
                'testbench_name': testbench_name
            }
        )
        instance.delete()

    @action(detail=True, methods=['get'], url_path='history')
    def get_history(self, request, pk=None):
        testbench = self.get_object()
        ecu_ids = list(testbench.ecus.values_list('id', flat=True))
        history_entries = []
        
        if ecu_ids:
            ecu_history = ECUHistory.objects.filter(ecu_id__in=ecu_ids).select_related('ecu').order_by('-timestamp')[:500]
            for h in ecu_history:
                history_entries.append({
                    'id': h.id,
                    'date': h.timestamp.strftime('%d/%m/%Y'),
                    'time': h.timestamp.strftime('%H:%M'),
                    'action': h.action,
                    'action_type': h.action_type,
                    'description': h.details,
                    'performed_by': h.user,
                    'timestamp': h.timestamp.isoformat(),
                    'additional_data': h.additional_data,
                })
        
        if ecu_ids:
            transfers = TransferRequest.objects.filter(ecu_id__in=ecu_ids).select_related('ecu', 'requested_by', 'reviewed_by').order_by('-created_at')[:500]
            for t in transfers:
                status_display = {'pending': 'Pending', 'approved': 'Approved', 'declined': 'Declined', 'confirmed': 'Confirmed'}.get(t.status, t.status)
                description = f"Transfer {status_display.lower()} for ECU {t.ecu.serial_number or t.ecu.id}: {t.old_location or '—'} → {t.requested_to_location}"
                if t.review_notes and t.status in ['declined', 'approved']:
                    description += f". Notes: {t.review_notes}"
                history_entries.append({
                    'id': f'transfer-{t.id}',
                    'date': t.created_at.strftime('%d/%m/%Y'),
                    'time': t.created_at.strftime('%H:%M'),
                    'action': f'Transfer {status_display}',
                    'action_type': f'transfer-{t.status}',
                    'description': description,
                    'performed_by': t.requested_by.full_name if t.requested_by else 'System',
                    'timestamp': t.created_at.isoformat(),
                    'additional_data': {'transfer_id': t.id, 'from': t.old_location, 'to': t.requested_to_location, 'status': t.status}
                })
        
        bookings = BookingRequest.objects.filter(testbench=testbench).select_related('user', 'reviewed_by').order_by('-created_at')[:500]
        for b in bookings:
            status_display = {'pending': 'Pending', 'approved': 'Approved', 'declined': 'Declined'}.get(b.status, b.status)
            time_slot = f"{b.time_slot_start.strftime('%H:%M')}-{b.time_slot_end.strftime('%H:%M')}"
            description = f"Booking {status_display.lower()} for {b.date} at {time_slot} | Team: {b.team} | Activity: {b.activity}"
            if b.reason:
                description += f". Reason: {b.reason}"
            history_entries.append({
                'id': f'booking-{b.id}',
                'date': b.created_at.strftime('%d/%m/%Y'),
                'time': b.created_at.strftime('%H:%M'),
                'action': f'Booking {status_display}',
                'action_type': f'booking-{b.status}',
                'description': description,
                'performed_by': b.user.full_name if b.user else 'Unknown',
                'timestamp': b.created_at.isoformat(),
                'additional_data': {'booking_id': b.id, 'date': b.date.isoformat(), 'team': b.team, 'activity': b.activity, 'status': b.status}
            })
        
        testbench_updates = ECUHistory.objects.filter(action_type='testbench-update', additional_data__testbench_id=testbench.id).order_by('-timestamp')[:500]
        for u in testbench_updates:
            history_entries.append({
                'id': f'testbench-{u.id}',
                'date': u.timestamp.strftime('%d/%m/%Y'),
                'time': u.timestamp.strftime('%H:%M'),
                'action': u.action,
                'action_type': u.action_type,
                'description': u.details,
                'performed_by': u.user,
                'timestamp': u.timestamp.isoformat(),
                'additional_data': u.additional_data,
            })
        
        history_entries.sort(key=lambda x: x['timestamp'], reverse=True)
        return Response({'history': history_entries, 'total': len(history_entries), 'testbench_id': testbench.id})

    # ==================== MAINTENANCE ENDPOINTS ====================
    @action(detail=True, methods=['post'], url_path='maintenance')
    def add_maintenance(self, request, pk=None):
        testbench = self.get_object()
        start = request.data.get('start_datetime')
        end = request.data.get('end_datetime')
        reason = request.data.get('reason', '')
        
        if not start or not end:
            return Response({'error': 'start_datetime and end_datetime are required'}, status=400)
        
        # Parse dates
        if isinstance(start, str):
            start = datetime.fromisoformat(start.replace('Z', '+00:00'))
        if isinstance(end, str):
            end = datetime.fromisoformat(end.replace('Z', '+00:00'))
        
        maintenance = TestBenchMaintenance.objects.create(
            testbench=testbench,
            start_datetime=start,
            end_datetime=end,
            reason=reason,
            created_by=request.user if request.user.is_authenticated else None
        )
        
        # Create booked_time_slots for maintenance periods (30-min intervals)
        current = start
        while current < end:
            slot_end = (current + timedelta(minutes=30)).time()
            BookedTimeSlot.objects.get_or_create(
                testbench=testbench,
                date=current.date(),
                time_slot_start=current.time(),
                time_slot_end=slot_end,
                defaults={'is_maintenance': True}
            )
            current += timedelta(minutes=30)
        
        # Only set status to maintenance if the window has already started
        now = timezone.now()
        if start <= now < end:
            testbench.status = 'maintenance'
            testbench.save(update_fields=['status'])
        
        return Response({'success': True, 'maintenance_id': maintenance.id})

    @action(detail=True, methods=['get'], url_path='maintenance')
    def get_maintenance(self, request, pk=None):
        testbench = self.get_object()
        maintenance_slots = testbench.maintenance_slots.filter(
            end_datetime__gte=timezone.now()
        ).values('id', 'start_datetime', 'end_datetime', 'reason')
        
        # Format datetime for JSON serialization
        result = []
        for slot in maintenance_slots:
            result.append({
                'id': slot['id'],
                'start_datetime': slot['start_datetime'].isoformat(),
                'end_datetime': slot['end_datetime'].isoformat(),
                'reason': slot['reason']
            })
        return Response(result)

    @action(detail=True, methods=['delete'], url_path='maintenance/(?P<maintenance_id>[^/.]+)')
    def remove_maintenance(self, request, pk=None, maintenance_id=None):
        testbench = self.get_object()
        try:
            maintenance = testbench.maintenance_slots.get(id=maintenance_id)
            
            # Remove associated booked time slots
            BookedTimeSlot.objects.filter(
                testbench=testbench,
                date__gte=maintenance.start_datetime.date(),
                date__lte=maintenance.end_datetime.date(),
                is_maintenance=True
            ).delete()
            
            maintenance.delete()
            
            # If no more maintenance slots, set status back to available
            if not testbench.maintenance_slots.filter(end_datetime__gte=timezone.now()).exists():
                if testbench.status == 'maintenance':
                    testbench.status = 'available'
                    testbench.save(update_fields=['status'])
            
            return Response({'success': True})
        except TestBenchMaintenance.DoesNotExist:
            return Response({'error': 'Maintenance not found'}, status=404)


# ==================== EXCEL IMPORT ====================

@api_view(['POST'])
@permission_classes([AllowAny])
def import_excel(request):
    rows = request.data.get('rows', [])
    project = str(request.data.get('project', '')).strip()
    category_name = str(request.data.get('category', '')).strip()

    if not rows:
        return Response({'error': 'No rows provided'}, status=400)

    user = request.user if request.user.is_authenticated else None
    created = []
    errors = []

    category = None
    if category_name:
        category, _ = Category.objects.get_or_create(name=category_name)

    for row in rows:
        try:
            ecu_id = row.get('ECU ID') or row.get('ecu_id')
            if not ecu_id:
                errors.append({'row': row, 'error': 'Missing ECU ID'})
                continue
            ecu_id = int(ecu_id)

            connection_name = str(row.get('Connection') or row.get('connection') or '').strip()
            connection = None
            if connection_name:
                connection, _ = TestBench.objects.get_or_create(name=connection_name)

            raw_status = str(row.get('Status') or row.get('status') or 'active').strip().lower()
            status_val = 'not-active' if raw_status in ('not active', 'not-active', 'inactive') else 'active'

            raw_health = str(row.get('Health Status') or row.get('health_status') or 'working').strip().lower()
            health_val = {'working': 'working', 'defect': 'defect', 'recovered': 'recovered'}.get(raw_health, 'working')

            defect_date = timezone.now() if health_val == 'defect' else None

            defaults = {
                'project': project,
                'inventory_number': str(row.get('INV.NUM') or row.get('inventory_number') or row.get('Inventory Number') or '').strip() or None,
                'serial_number': str(row.get('Serial Number') or row.get('serial_number') or '').strip() or None,
                'sub_category': str(row.get('Sub Category') or row.get('sub_category') or '').strip() or None,
                'category': category,
                'description': str(row.get('Description') or row.get('description') or '').strip() or None,
                'status': status_val,
                'health_status': health_val,
                'location': str(row.get('Location') or row.get('location') or '').strip() or None,
                'connection': connection,
                'defect_reason': str(row.get('Defect Reason') or row.get('defect_reason') or '').strip() or None,
                'defect_ticket_id': str(row.get('Hope Ticket ID') or row.get('defect_ticket_id') or '').strip() or None,
                'defect_reported_date': defect_date,
                'created_by': user,
                'updated_by': user,
            }

            ecu, _ = ECU.objects.update_or_create(id=ecu_id, defaults=defaults)

            qr_b64 = generate_qr_base64(str(ecu_id))
            ecu.qr_code_path = qr_b64
            ecu.save(update_fields=['qr_code_path'])
            QRCode.objects.update_or_create(
                ecu=ecu,
                defaults={'qr_image': qr_b64, 'qr_data': str(ecu_id), 'generated_by': user}
            )

            inv_num_display = f" (INV: {defaults['inventory_number']})" if defaults['inventory_number'] else ""
            ECUHistory.objects.create(
                ecu=ecu, action='ECU Imported (Excel)', action_type='excel',
                details=f'ECU {ecu_id}{inv_num_display} imported via Excel into project={project} category={category_name}',
                ecu_snapshot=ECUSerializer(ecu).data,
                user=user.full_name if user else 'System',
                username=user.username if user else 'system',
                additional_data={
                    'inventory_number': defaults.get('inventory_number') or None,
                    'serial_number': defaults.get('serial_number') or str(ecu_id),
                    'project': project,
                    'category': category_name,
                }
            )

            created.append(ecu_id)

        except Exception as e:
            errors.append({'row': row, 'error': str(e)})

    return Response({
        'success': True,
        'created': len(created),
        'errors': errors,
        'ecu_ids': created,
    })


# ==================== OTHER VIEWSETS ====================

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]


class SubCategoryViewSet(viewsets.ModelViewSet):
    queryset = SubCategory.objects.all()
    serializer_class = SubCategorySerializer
    permission_classes = [AllowAny]
    filterset_fields = ['category', 'project', 'is_custom']

    def get_queryset(self):
        queryset = super().get_queryset()
        category_id = self.request.query_params.get('category')
        if category_id:
            try:
                category_id = int(category_id)
                queryset = queryset.filter(category_id=category_id)
            except ValueError:
                pass
        project = self.request.query_params.get('project')
        if project:
            queryset = queryset.filter(Q(project=project) | Q(project__isnull=True))
        is_custom = self.request.query_params.get('is_custom')
        if is_custom is not None:
            queryset = queryset.filter(is_custom=is_custom.lower() == 'true')
        return queryset

    def perform_create(self, serializer):
        project = self.request.data.get('project')
        serializer.save(project=project)

    @action(detail=False, methods=['post'], url_path='delete-with-ecus')
    def delete_with_ecus(self, request):
        sub_name = (request.data.get('sub_category_name') or '').strip()
        category_name = (request.data.get('category') or '').strip()
        project = (request.data.get('project') or '').strip()

        if not sub_name or not category_name or not project:
            return Response({'error': 'sub_category_name, category, and project are required'}, status=400)

        deleted_subcats = SubCategory.objects.filter(name__iexact=sub_name, category__name__iexact=category_name, project=project)
        subcat_count = deleted_subcats.count()
        deleted_subcats.delete()

        ecus_to_delete = ECU.objects.filter(project=project, category__name__iexact=category_name, sub_category__iexact=sub_name)
        user = request.user if request.user.is_authenticated else None

        for ecu in ecus_to_delete:
            inv_num_display = f" (INV: {ecu.inventory_number})" if ecu.inventory_number else ""
            ECUHistory.objects.create(
                ecu=None,
                action='ECU Deleted (Subcategory Removed)',
                action_type='delete',
                details=f'ECU {ecu.id}{inv_num_display} deleted because subcategory "{sub_name}" was removed from project={project}, category={category_name}',
                ecu_snapshot=ECUSerializer(ecu).data,
                user=user.full_name if user else 'System',
                username=user.username if user else 'system',
            )

        ecu_count = ecus_to_delete.count()
        ecus_to_delete.delete()

        return Response({'success': True, 'subcategories_deleted': subcat_count, 'ecus_deleted': ecu_count})


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    permission_classes = [AllowAny]

    def get_serializer_class(self):
        from .serializers import ProjectSerializer
        return ProjectSerializer

    def list(self, request, *args, **kwargs):
        if not Project.objects.exists():
            Project.objects.bulk_create([
                Project(name='2021', description='Project 2021', bg_color='#95A4AE', button_color='#7594A4'),
                Project(name='2018', description='Project 2018', bg_color='#936363', button_color='#7A4F4F'),
                Project(name='2025', description='Project 2025', bg_color='#557486', button_color='#354D6F'),
            ])
        return super().list(request, *args, **kwargs)


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user_id = self.request.query_params.get('user_id')
        qs = Notification.objects.all()
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        user_id = request.data.get('user_id')
        qs = Notification.objects.all()
        if user_id:
            qs = qs.filter(user_id=user_id)
        qs.update(read=True)
        return Response({'success': True})


class TransferRequestViewSet(viewsets.ModelViewSet):
    queryset = TransferRequest.objects.select_related('ecu', 'requested_by', 'reviewed_by').all()
    serializer_class = TransferRequestSerializer
    permission_classes = [AllowAny]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        tr = serializer.save(requested_by=user)
        inv_num_display = f" (INV: {tr.ecu.inventory_number})" if tr.ecu.inventory_number else ""
        ECUHistory.objects.create(
            ecu=tr.ecu,
            action='Transfer Requested',
            action_type='transfer-pending',
            details=f'Transfer requested for ECU {tr.ecu.id}{inv_num_display} from {tr.old_location or "—"} to {tr.requested_to_location}',
            user=user.full_name if user else 'Unknown',
            username=user.username if user else 'unknown',
            additional_data={'transfer_id': tr.id, 'from': tr.old_location, 'to': tr.requested_to_location}
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        tr = self.get_object()
        tr.status = 'approved'
        tr.reviewed_by = request.user if request.user.is_authenticated else None
        tr.reviewed_at = timezone.now()
        tr.review_notes = request.data.get('review_notes', '')
        tr.save()
        reviewer = tr.reviewed_by
        inv_num_display = f" (INV: {tr.ecu.inventory_number})" if tr.ecu.inventory_number else ""
        ECUHistory.objects.create(
            ecu=tr.ecu,
            action='Transfer Approved',
            action_type='transfer-approved',
            details=f'Transfer of ECU {tr.ecu.id}{inv_num_display} approved: {tr.old_location or "—"} → {tr.requested_to_location}',
            user=reviewer.full_name if reviewer else 'Unknown',
            username=reviewer.username if reviewer else 'unknown',
            additional_data={'transfer_id': tr.id, 'from': tr.old_location, 'to': tr.requested_to_location}
        )
        return Response(TransferRequestSerializer(tr).data)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        tr = self.get_object()
        tr.status = 'declined'
        tr.reviewed_by = request.user if request.user.is_authenticated else None
        tr.reviewed_at = timezone.now()
        tr.review_notes = request.data.get('review_notes', '')
        tr.save()
        reviewer = tr.reviewed_by
        inv_num_display = f" (INV: {tr.ecu.inventory_number})" if tr.ecu.inventory_number else ""
        ECUHistory.objects.create(
            ecu=tr.ecu,
            action='Transfer Declined',
            action_type='transfer-declined',
            details=f'Transfer of ECU {tr.ecu.id}{inv_num_display} declined: {tr.old_location or "—"} → {tr.requested_to_location}. Reason: {tr.review_notes}',
            user=reviewer.full_name if reviewer else 'Unknown',
            username=reviewer.username if reviewer else 'unknown',
            additional_data={'transfer_id': tr.id, 'from': tr.old_location, 'to': tr.requested_to_location, 'reason': tr.review_notes}
        )
        return Response(TransferRequestSerializer(tr).data)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        tr = self.get_object()
        if tr.status != 'approved':
            return Response({'error': 'Only approved requests can be confirmed'}, status=400)
        tr.status = 'confirmed'
        tr.save()
        tr.ecu.location = tr.requested_to_location
        tr.ecu.save(update_fields=['location'])
        user = request.user if request.user.is_authenticated else None
        inv_num_display = f" (INV: {tr.ecu.inventory_number})" if tr.ecu.inventory_number else ""
        ECUHistory.objects.create(
            ecu=tr.ecu,
            action='Transfer Confirmed',
            action_type='transfer-confirmed',
            details=f'Arrival of ECU {tr.ecu.id}{inv_num_display} confirmed at {tr.requested_to_location}. Location updated.',
            user=user.full_name if user else 'Unknown',
            username=user.username if user else 'unknown',
            additional_data={'transfer_id': tr.id, 'new_location': tr.requested_to_location}
        )
        return Response(TransferRequestSerializer(tr).data)


class BookingRequestViewSet(viewsets.ModelViewSet):
    queryset = BookingRequest.objects.select_related('testbench', 'user', 'reviewed_by').all()
    serializer_class = BookingRequestSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        if request.user.is_authenticated:
            data['user'] = request.user.id
        else:
            return Response({"error": "You must be logged in to make a booking request"}, status=401)

        serializer = self.get_serializer(data=data)
        if serializer.is_valid():
            booking = serializer.save(user=request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        testbench_id = self.request.query_params.get('testbench_id')
        if testbench_id:
            qs = qs.filter(testbench_id=testbench_id)
        from_date = self.request.query_params.get('from_date')
        if from_date:
            qs = qs.filter(date__gte=from_date)
        to_date = self.request.query_params.get('to_date')
        if to_date:
            qs = qs.filter(date__lte=to_date)
        user_id = self.request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        booking = self.get_object()
        existing_booking = BookedTimeSlot.objects.filter(
            testbench=booking.testbench, date=booking.date, time_slot_start=booking.time_slot_start
        ).exists()
        if existing_booking:
            return Response({"error": "This time slot is already booked"}, status=400)

        booking.status = 'approved'
        booking.reviewed_by = request.user if request.user.is_authenticated else None
        booking.reviewed_at = timezone.now()
        booking.reason = request.data.get('reason', '')
        booking.save()

        BookedTimeSlot.objects.create(
            testbench=booking.testbench, date=booking.date,
            time_slot_start=booking.time_slot_start, time_slot_end=booking.time_slot_end,
            booking_request=booking,
            is_maintenance=False
        )

        now = timezone.localtime(timezone.now())
        if booking.date == now.date():
            current_time = now.time()
            if booking.time_slot_start <= current_time <= booking.time_slot_end:
                booking.testbench.status = 'in-use'
                booking.testbench.save(update_fields=['status'])

        return Response(BookingRequestSerializer(booking).data)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        booking = self.get_object()
        booking.status = 'declined'
        booking.reviewed_by = request.user if request.user.is_authenticated else None
        booking.reviewed_at = timezone.now()
        booking.reason = request.data.get('reason', '')
        booking.save()
        return Response(BookingRequestSerializer(booking).data)

    @action(detail=False, methods=['get'])
    def available_slots(self, request):
        testbench_id = request.query_params.get('testbench_id')
        date = request.query_params.get('date')
        if not testbench_id or not date:
            return Response({"error": "testbench_id and date are required"}, status=400)

        # Get the testbench to know its project
        try:
            testbench = TestBench.objects.get(id=testbench_id)
            project = testbench.project
        except TestBench.DoesNotExist:
            project = None

        # Get teams for this project
        teams_data = []
        if project:
            teams = Team.objects.filter(project=project, is_active=True)
            for team in teams:
                domains = Domain.objects.filter(team=team).values_list('name', flat=True)
                teams_data.append({
                    'id': team.id,
                    'name': team.name,
                    'domains': list(domains)
                })

        # Get activities
        activities = list(Activity.objects.filter(is_active=True).values_list('name', flat=True))

        # Existing booked slots logic
        booked_slot_objs = BookedTimeSlot.objects.filter(testbench_id=testbench_id, date=date).select_related('booking_request__user')
        booked_info = {}
        for slot in booked_slot_objs:
            key = slot.time_slot_start.strftime('%H:%M:%S')
            user_name = None
            team = None
            if slot.booking_request:
                br = slot.booking_request
                user_name = br.user.full_name or br.user.username if br.user else None
                team = br.team
            elif slot.is_maintenance:
                user_name = 'Maintenance'
                team = 'System Maintenance'
            booked_info[key] = {'booked_by': user_name, 'team': team}

        booked_slots_list = list(booked_info.keys())
        all_time_slots = [
            '08:00:00', '08:30:00', '09:00:00', '09:30:00', '10:00:00', '10:30:00',
            '11:00:00', '11:30:00', '12:00:00', '12:30:00', '13:00:00', '13:30:00',
            '14:00:00', '14:30:00', '15:00:00', '15:30:00', '16:00:00', '16:30:00',
            '17:00:00', '17:30:00'
        ]
        available_slots = [slot for slot in all_time_slots if slot not in booked_slots_list]
        
        return Response({
            'testbench_id': testbench_id,
            'date': date,
            'available_slots': available_slots,
            'booked_slots': booked_slots_list,
            'booked_slots_info': booked_info,
            'teams': teams_data,
            'activities': activities,
        })


# ==================== DYNAMIC LISTS VIEWSETS ====================

class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        project = self.request.query_params.get('project')
        if project:
            qs = qs.filter(Q(applicable_projects__icontains=project) | Q(applicable_projects__isnull=True))
        return qs


class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all().order_by('name')
    serializer_class = LocationSerializer
    permission_classes = [AllowAny]


class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.filter(is_active=True)
    serializer_class = RoomSerializer
    permission_classes = [AllowAny]


class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.filter(is_active=True)
    serializer_class = TeamSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        project = self.request.query_params.get('project')
        if project:
            qs = qs.filter(project=project)
        return qs


class DomainViewSet(viewsets.ModelViewSet):
    queryset = Domain.objects.all()
    serializer_class = DomainSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        team_id = self.request.query_params.get('team')
        if team_id:
            qs = qs.filter(team_id=team_id)
        return qs


class ActivityViewSet(viewsets.ModelViewSet):
    queryset = Activity.objects.filter(is_active=True)
    serializer_class = ActivitySerializer
    permission_classes = [AllowAny]


# ── Dashboard stats ──
@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard_stats(request):
    today = timezone.now().date()
    return Response({
        'total_ecus': ECU.objects.count(),
        'total_categories': Category.objects.count(),
        'total_testbenches': TestBench.objects.count(),
        'active_ecus': ECU.objects.filter(status='active').count(),
        'defect_ecus': ECU.objects.filter(health_status='defect').count(),
        'working_ecus': ECU.objects.filter(health_status='working').count(),
        'ecus_added_today': ECU.objects.filter(created_at__date=today).count(),
    })


# ── Locations ──
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def location_list(request):
    if request.method == 'POST':
        name = (request.data.get('name') or '').strip().upper()
        if not name:
            return Response({'error': 'Name is required'}, status=400)
        if Location.objects.filter(name__iexact=name).exists():
            return Response({'name': ['Location with this name already exists.']}, status=400)
        loc = Location.objects.create(name=name)
        return Response({'id': loc.id, 'name': loc.name}, status=201)
    names = list(Location.objects.all().order_by('name').values_list('name', flat=True))
    return Response(names)