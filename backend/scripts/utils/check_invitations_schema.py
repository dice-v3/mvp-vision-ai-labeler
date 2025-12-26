"""
Check invitations table schema in User DB
"""
import psycopg2
from psycopg2 import sql

# Connect to User DB
conn = psycopg2.connect(
    host="localhost",
    port=5433,
    database="users",
    user="admin",
    password="devpass"
)

cur = conn.cursor()

# Get table columns
cur.execute("""
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'invitations'
    ORDER BY ordinal_position;
""")

print("Invitations table schema:")
print("-" * 100)
print(f"{'Column Name':<30} {'Data Type':<20} {'Max Length':<15} {'Nullable':<10} {'Default':<20}")
print("-" * 100)

for row in cur.fetchall():
    column_name, data_type, max_length, is_nullable, default = row
    max_length_str = str(max_length) if max_length else 'N/A'
    default_str = str(default)[:20] if default else 'N/A'
    print(f"{column_name:<30} {data_type:<20} {max_length_str:<15} {is_nullable:<10} {default_str:<20}")

cur.close()
conn.close()
