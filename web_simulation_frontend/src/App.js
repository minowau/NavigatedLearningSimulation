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
  const [resourceMap, setResourceMap] = useState({});
  const [hoverInfo, setHoverInfo] = useState(null); // { x, y, name }
  const [isPlaying, setIsPlaying] = useState(false);
  const playInterval = useRef(null);
  const CELL_SIZE = 32;
  const MARGIN = 2;
  
  // Model colors for visualization
  const MODEL_COLORS = {
    ensemble: '#FFFF00',
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

  // Helper to draw an arrow between two cell centers
  const drawArrow = (ctx, fromX, fromY, toX, toY, color) => {
    const headLength = 10;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;

    // Draw main line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Draw arrow head
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  };

  // Fetch grid info and models on mount
  useEffect(() => {
    fetch(`${BACKEND_URL}/grid`)
      .then(res => res.json())
      .then(data => {
        setGrid({
          grid_size_x: data.grid_size_x,
          grid_size_y: data.grid_size_y,
          resources: data.resources || [],
        });
        setResourceMap(data.resource_map || {});
      });
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

  // Draw grid, resources, and animated arrows between the last two visited resources
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
    
    // First draw arrows for ensemble if it exists
    if (simulationData.states && simulationData.states.ensemble) {
      const ensembleState = simulationData.states.ensemble;
      const ensemblePathColor = MODEL_COLORS.ensemble;

      if (ensembleState.path && ensembleState.path.length > 0) {
        const resourceSet = new Set(
          grid.resources.map(([rx, ry]) => `${rx},${ry}`)
        );

        const resourceVisits = ensembleState.path.filter(([px, py]) =>
          resourceSet.has(`${px},${py}`)
        );

        if (resourceVisits.length >= 2) {
          // Draw only the last arrow segment (remove previous arrows)
          const lastIndex = resourceVisits.length - 1;
          const [fromXGrid, fromYGrid] = resourceVisits[lastIndex - 1];
          const [toXGrid, toYGrid] = resourceVisits[lastIndex];

          const fromX =
            fromXGrid * (CELL_SIZE + MARGIN) + CELL_SIZE / 2;
          const fromY =
            (grid.grid_size_y - 1 - fromYGrid) * (CELL_SIZE + MARGIN) +
            CELL_SIZE / 2;
          const toX =
            toXGrid * (CELL_SIZE + MARGIN) + CELL_SIZE / 2;
          const toY =
            (grid.grid_size_y - 1 - toYGrid) * (CELL_SIZE + MARGIN) +
            CELL_SIZE / 2;

          drawArrow(ctx, fromX, fromY, toX, toY, ensemblePathColor);
        }
      }
    }
    
    // Then draw arrows for each active model
    simulationData.active_models.forEach((modelName, index) => {
      const modelState = simulationData.states[modelName];
      if (!modelState) return;
      
      const colorIndex = index % Object.keys(MODEL_COLORS).length;
      const pathColor = MODEL_COLORS[colorIndex];

      if (modelState.path && modelState.path.length > 0) {
        const resourceSet = new Set(
          grid.resources.map(([rx, ry]) => `${rx},${ry}`)
        );

        const resourceVisits = modelState.path.filter(([px, py]) =>
          resourceSet.has(`${px},${py}`)
        );

        if (resourceVisits.length >= 2) {
          // Draw only the last arrow segment (remove previous arrows)
          const lastIndex = resourceVisits.length - 1;
          const [fromXGrid, fromYGrid] = resourceVisits[lastIndex - 1];
          const [toXGrid, toYGrid] = resourceVisits[lastIndex];

          const fromX =
            fromXGrid * (CELL_SIZE + MARGIN) + CELL_SIZE / 2;
          const fromY =
            (grid.grid_size_y - 1 - fromYGrid) * (CELL_SIZE + MARGIN) +
            CELL_SIZE / 2;
          const toX =
            toXGrid * (CELL_SIZE + MARGIN) + CELL_SIZE / 2;
          const toY =
            (grid.grid_size_y - 1 - toYGrid) * (CELL_SIZE + MARGIN) +
            CELL_SIZE / 2;

          drawArrow(ctx, fromX, fromY, toX, toY, pathColor);
        }
      }
    });
  }, [grid, simulationData, CELL_SIZE, MARGIN, MODEL_COLORS]);

  // Handle hover over resources on the canvas to show resource name
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMove = (evt) => {
      const rect = canvas.getBoundingClientRect();
      const mx = evt.clientX - rect.left;
      const my = evt.clientY - rect.top;

      const cellSizeWithMargin = CELL_SIZE + MARGIN;
      const gx = Math.floor(mx / cellSizeWithMargin);
      const gyFromBottom = Math.floor(my / cellSizeWithMargin);
      const gy = grid.grid_size_y - 1 - gyFromBottom;

      if (
        gx < 0 ||
        gy < 0 ||
        gx >= grid.grid_size_x ||
        gy >= grid.grid_size_y
      ) {
        setHoverInfo(null);
        return;
      }

      const key = `${gx},${gy}`;
      const name = resourceMap[key];
      if (name) {
        setHoverInfo({
          x: mx + 10,
          y: my + 10,
          name,
        });
      } else {
        setHoverInfo(null);
      }
    };

    const handleLeave = () => {
      setHoverInfo(null);
    };

    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseleave', handleLeave);

    return () => {
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mouseleave', handleLeave);
    };
  }, [CELL_SIZE, MARGIN, grid, resourceMap]);

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

  // Helper to get resource name for a given grid position
  const getResourceNameAtPosition = (pos) => {
    if (!pos || !Array.isArray(pos) || pos.length < 2) return null;
    const key = `${pos[0]},${pos[1]}`;
    return resourceMap[key] || null;
  };

  // Helper to get the path of visited resources as names
  const getResourcePath = (path) => {
    if (!path || path.length === 0) return null;
    const resourceSet = new Set(
      grid.resources.map(([rx, ry]) => `${rx},${ry}`)
    );
    const resourceVisits = path.filter(([px, py]) =>
      resourceSet.has(`${px},${py}`)
    );
    if (resourceVisits.length === 0) return null;
    const resourceNames = resourceVisits.map(([px, py]) => {
      const key = `${px},${py}`;
      return resourceMap[key] || null;
    }).filter(name => name !== null);
    if (resourceNames.length === 0) return null;
    return `{${resourceNames.join(' -> ')}}`;
  };
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
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <canvas
          ref={canvasRef}
          width={grid.grid_size_x * (CELL_SIZE + MARGIN)}
          height={grid.grid_size_y * (CELL_SIZE + MARGIN)}
          style={{ border: '1px solid #888', background: '#eee', margin: 16 }}
        />
        {hoverInfo && (
          <div
            style={{
              position: 'absolute',
              left: hoverInfo.x,
              top: hoverInfo.y,
              padding: '4px 8px',
              backgroundColor: '#ffffff',
              border: '1px solid #ccc',
              borderRadius: 4,
              pointerEvents: 'none',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              whiteSpace: 'nowrap',
              fontSize: 12,
            }}
          >
            {hoverInfo.name}
          </div>
        )}
      </div>
      <div style={{marginTop: 16}}>
        <h4>Agent Positions:</h4>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
          {simulationData.states && simulationData.states.ensemble && (
            <div style={{
              padding: '5px 10px', 
              border: `2px solid ${MODEL_COLORS.ensemble}`,
              borderRadius: '4px'
            }}>
              <div><b>Ensemble:</b></div>
              <div>Position: [{simulationData.states.ensemble.agent_pos[0]}, {simulationData.states.ensemble.agent_pos[1]}]</div>
              <div>
                Resource:{' '}
                {getResourceNameAtPosition(simulationData.states.ensemble.agent_pos) || 'None at current position'}
              </div>
              {getResourcePath(simulationData.states.ensemble.path) && (
                <div>
                  Path: {getResourcePath(simulationData.states.ensemble.path)}
                </div>
              )}
              <div>Reward: {simulationData.states.ensemble.reward || 0} points</div>
            </div>
          )}
          {simulationData.active_models.map((modelName, index) => {
            const modelState = simulationData.states[modelName];
            if (!modelState) return null;
            
            const colorIndex = index % Object.keys(MODEL_COLORS).length;
            const color = MODEL_COLORS[colorIndex];
            const resourceName = getResourceNameAtPosition(modelState.agent_pos);
            const resourcePath = getResourcePath(modelState.path);
            
            return (
              <div key={modelName} style={{
                padding: '5px 10px', 
                border: `2px solid ${color}`,
                borderRadius: '4px'
              }}>
                <div><b>{modelName}:</b></div>
                <div>Position: [{modelState.agent_pos[0]}, {modelState.agent_pos[1]}]</div>
                <div>
                  Resource:{' '}
                  {resourceName ? resourceName : 'None at current position'}
                </div>
                {resourcePath && (
                  <div>
                    Path: {resourcePath}
                  </div>
                )}
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
