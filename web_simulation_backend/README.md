# Web Simulation Backend

This backend serves a web-based grid navigation simulation using DQN models. It exposes REST APIs to:
- Fetch grid and resource data
- Step through agent(s) navigation
- Reset/start new simulations

## Tech Stack
- Python 3
- FastAPI (for REST API)
- Torch (for DQN models)
- Uvicorn (for running the server)

## Usage
1. Install dependencies: `pip install -r requirements.txt`
2. Run the server: `uvicorn main:app --reload`
3. Connect a frontend or use the API directly. 