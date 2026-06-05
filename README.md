# AeroCanvas 🎨

A secure, collaborative air canvas drawing application built with FastAPI (backend) and React + Vite (frontend), powered by PostgreSQL.

---

## 🚀 Getting Started (Quick Start with Docker)

The recommended way to run this project is using **Docker** and **Docker Compose**. This makes it fully compatible with Linux, macOS, and Windows without needing to manually install Python, Node.js, or PostgreSQL.

### Prerequisites
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) or [Docker Engine](https://docs.docker.com/engine/install/)
- Ensure Docker daemon is running

### Starting the Project

1. **Clone the repository** and navigate to the project directory:
   ```bash
   cd miro-air-canvas-
   ```

2. **Run the launcher script**:
   - On **Linux / macOS**:
     ```bash
     ./run.sh
     ```
   - On **Windows**:
     ```bash
     docker compose up --build
     ```

This will automatically pull/build and spin up:
- **Frontend**: Available at [http://localhost:5173](http://localhost:5173) (with HMR / Hot Module Replacement)
- **Backend API**: Available at [http://localhost:8000](http://localhost:8000) (with reload enabled)
- **PostgreSQL Database**: Port `5432` mapped to host, state persisted in the `postgres_data` volume

---

## 🛠️ Local Development (Alternative/Fallback)

If you prefer to run the application directly on your host machine without Docker:

### Prerequisites
- **Python 3.8+**
- **Node.js 18+** & **npm**
- **PostgreSQL** instance running on `localhost:5432` with a database named `miro` (user: `postgres`, password: `postgres` or updated in `backend/.env`)

### Running the App Locally

#### 1. Setup Database
Ensure PostgreSQL is running, then set up the schema:
```bash
cd backend
pip install -r requirements.txt
python setup_db.py
```

#### 2. Run both Backend & Frontend
You can launch both services using the provided automation scripts:
- On **Linux / macOS**:
  ```bash
  ./run.sh
  ```
  *(If Docker isn't running, it will automatically fallback to local execution mode, set up a Python virtual environment, install packages, and run the servers).*
  
- On **Windows**:
  ```cmd
  run.bat
  ```

---

## 📁 Project Structure

```
miro-air-canvas-/
├── backend/                  # FastAPI Application
│   ├── main.py               # API Router and Auth Handlers
│   ├── database.py           # SQLAlchemy Connection Setup
│   ├── models.py             # DB Tables (User, Drawing, Setting)
│   ├── requirements.txt      # Python Dependencies
│   └── Dockerfile            # Container build for Backend
├── frontend/                 # React + Vite Application
│   ├── src/                  # Components, Hooks, Styling
│   ├── package.json          # Node Dependencies & Scripts
│   ├── vite.config.js        # Vite Config (mapped for Docker)
│   └── Dockerfile            # Container build for Frontend
├── docker-compose.yml        # Service Orchestration (App & DB)
├── run.sh                    # Linux/macOS Startup Script
└── run.bat                   # Windows Startup Script
```

---

## 🔒 Environment Configurations

Environment variables are loaded automatically:
- **Backend Database**: Defined in `DATABASE_URL` within `backend/.env`. When run via Docker Compose, this is overridden automatically to direct traffic through the Docker database network bridge (`db`).
- **JWT Secret Key**: Defined in `JWT_SECRET_KEY` inside `backend/main.py` (or overridden in `docker-compose.yml`).
