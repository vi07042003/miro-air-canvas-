"""
AeroCanvas PostgreSQL Database Setup Script
Run this ONCE after installing PostgreSQL to create the aerocanvas database.
Usage:
    python setup_db.py
    python setup_db.py --password yourpassword
"""

import sys
import argparse
import os

def main():
    parser = argparse.ArgumentParser(description="Create the aerocanvas PostgreSQL database")
    parser.add_argument("--host", default="localhost", help="PostgreSQL host (default: localhost)")
    parser.add_argument("--port", default="5432", help="PostgreSQL port (default: 5432)")
    parser.add_argument("--user", default="postgres", help="PostgreSQL superuser (default: postgres)")
    parser.add_argument("--password", default=None, help="PostgreSQL password")
    parser.add_argument("--dbname", default="aerocanvas", help="Database name to create (default: aerocanvas)")
    args = parser.parse_args()

    # Ask for password if not supplied
    password = args.password
    if password is None:
        import getpass
        password = getpass.getpass(f"Enter password for PostgreSQL user '{args.user}': ")

    # Connect to default 'postgres' database to create our new one
    try:
        import psycopg2
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

        conn = psycopg2.connect(
            host=args.host,
            port=args.port,
            user=args.user,
            password=password,
            dbname="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        # Check if database already exists
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (args.dbname,))
        if cursor.fetchone():
            print(f"✅ Database '{args.dbname}' already exists.")
        else:
            cursor.execute(f'CREATE DATABASE "{args.dbname}"')
            print(f"✅ Database '{args.dbname}' created successfully!")

        cursor.close()
        conn.close()

        # Build the connection URL and write to .env
        db_url = f"postgresql://{args.user}:{password}@{args.host}:{args.port}/{args.dbname}"
        env_path = os.path.join(os.path.dirname(__file__), ".env")
        
        # Write to .env
        lines = []
        found = False
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                lines = f.readlines()
            for i, line in enumerate(lines):
                if line.startswith("DATABASE_URL="):
                    lines[i] = f"DATABASE_URL={db_url}\n"
                    found = True
                    break
        
        if not found:
            lines.append(f"DATABASE_URL={db_url}\n")
        
        with open(env_path, "w") as f:
            f.writelines(lines)
        
        print(f"✅ Connection URL saved to backend/.env")
        print(f"\n   DATABASE_URL={db_url}")
        print(f"\n🚀 Now restart the backend server and all tables will be created automatically!")

    except ImportError:
        print("❌ psycopg2 is not installed. Run: pip install psycopg2-binary")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Failed to connect to PostgreSQL: {e}")
        print("\n💡 Make sure:")
        print("   1. PostgreSQL service is running (check Windows Services)")
        print("   2. Your password is correct")
        print("   3. PostgreSQL is on port 5432")
        sys.exit(1)

if __name__ == "__main__":
    main()
