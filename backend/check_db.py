"""Check Platform DB schema and users."""
import sys
from sqlalchemy import create_engine, inspect, text
from app.core.config import settings

# Create engine for User DB (port 5433)
engine = create_engine(
    f"postgresql://{settings.USER_DB_USER}:{settings.USER_DB_PASSWORD}@{settings.USER_DB_HOST}:{settings.USER_DB_PORT}/{settings.USER_DB_NAME}"
)

print("=" * 80)
print("Platform DB Connection Test")
print("=" * 80)

try:
    with engine.connect() as conn:
        print("\n[OK] Connected to Platform DB successfully")

        # Get table schema
        inspector = inspect(engine)

        if 'users' in inspector.get_table_names():
            print("\n[OK] 'users' table exists")

            # Get column info
            print("\nTable columns:")
            columns = inspector.get_columns('users')
            for col in columns:
                print(f"  - {col['name']}: {col['type']}")

            # Check if data exists
            result = conn.execute(text("SELECT COUNT(*) FROM users"))
            count = result.scalar()
            print(f"\nTotal users: {count}")

            # Check for admin user
            result = conn.execute(text("SELECT id, email, is_active FROM users WHERE email = 'admin@example.com'"))
            admin = result.fetchone()

            if admin:
                print(f"\n[OK] Admin user exists:")
                print(f"  - ID: {admin[0]}")
                print(f"  - Email: {admin[1]}")
                print(f"  - Active: {admin[2]}")

                # Check which password column exists
                if 'password_hash' in [col['name'] for col in columns]:
                    result = conn.execute(text("SELECT password_hash FROM users WHERE email = 'admin@example.com'"))
                    pwd_hash = result.scalar()
                    print(f"  - password_hash column: EXISTS")
                    print(f"  - Hash value: {pwd_hash[:50]}...")

                if 'hashed_password' in [col['name'] for col in columns]:
                    result = conn.execute(text("SELECT hashed_password FROM users WHERE email = 'admin@example.com'"))
                    pwd_hash = result.scalar()
                    print(f"  - hashed_password column: EXISTS")
                    print(f"  - Hash value: {pwd_hash[:50]}..." if pwd_hash else "NULL")
            else:
                print("\n[ERROR] Admin user NOT found")
                print("\nExisting users:")
                result = conn.execute(text("SELECT id, email FROM users LIMIT 5"))
                for row in result:
                    print(f"  - {row[0]}: {row[1]}")
        else:
            print("\n[ERROR] 'users' table does NOT exist")
            print("\nAvailable tables:")
            for table in inspector.get_table_names():
                print(f"  - {table}")

except Exception as e:
    print(f"\n[ERROR] Error: {e}")
    sys.exit(1)

print("\n" + "=" * 80)
