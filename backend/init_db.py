"""Initialize Platform DB with test users."""
import sys
from sqlalchemy import create_engine, text
from app.core.config import settings
from app.core.security import get_password_hash

# Create engine for Platform DB
engine = create_engine(
    f"postgresql://{settings.PLATFORM_DB_USER}:{settings.PLATFORM_DB_PASSWORD}@{settings.PLATFORM_DB_HOST}:{settings.PLATFORM_DB_PORT}/{settings.PLATFORM_DB_NAME}"
)

print("=" * 80)
print("Initializing Platform DB with test users")
print("=" * 80)

try:
    with engine.connect() as conn:
        print("\n[1/3] Checking/Creating users table...")

        # Create users table if not exists
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                hashed_password VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                company VARCHAR(100),
                company_custom VARCHAR(255),
                division VARCHAR(100),
                division_custom VARCHAR(255),
                department VARCHAR(255),
                organization_id INTEGER,
                phone_number VARCHAR(50),
                bio TEXT,
                system_role VARCHAR(11) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                avatar_name VARCHAR(100),
                badge_color VARCHAR(20),
                password_reset_token VARCHAR(255),
                password_reset_expires TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        conn.commit()
        print("[OK] Users table ready")

        print("\n[2/3] Creating test users...")

        # Insert test users
        # Password: 'admin123' - hash generated using get_password_hash with 72-byte truncation
        admin_password_hash = get_password_hash("admin123")
        result = conn.execute(
            text("""
            INSERT INTO users (email, hashed_password, full_name, system_role, is_active, badge_color, created_at, updated_at)
            VALUES
                ('admin@example.com', :admin_hash, 'Admin User', 'admin', TRUE, '#9333ea', NOW(), NOW()),
                ('user@example.com', :user_hash, 'Test User', 'user', TRUE, '#3b82f6', NOW(), NOW())
            ON CONFLICT (email) DO NOTHING
            RETURNING email
            """),
            {"admin_hash": admin_password_hash, "user_hash": admin_password_hash}
        )

        conn.commit()

        inserted = result.fetchall()
        if inserted:
            print(f"[OK] Created {len(inserted)} users:")
            for row in inserted:
                print(f"  - {row[0]}")
        else:
            print("[INFO] Users already exist, skipping...")

        print("\n[3/3] Verifying users...")
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
