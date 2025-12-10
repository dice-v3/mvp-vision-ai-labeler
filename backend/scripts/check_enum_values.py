"""
Check enum values in User DB
"""
import psycopg2

# Connect to User DB
conn = psycopg2.connect(
    host="localhost",
    port=5433,
    database="users",
    user="admin",
    password="devpass"
)

cur = conn.cursor()

# Get enum values for invitation_type
cur.execute("""
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'invitationtype'
    ORDER BY e.enumsortorder;
""")

print("invitation_type enum values:")
print("-" * 50)
for row in cur.fetchall():
    print(f"  - {row[0]}")

print()

# Get enum values for status
cur.execute("""
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'invitationstatus'
    ORDER BY e.enumsortorder;
""")

print("status enum values:")
print("-" * 50)
for row in cur.fetchall():
    print(f"  - {row[0]}")

print()

# Get enum values for invitee_role
cur.execute("""
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'inviteerole'
    ORDER BY e.enumsortorder;
""")

print("invitee_role enum values:")
print("-" * 50)
for row in cur.fetchall():
    print(f"  - {row[0]}")

cur.close()
conn.close()
