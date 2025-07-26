from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import torch
import json
import numpy as np
import os
from fastapi.middleware.cors import CORSMiddleware
from typing import List

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Load Resource Data ---
SCALE = 100
json_path = os.path.join(os.path.dirname(__file__), "..", "extracted_data.json")
with open(json_path, "r") as f:
    extracted_data = json.load(f)

resource_cells = []
for name, data in extracted_data.items():
    x = int(float(data['x_coordinate']) * SCALE)
    y = int(float(data['y_coordinate']) * SCALE)
    resource_cells.append((x, y))

min_x = min(x for x, y in resource_cells)
min_y = min(y for x, y in resource_cells)
adjusted_resources = [(x - min_x, y - min_y) for x, y in resource_cells]

GRID_SIZE_X = max(x for x, y in adjusted_resources) + 1
GRID_SIZE_Y = max(y for x, y in adjusted_resources) + 1

# --- DQN Model ---
class DQN(torch.nn.Module):
    def __init__(self, state_size, action_size):
        super(DQN, self).__init__()
        self.fc1 = torch.nn.Linear(state_size, 128)
        self.relu = torch.nn.ReLU()
        self.fc2 = torch.nn.Linear(128, action_size)

    def forward(self, x):
        x = self.relu(self.fc1(x))
        return self.fc2(x)

# --- Simulation State ---
class SimulationState(BaseModel):
    agent_pos: list
    path: list
    goal_pos: list

# Global simulation state (single agent for now)
sim_state = {
    "agent_pos": [0, 0],
    "path": [[0, 0]],
    "goal_pos": [GRID_SIZE_X - 1, GRID_SIZE_Y - 1]
}

# Load model
model_path = os.path.join(os.path.dirname(__file__), "..", "grid_model.pth")
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
state_size = GRID_SIZE_X * GRID_SIZE_Y
action_size = 2
model = DQN(state_size, action_size).to(device)
model.load_state_dict(torch.load(model_path, map_location=device))
model.eval()

# --- API Endpoints ---
@app.get("/grid")
def get_grid():
    return {
        "grid_size_x": GRID_SIZE_X,
        "grid_size_y": GRID_SIZE_Y,
        "resources": adjusted_resources
    }

@app.get("/state")
def get_state():
    return sim_state

@app.post("/step")
def step():
    ax, ay = sim_state["agent_pos"]
    goal_pos = sim_state["goal_pos"]
    path = sim_state["path"]
    state = ay * GRID_SIZE_X + ax
    state_tensor = torch.eye(state_size)[state].unsqueeze(0).to(device)
    with torch.no_grad():
        q_values = model(state_tensor)
        action = torch.argmax(q_values).item()
    # Move agent
    if action == 0 and ay < GRID_SIZE_Y - 1:
        ay += 1  # UP
    elif action == 1 and ax < GRID_SIZE_X - 1:
        ax += 1  # RIGHT
    sim_state["agent_pos"] = [ax, ay]
    if [ax, ay] not in path:
        path.append([ax, ay])
    sim_state["path"] = path
    return sim_state

@app.post("/reset")
def reset():
    sim_state["agent_pos"] = [0, 0]
    sim_state["path"] = [[0, 0]]
    sim_state["goal_pos"] = [GRID_SIZE_X - 1, GRID_SIZE_Y - 1]
    return sim_state

@app.get("/models", response_model=List[str])
def list_models():
    # List all .pth files in the project root
    model_files = [f for f in os.listdir(os.path.join(os.path.dirname(__file__), "..")) if f.endswith('.pth')]
    return model_files

@app.post("/set_model")
async def set_model(request: Request):
    data = await request.json()
    model_name = data.get("model_name")
    model_path_new = os.path.join(os.path.dirname(__file__), "..", model_name)
    if not os.path.exists(model_path_new):
        raise HTTPException(status_code=404, detail="Model not found")
    global model, model_path
    model_path = model_path_new
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.eval()
    # Reset simulation state
    sim_state["agent_pos"] = [0, 0]
    sim_state["path"] = [[0, 0]]
    sim_state["goal_pos"] = [GRID_SIZE_X - 1, GRID_SIZE_Y - 1]
    return {"success": True, "model": model_name} 