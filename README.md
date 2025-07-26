# DQN Grid Simulation Web App

This project is a full-stack web-based visualization of a DQN agent navigating a grid of resources ("books") using a trained PyTorch model. It allows you to run, visualize, and interact with the agent's pathfinding in your browser, using real data from `extracted_data.json` and a DQN model checkpoint.

---

## Features
- **Backend (FastAPI, Python):**
  - Serves grid/resource data from `extracted_data.json`.
  - Loads a DQN model (`model1.pth`, `model2.pth`, etc.) to control agent movement.
  - Exposes REST API endpoints to step/reset the simulation and fetch state.
  - CORS enabled for frontend communication.

- **Frontend (React, JS):**
  - Visualizes the grid, resources (books), agent (red), and goal (green).
  - Step and Reset controls for interactive simulation.
  - Fetches and displays real-time state from the backend.

---

## Project Structure

```
NL-simulation-1/
├── extracted_data.json         # Resource (book) coordinates
├── model1.pth, model2.pth     # DQN model checkpoints
├── web_simulation_backend/    # FastAPI backend
│   ├── main.py
│   ├── requirements.txt
│   └── ...
├── web_simulation_frontend/   # React frontend
│   ├── src/App.js
│   ├── package.json
│   └── ...
└── ...
```

---

## Setup & Usage

### 1. Backend (FastAPI)

#### a. Install dependencies
```bash
pip install -r web_simulation_backend/requirements.txt
```

#### b. Run the backend server
```bash
python -m uvicorn web_simulation_backend.main:app --reload
```
- The backend will be available at [http://localhost:8000](http://localhost:8000)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Frontend (React)

#### a. Install dependencies
```bash
cd web_simulation_frontend
npm install
```

#### b. Start the frontend
```bash
npm start
```
- The frontend will be available at [http://localhost:3000](http://localhost:3000)

---

## How It Works
- **Resource Data:** Loaded from `extracted_data.json` and normalized to grid coordinates.
- **DQN Model:** Loaded from a `.pth` file; used to decide agent's next move (UP/RIGHT).
- **Simulation State:** Maintained on the backend; includes agent position, path, and goal.
- **API Endpoints:**
  - `GET /grid` — Grid size and resource locations
  - `GET /state` — Current agent position, path, and goal
  - `POST /step` — Advance the agent by one step
  - `POST /reset` — Reset the simulation
- **Frontend:** Draws the grid, books, agent, and goal; interacts with backend via REST API.

---

## Example Usage
1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. Click **Step** to move the agent according to the DQN model.
3. Click **Reset** to restart the simulation.
4. Watch the agent's path and how it interacts with the resources (books).

---


## Troubleshooting
- If you see CORS errors, ensure backend is running with CORS enabled (already set in `main.py`).
- If ports are busy, stop other servers or use alternate ports.
- For model loading errors, ensure the `.pth` file matches the DQN architecture.

 
