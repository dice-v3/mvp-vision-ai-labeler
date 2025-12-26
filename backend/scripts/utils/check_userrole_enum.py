"""
Check userrole enum values
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

# Get enum values for userrole
cur.execute("""
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'userrole'
    ORDER BY e.enumsortorder;
""")

print("userrole enum values:")
print("-" * 50)
rows = cur.fetchall()
if rows:
    for row in rows:
        print(f"  - {row[0]}")
else:
    print("  (no values found)")

cur.close()
conn.close()
