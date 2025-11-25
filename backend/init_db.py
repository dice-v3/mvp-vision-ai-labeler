"""Initialize Platform DB with test users."""
import sys
from sqlalchemy import create_engine, text
from app.core.config import settings

# Create engine for Platform DB
engine = create_engine(
    f"postgresql://{settings.PLATFORM_DB_USER}:{settings.PLATFORM_DB_PASSWORD}@{settings.PLATFORM_DB_HOST}:{settings.PLATFORM_DB_PORT}/{settings.PLATFORM_DB_NAME}"
)

print("=" * 80)
print("Initializing Platform DB with test users")
print("=" * 80)

try:
    with engine.connect() as conn:
        print("\n[1/2] Creating test users...")

        # Insert test users
        # Password: 'admin123' (bcrypt hash)
        result = conn.execute(text("""
            INSERT INTO users (email, hashed_password, full_name, system_role, is_active, badge_color, created_at, updated_at)
            VALUES
                ('admin@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIq8E4O8p6', 'Admin User', 'admin', TRUE, '#9333ea', NOW(), NOW()),
                ('user@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIq8E4O8p6', 'Test User', 'user', TRUE, '#3b82f6', NOW(), NOW())
            ON CONFLICT (email) DO NOTHING
            RETURNING email
        """))

        conn.commit()

        inserted = result.fetchall()
        if inserted:
            print(f"[OK] Created {len(inserted)} users:")
            for row in inserted:
                print(f"  - {row[0]}")
        else:
            print("[INFO] Users already exist, skipping...")

        print("\n[2/2] Verifying users...")
        result = conn.execute(text("SELECT email, system_role, is_active FROM users"))
        users = result.fetchall()

        print(f"[OK] Total users in database: {len(users)}")
        for user in users:
            print(f"  - {user[0]} (role: {user[1]}, active: {user[2]})")

        print("\n[SUCCESS] Platform DB initialized successfully!")
        print("\nTest credentials:")
        print("  - admin@example.com / admin123 (admin)")
        print("  - user@example.com / admin123 (user)")

except Exception as e:
    print(f"\n[ERROR] Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 80)
