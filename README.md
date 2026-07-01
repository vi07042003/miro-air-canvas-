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

---

## 🔑 Gemini AI Sketch Analysis Setup

AeroCanvas uses Google Gemini (via `gemini-2.5-flash-lite`) to perform high-fidelity, real-time AI sketch analysis.

### 1. How to get a Gemini API Key:
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click on **Create API Key**.
4. Copy your generated API key.

### 2. How to configure the key:
You can configure the Gemini API Key in two ways:

#### Option A: Inside the App UI (Recommended)
1. Launch AeroCanvas and navigate to **Doodle Art**.
2. Scroll to the bottom of the drawing board to the **API Key** configuration panel.
3. Click **Configure Key**, paste your Gemini API key, and click **Save**.
4. The system will automatically validate the key with Google and save it to the backend environment dynamically.

#### Option B: Via `.env` File
1. In the `backend/` directory, create or open the `.env` file.
2. Add the following line:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```
3. Save the file. The backend will automatically detect and reload the key.

> [!NOTE]
> If no Gemini API Key is configured, AeroCanvas will automatically run on **Secondary Fallback Mode** (using free Hugging Face BLIP or Pollinations AI vision models). While functional, sketch recognition accuracy may be lower.
