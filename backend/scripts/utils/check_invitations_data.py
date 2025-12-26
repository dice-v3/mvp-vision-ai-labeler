"""
Check actual invitations data in User DB
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

# Get all invitations
cur.execute("""
    SELECT id, invitation_type, status, invitee_role, dataset_id, invitee_id, inviter_id
    FROM invitations
    ORDER BY created_at DESC
    LIMIT 10;
""")

print("Recent invitations:")
print("-" * 120)
print(f"{'ID':<5} {'Type':<15} {'Status':<12} {'Role':<15} {'Dataset ID':<20} {'Invitee':<10} {'Inviter':<10}")
print("-" * 120)

rows = cur.fetchall()
if rows:
    for row in rows:
        inv_id, inv_type, status, role, dataset_id, invitee_id, inviter_id = row
        print(f"{inv_id:<5} {str(inv_type):<15} {str(status):<12} {str(role):<15} {str(dataset_id):<20} {str(invitee_id):<10} {str(inviter_id):<10}")
else:
    print("No invitations found")

print()

# Check enum type definition for invitee_role
cur.execute("""
    SELECT typname, typtype
    FROM pg_type
    WHERE typname LIKE '%role%'
    ORDER BY typname;
""")

print("Role-related types:")
print("-" * 50)
for row in cur.fetchall():
    print(f"  {row[0]} (type: {row[1]})")

cur.close()
conn.close()
