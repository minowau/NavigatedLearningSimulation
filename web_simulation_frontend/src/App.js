import React, { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';
import Controls from './Controls';

const BACKEND_URL = 'http://localhost:8000'; // Change if backend runs elsewhere

function App() {
  const canvasRef = useRef(null);
  const [grid, setGrid] = useState({ grid_size_x: 10, grid_size_y: 10, resources: [] });
  const [simulationData, setSimulationData] = useState({ active_models: [], states: {} });
  const [models, setModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const playInterval = useRef(null);
  const CELL_SIZE = 32;
  const MARGIN = 2;
  
  // Model colors for visualization
  const MODEL_COLORS = {
    0: '#FF0000', // Red
    1: '#0000FF', // Blue
    2: '#00FF00', // Green
    3: '#FF00FF', // Magenta
    4: '#00FFFF', // Cyan
    5: '#FFA500', // Orange
    6: '#800080', // Purple
    7: '#008000', // Dark Green
    8: '#000080', // Navy
    9: '#800000', // Maroon
  };

  // Fetch grid info and models on mount
  useEffect(() => {
    fetch(`${BACKEND_URL}/grid`).then(res => res.json()).then(setGrid);
    fetch(`${BACKEND_URL}/state`).then(res => res.json()).then(setSimulationData);
    fetch(`${BACKEND_URL}/models`).then(res => res.json()).then(models => {
      setModels(models);
      if (models.length > 0) {
        const initialModel = models[0];
        setSelectedModels([initialModel]);
        updateActiveModels([initialModel]);
      }
    });
  }, []);

  // Draw grid, resources, agents
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid cells
    for (let x = 0; x < grid.grid_size_x; x++) {
      for (let y = 0; y < grid.grid_size_y; y++) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(
          x * (CELL_SIZE + MARGIN),
          (grid.grid_size_y - 1 - y) * (CELL_SIZE + MARGIN),
          CELL_SIZE, CELL_SIZE
        );
        ctx.strokeStyle = '#ccc';
        ctx.strokeRect(
          x * (CELL_SIZE + MARGIN),
          (grid.grid_size_y - 1 - y) * (CELL_SIZE + MARGIN),
          CELL_SIZE, CELL_SIZE
        );
      }
    }
    
    // Draw resources
    for (const [rx, ry] of grid.resources) {
      ctx.fillStyle = '#222';
      ctx.font = '20px sans-serif';
      ctx.fillText('📚',
        rx * (CELL_SIZE + MARGIN) + 6,
        (grid.grid_size_y - 1 - ry) * (CELL_SIZE + MARGIN) + 24
      );
    }
    
    // Draw goal (same for all agents)
    let goalPos = [grid.grid_size_x - 1, grid.grid_size_y - 1];
    if (simulationData.active_models.length > 0 && 
        simulationData.states[simulationData.active_models[0]]) {
      goalPos = simulationData.states[simulationData.active_models[0]].goal_pos;
    }
    
    const [gx, gy] = goalPos;
    ctx.fillStyle = '#0a0';
    ctx.fillRect(
      gx * (CELL_SIZE + MARGIN),
      (grid.grid_size_y - 1 - gy) * (CELL_SIZE + MARGIN),
      CELL_SIZE, CELL_SIZE
    );
    
    // Draw paths and agents for each active model
    simulationData.active_models.forEach((modelName, index) => {
      const modelState = simulationData.states[modelName];
      if (!modelState) return;
      
      // Draw path with different colors for each step
      const colorIndex = index % Object.keys(MODEL_COLORS).length;
      const pathColor = MODEL_COLORS[colorIndex];
      
      // Draw path with gradient colors
      modelState.path.forEach((pos, stepIndex) => {
        const [px, py] = pos;
        const gradientIntensity = 0.3 + (0.7 * stepIndex / Math.max(modelState.path.length, 1));
        const r = parseInt(pathColor.slice(1, 3), 16);
        const g = parseInt(pathColor.slice(3, 5), 16);
        const b = parseInt(pathColor.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${gradientIntensity})`;
        
        ctx.fillRect(
          px * (CELL_SIZE + MARGIN),
          (grid.grid_size_y - 1 - py) * (CELL_SIZE + MARGIN),
          CELL_SIZE, CELL_SIZE
        );
      });
      
      // Draw agent
      const [ax, ay] = modelState.agent_pos;
      ctx.fillStyle = pathColor;
      ctx.beginPath();
      ctx.arc(
        ax * (CELL_SIZE + MARGIN) + CELL_SIZE / 2,
        (grid.grid_size_y - 1 - ay) * (CELL_SIZE + MARGIN) + CELL_SIZE / 2,
        CELL_SIZE / 2 - 4, 0, 2 * Math.PI
      );
      ctx.fill();
      
      // Add model name label
      ctx.fillStyle = 'black';
      ctx.font = '10px sans-serif';
      ctx.fillText(
        modelName.substring(0, 8),
        ax * (CELL_SIZE + MARGIN),
        (grid.grid_size_y - 1 - ay) * (CELL_SIZE + MARGIN) - 2
      );
    });
  }, [grid, simulationData, CELL_SIZE, MARGIN, MODEL_COLORS]);

  // Step simulation
  const handleStep = useCallback(() => {
    fetch(`${BACKEND_URL}/step`, { method: 'POST' })
      .then(res => res.json())
      .then(setSimulationData);
  }, []);

  // Reset simulation
  const handleReset = useCallback(() => {
    fetch(`${BACKEND_URL}/reset`, { method: 'POST' })
      .then(res => res.json())
      .then(setSimulationData);
  }, []);

  // Play/Pause logic
  useEffect(() => {
    if (isPlaying) {
      playInterval.current = setInterval(() => {
        handleStep();
      }, 400);
    } else if (playInterval.current) {
      clearInterval(playInterval.current);
      playInterval.current = null;
    }
    return () => {
      if (playInterval.current) {
        clearInterval(playInterval.current);
        playInterval.current = null;
      }
    };
  }, [isPlaying, handleStep]);

  // Update active models
  const updateActiveModels = useCallback((models) => {
    fetch(`${BACKEND_URL}/set_active_models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_names: models })
    })
      .then(res => res.json())
      .then(setSimulationData);
  }, []);

  // Handle model selection changes
  const handleModelSelectionChange = useCallback((newSelectedModels) => {
    setSelectedModels(newSelectedModels);
    updateActiveModels(newSelectedModels);
  }, [updateActiveModels]);

  // Stop playing if all agents reach goal
  useEffect(() => {
    if (isPlaying && simulationData.active_models.length > 0) {
      const allReachedGoal = simulationData.active_models.every(modelName => {
        const modelState = simulationData.states[modelName];
        if (!modelState || !modelState.agent_pos || !modelState.goal_pos) return false;
        return modelState.agent_pos[0] === modelState.goal_pos[0] && 
               modelState.agent_pos[1] === modelState.goal_pos[1];
      });
      
      if (allReachedGoal) {
        setIsPlaying(false);
      }
    }
  }, [isPlaying, simulationData]);

  return (
    <div className="App">
      <h2>DQN Grid Simulation (Multiple Agents)</h2>
      <Controls
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(p => !p)}
        onStep={handleStep}
        onReset={handleReset}
        models={models}
        selectedModels={selectedModels}
        onModelSelectionChange={handleModelSelectionChange}
      />
      <canvas
        ref={canvasRef}
        width={grid.grid_size_x * (CELL_SIZE + MARGIN)}
        height={grid.grid_size_y * (CELL_SIZE + MARGIN)}
        style={{ border: '1px solid #888', background: '#eee', margin: 16 }}
      />
      <div style={{marginTop: 16}}>
        <h4>Agent Positions:</h4>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
          {simulationData.active_models.map((modelName, index) => {
            const modelState = simulationData.states[modelName];
            if (!modelState) return null;
            
            const colorIndex = index % Object.keys(MODEL_COLORS).length;
            const color = MODEL_COLORS[colorIndex];
            
            return (
              <div key={modelName} style={{
                padding: '5px 10px', 
                border: `2px solid ${color}`,
                borderRadius: '4px'
              }}>
                <div><b>{modelName}:</b></div>
                <div>Position: [{modelState.agent_pos[0]}, {modelState.agent_pos[1]}]</div>
                <div>Reward: {modelState.reward || 0} points</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
