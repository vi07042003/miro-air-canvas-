#!/bin/bash

# Exit on error
set -e

# Colors for terminal styling
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}               AeroCanvas Launcher                 ${NC}"
echo -e "${BLUE}===================================================${NC}"
echo

# Helper to check if a command is available
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Determine Docker Compose command
DOCKER_COMPOSE_CMD=""
if command_exists docker; then
  if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
  elif command_exists docker-compose; then
    DOCKER_COMPOSE_CMD="docker-compose"
  fi
fi

if [ -n "$DOCKER_COMPOSE_CMD" ]; then
  echo -e "${GREEN}[INFO] Docker and Docker Compose detected!${NC}"
  echo -e "${GREEN}[INFO] Launching AeroCanvas with Docker Compose...${NC}"
  echo -e "${YELLOW}[TIP] If you need to force a rebuild (e.g. after changing package.json or requirements.txt), run: ./run.sh --build${NC}"
  echo -e "${YELLOW}[TIP] To use Docker Compose Watch for real-time development sync, run: ./run.sh --watch${NC}"
  echo

  if [ "$1" == "--build" ]; then
    $DOCKER_COMPOSE_CMD up --build
  elif [ "$1" == "--watch" ]; then
    $DOCKER_COMPOSE_CMD -f docker-compose.yml -f docker-compose.dev.yml up --watch
  else
    # Run without --build to avoid registry connection/certificate issues.
    # Docker compose will still build automatically if local images do not exist.
    $DOCKER_COMPOSE_CMD up
  fi
else
  echo -e "${YELLOW}[WARNING] Docker / Docker Compose was not found.${NC}"
  echo -e "${YELLOW}[WARNING] To run with Docker (recommended for Linux), please install Docker Engine / Desktop.${NC}"
  echo -e "${YELLOW}[INFO] Attempting fallback local execution (requires local Python, Node, & Postgres)...${NC}"
  echo
  
  # Check for Python
  if ! command_exists python3; then
    echo -e "${RED}[ERROR] Python3 is not installed or not in your PATH.${NC}"
    exit 1
  fi

  # Check for Node.js
  if ! command_exists npm; then
    echo -e "${RED}[ERROR] Node.js/NPM is not installed or not in your PATH.${NC}"
    exit 1
  fi
  
  # Setup local Python virtual environment & start backend
  echo -e "${BLUE}[INFO] Starting FastAPI Backend on port 8000...${NC}"
  cd backend
  if [ ! -d "venv" ]; then
    python3 -m venv venv
  fi
  source venv/bin/activate
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000 &
  BACKEND_PID=$!
  cd ..
  
  # Ensure backend process is killed when the script exits
  cleanup() {
    echo -e "\n${BLUE}[INFO] Shutting down backend...${NC}"
    kill "$BACKEND_PID" 2>/dev/null || true
  }
  trap cleanup EXIT
  
  # Setup and start local Node frontend
  echo -e "${BLUE}[INFO] Starting Vite Frontend on port 5173...${NC}"
  cd frontend
  npm install
  npm run dev
fi
