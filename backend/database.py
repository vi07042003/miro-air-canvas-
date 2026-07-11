import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv, set_key

# Load environment variables from .env
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
if not os.path.exists(dotenv_path):
    with open(dotenv_path, "w") as f:
        pass
load_dotenv(dotenv_path)

# Default to PostgreSQL — change password if yours is different
DEFAULT_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/aerocanvas"
)

def get_engine(url):
    """Create SQLAlchemy engine. PostgreSQL needs no special connect args."""
    return create_engine(url, pool_pre_ping=True)

# Global engine & session
engine = get_engine(DEFAULT_DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """FastAPI dependency to yield a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Create all tables defined in models. Safe to call on every startup."""
    from models import Base
    import time
    
    max_retries = 10
    retry_delay = 2
    for attempt in range(max_retries):
        try:
            Base.metadata.create_all(bind=engine)
            break
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"[ERROR] Failed to initialize database after {max_retries} attempts: {e}")
                raise
            print(f"[WARNING] Database not ready yet or DNS resolving (attempt {attempt + 1}/{max_retries}). Retrying in {retry_delay}s...")
            time.sleep(retry_delay)

    try:
        # Safe migration: add profile_picture and stencil_usage_count columns to users table if not exist
        with engine.begin() as conn:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;"))
            except Exception:
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN profile_picture TEXT;"))
                except Exception:
                    pass
            
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS stencil_usage_count INTEGER DEFAULT 0;"))
            except Exception:
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN stencil_usage_count INTEGER DEFAULT 0;"))
                except Exception:
                    pass

            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS stencil_reset_time TIMESTAMP;"))
            except Exception:
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN stencil_reset_time TIMESTAMP;"))
                except Exception:
                    pass

            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_sketch_usage_count INTEGER DEFAULT 0;"))
            except Exception:
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN ai_sketch_usage_count INTEGER DEFAULT 0;"))
                except Exception:
                    pass

            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_sketch_reset_time TIMESTAMP;"))
            except Exception:
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN ai_sketch_reset_time TIMESTAMP;"))
                except Exception:
                    pass

            # Safe migrations for drawings table
            try:
                conn.execute(text("ALTER TABLE drawings ADD COLUMN IF NOT EXISTS canvas_mode VARCHAR(20) DEFAULT '2d';"))
            except Exception:
                try:
                    conn.execute(text("ALTER TABLE drawings ADD COLUMN canvas_mode VARCHAR(20) DEFAULT '2d';"))
                except Exception:
                    pass

            try:
                conn.execute(text("ALTER TABLE drawings ADD COLUMN IF NOT EXISTS threed_objects TEXT;"))
            except Exception:
                try:
                    conn.execute(text("ALTER TABLE drawings ADD COLUMN threed_objects TEXT;"))
                except Exception:
                    pass
        print("[SUCCESS] Database tables ready.")
    except Exception as e:
        print(f"[ERROR] Failed to initialize database: {e}")
        raise

def test_connection(url):
    """Test a connection URL without affecting the global engine."""
    try:
        test_engine = create_engine(url, pool_pre_ping=True)
        with test_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, "Connection successful"
    except Exception as e:
        return False, str(e)

def update_db_config(url):
    """Persist a new DATABASE_URL to .env and reload the global engine."""
    global engine, SessionLocal
    success, msg = test_connection(url)
    if not success:
        return False, msg
    try:
        set_key(dotenv_path, "DATABASE_URL", url)
        os.environ["DATABASE_URL"] = url
        engine = get_engine(url)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        init_db()
        return True, "Database updated and connected."
    except Exception as e:
        return False, str(e)
