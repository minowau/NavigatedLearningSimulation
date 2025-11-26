from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import torch
import json
import numpy as np
import os
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional


# Load resource data from JSON file
resource_data_path = os.path.join(os.path.dirname(__file__), "..", "extracted_data.json")
with open(resource_data_path, "r") as f:
    resource_data = json.load(f)

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
# Convert resource positions to the format used in the simulation
adjusted_resources = [[x - min_x, y - min_y] for x, y in resource_cells]

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
    reward: int = 0

# Global simulation state with multiple agents (one per model)
sim_states = {}
active_models = []

# Device configuration
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
state_size = GRID_SIZE_X * GRID_SIZE_Y
action_size = 2

# Models dictionary to store loaded models
models = {}

# --- Helpers: robust model loading ---
def _strip_prefix_from_state_dict_keys(state_dict: Dict[str, Any], prefix: str) -> Dict[str, Any]:
    if all(k.startswith(prefix) for k in state_dict.keys()):
        return {k[len(prefix):]: v for k, v in state_dict.items()}
    return state_dict

def _normalize_state_dict_keys(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    # Handle common wrappers and prefixes (e.g., DataParallel 'module.')
    normalized = _strip_prefix_from_state_dict_keys(state_dict, "module.")

    # Map some common layer naming schemes to our DQN's 'fc1' and 'fc2'
    key_map = {
        "layers.0.weight": "fc1.weight",
        "layers.0.bias": "fc1.bias",
        "layers.2.weight": "fc2.weight",
        "layers.2.bias": "fc2.bias",
        "linear1.weight": "fc1.weight",
        "linear1.bias": "fc1.bias",
        "linear2.weight": "fc2.weight",
        "linear2.bias": "fc2.bias",
    }

    remapped = {}
    for k, v in normalized.items():
        target_key = key_map.get(k, k)
        remapped[target_key] = v
    return remapped

def _load_weights_into_model(model: torch.nn.Module, weights: Dict[str, Any]) -> bool:
    try:
        normalized = _normalize_state_dict_keys(weights)
        # Convert numpy arrays to tensors if needed
        for k, v in list(normalized.items()):
            if isinstance(v, np.ndarray):
                normalized[k] = torch.from_numpy(v)
        missing, unexpected = model.load_state_dict(normalized, strict=False)
        if missing:
            print(f"Warning: missing keys when loading model: {missing}")
        if unexpected:
            print(f"Warning: unexpected keys when loading model: {unexpected}")
        return True
    except Exception as e:
        print(f"Failed to load weights into model: {e}")
        return False

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
    return {
        "active_models": active_models,
        "states": sim_states
    }

@app.post("/step")
async def step():
    # Initialize ensemble voting
    action_votes = {0: 0, 1: 0}  # 0: UP, 1: RIGHT
    ensemble_pos = None
    
    # If ensemble state doesn't exist yet, create it
    if "ensemble" not in sim_states and active_models:
        # Initialize ensemble state with the same structure as model states
        # but with its own path tracking
        first_model = next(iter(active_models))
        if first_model in sim_states:
            sim_states["ensemble"] = {
                "agent_pos": sim_states[first_model]["agent_pos"].copy(),
                "path": [sim_states[first_model]["agent_pos"].copy()],
                "goal_pos": sim_states[first_model]["goal_pos"].copy(),
                "reward": 0
            }
    
    results = {}
    # First pass: collect votes from all models
    for model_name in active_models:
        if model_name not in models or model_name not in sim_states:
            continue
            
        model = models[model_name]
        sim_state = sim_states[model_name]
        
        ax, ay = sim_state["agent_pos"]
        goal_pos = sim_state["goal_pos"]
        path = sim_state["path"]
        state = int(ay) * GRID_SIZE_X + int(ax)
        state_tensor = torch.eye(state_size)[state].unsqueeze(0).to(device)
        
        with torch.no_grad():
            q_values = model(state_tensor)
            action = torch.argmax(q_values).item()
        
        # Add vote for this model's preferred action
        action_votes[action] += 1
            
        # Calculate if agent has reached goal
        goal_reached = (ax == sim_state["goal_pos"][0] and ay == sim_state["goal_pos"][1])
        
        # Move agent only if not at goal
        if not goal_reached:
            if action == 0 and ay < GRID_SIZE_Y - 1:
                ay += 1  # UP
            elif action == 1 and ax < GRID_SIZE_X - 1:
                ax += 1  # RIGHT
            
        sim_state["agent_pos"] = [ax, ay]
        if [ax, ay] not in path:
            path.append([ax, ay])
            # Check if agent found a resource (book)
            if [ax, ay] in adjusted_resources:
                # Find which resource was found based on position
                for resource_name, data in resource_data.items():
                    # Convert coordinates to grid positions
                    x_coord = float(data["x_coordinate"])
                    y_coord = float(data["y_coordinate"])
                    
                    # Scale coordinates to grid positions (approximate)
                    grid_x = int(x_coord * GRID_SIZE_X)
                    grid_y = int(y_coord * GRID_SIZE_Y)
                    
                    # If agent position matches this resource's position
                    if ax == grid_x and ay == grid_y:
                        # Calculate reward based on coordinates
                        reward_value = int((x_coord + y_coord) * 50)
                        reward_value = min(10, reward_value)
                        sim_state["reward"] += reward_value
                        break
                else:
                    # Default reward if no specific resource match found
                    sim_state["reward"] += 10
                
        sim_state["path"] = path
        sim_states[model_name] = sim_state
        results[model_name] = sim_state
    
    # Second pass: determine winning action by voting for ensemble agent
    if "ensemble" in sim_states and active_models:
        # Get ensemble state
        ensemble_state = sim_states["ensemble"]
        ex, ey = ensemble_state["agent_pos"]
        ensemble_path = ensemble_state["path"]
        
        # Calculate if ensemble agent has reached goal
        goal_reached = (ex == ensemble_state["goal_pos"][0] and ey == ensemble_state["goal_pos"][1])
        
        # Determine winning action (soft voting)
        if not goal_reached:
            winning_action = max(action_votes.items(), key=lambda kv: kv[1])[0]
            
            # Move ensemble agent according to winning action
            if winning_action == 0 and ey < GRID_SIZE_Y - 1:
                ey += 1  # UP
            elif winning_action == 1 and ex < GRID_SIZE_X - 1:
                ex += 1  # RIGHT
            
            # Update ensemble position and path
            ensemble_state["agent_pos"] = [ex, ey]
            if [ex, ey] not in ensemble_path:
                ensemble_path.append([ex, ey])
                # Check if ensemble agent found a resource
                if [ex, ey] in adjusted_resources:
                    # Find which resource was found based on position
                    for resource_name, data in resource_data.items():
                        # Convert coordinates to grid positions
                        x_coord = float(data["x_coordinate"])
                        y_coord = float(data["y_coordinate"])
                        
                        # Scale coordinates to grid positions (approximate)
                        grid_x = int(x_coord * GRID_SIZE_X)
                        grid_y = int(y_coord * GRID_SIZE_Y)
                        
                        # If agent position matches this resource's position
                        if ex == grid_x and ey == grid_y:
                            # Calculate reward based on coordinates
                            reward_value = int((x_coord + y_coord) * 50)
                            reward_value = max(10, reward_value)
                            ensemble_state["reward"] += reward_value
                            break
                    else:
                        # Default reward if no specific resource match found
                        ensemble_state["reward"] += 10
            
            ensemble_state["path"] = ensemble_path
            sim_states["ensemble"] = ensemble_state
            results["ensemble"] = ensemble_state
        
    return {
        "active_models": active_models,
        "states": sim_states
    }

@app.post("/reset")
def reset():
    for model_name in active_models:
        if model_name in sim_states:
            sim_states[model_name] = {
                "agent_pos": [0, 0],
                "path": [[0, 0]],
                "goal_pos": [GRID_SIZE_X - 1, GRID_SIZE_Y - 1],
                "reward": 0
            }
        if 'ensemble' in sim_states:
            sim_states['ensemble'] = {
                "agent_pos": [0, 0],
                "path": [[0, 0]],
                "goal_pos": [GRID_SIZE_X - 1, GRID_SIZE_Y - 1],
                "reward": 0
            }
            
    
    return {
        "active_models": active_models,
        "states": sim_states
    }

@app.get("/models", response_model=List[str])
def list_models():
    # List all .pth files in the project root
    model_files = [f for f in os.listdir(os.path.join(os.path.dirname(__file__), "..")) if f.endswith('.pth') or f.endswith('.npz')]
    return model_files
    

@app.post("/set_active_models")
async def set_active_models(request: Request):
    data = await request.json()
    model_names = data.get("model_names", [])
    
    global active_models, models, sim_states
    active_models = []
    
    for model_name in model_names:
        model_path = os.path.join(os.path.dirname(__file__), "..", model_name)
        if not os.path.exists(model_path):
            continue
            
        # Load model if not already loaded
        if model_name not in models:
            try:
                model = DQN(state_size, action_size).to(device)
                loaded_ok = False

                ext = os.path.splitext(model_path)[1].lower()
                if ext == ".npz":
                    try:
                        npz = np.load(model_path, allow_pickle=True)
                        weights = {k: npz[k] for k in npz.files}
                        loaded_ok = _load_weights_into_model(model, weights)
                    except Exception as e:
                        print(f"Error loading npz model {model_name}: {e}")
                        loaded_ok = False
                else:
                    try:
                        obj = torch.load(model_path, map_location=device)
                        # Case 1: raw state_dict
                        if isinstance(obj, dict):
                            # Some checkpoints use {'state_dict': ...}
                            if "state_dict" in obj and isinstance(obj["state_dict"], dict):
                                loaded_ok = _load_weights_into_model(model, obj["state_dict"])
                            else:
                                loaded_ok = _load_weights_into_model(model, obj)
                        # Case 2: full nn.Module saved
                        elif hasattr(obj, "state_dict"):
                            loaded_ok = _load_weights_into_model(model, obj.state_dict())
                        else:
                            loaded_ok = False
                    except Exception as e:
                        print(f"Error loading pth model {model_name}: {e}")
                        loaded_ok = False

                if not loaded_ok:
                    print(f"Using randomly initialized weights for {model_name} (could not load).")
                model.eval()
                models[model_name] = model
            except Exception as e:
                print(f"Error loading model {model_name}: {e}")
                # Create a dummy model that can still be used
                model = DQN(state_size, action_size).to(device)
                model.eval()
                models[model_name] = model
            
        # Initialize or reset simulation state for this model
        sim_states[model_name] = {
            "agent_pos": [0, 0],
            "path": [[0, 0]],
            "goal_pos": [GRID_SIZE_X - 1, GRID_SIZE_Y - 1],
            "reward": 0
        }
        
        active_models.append(model_name)
    
    return {
        "success": True,
        "active_models": active_models,
        "states": sim_states
    }
