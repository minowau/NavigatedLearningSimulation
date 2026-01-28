import React, { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';
import Controls from './Controls';
import LoadingSpinner from './LoadingSpinner';
import { gsap } from 'gsap';

const BACKEND_URL = 'http://localhost:8000'; // Change if backend runs elsewhere

function App() {
  const canvasRef = useRef(null);
  const appRef = useRef(null);
  const controlsRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const [grid, setGrid] = useState({ grid_size_x: 10, grid_size_y: 10, resources: [] });
  const [simulationData, setSimulationData] = useState({ active_models: [], states: {} });
  const [models, setModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [resourceMap, setResourceMap] = useState({});
  const [hoverInfo, setHoverInfo] = useState(null); // { x, y, name }
  const [isPlaying, setIsPlaying] = useState(false);
  const playInterval = useRef(null);
  const [loading, setLoading] = useState(true);
  const CELL_SIZE = 40;
  const MARGIN = 3;
  const arrowAnimationsRef = useRef({});
  const lastSegmentsRef = useRef({});
  const highlightsRef = useRef([]);
  
  // Model colors for visualization
  const MODEL_COLORS = {
    ensemble: '#ffd43b',
    0: '#ff3b3b',
    1: '#228be6',
    2: '#40c057',
    3: '#ae3ec9',
    4: '#20c997',
    5: '#fd7e14',
    6: '#845ef7',
    7: '#0ca678',
    8: '#1c7ed6',
    9: '#c92a2a',
  };

  // Helper to draw an arrow between two cell centers
  const drawArrow = (ctx, fromX, fromY, toX, toY, color, progress = 1) => {
    const headLength = Math.max(8, Math.floor(CELL_SIZE * 0.3));
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    const curX = fromX + dx * progress;
    const curY = fromY + dy * progress;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowColor = `${color}55`;
    ctx.shadowBlur = 6;

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(curX, curY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (progress > 0.85) {
      ctx.beginPath();
      ctx.moveTo(curX, curY);
      ctx.lineTo(
        curX - headLength * Math.cos(angle - Math.PI / 6),
        curY - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        curX - headLength * Math.cos(angle + Math.PI / 6),
        curY - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    }
  };

  // Fetch grid info and models on mount
  useEffect(() => {
    setLoading(true);
    const loadGrid = fetch(`${BACKEND_URL}/grid`)
      .then(res => res.json())
      .then(data => {
        setGrid({
          grid_size_x: data.grid_size_x,
          grid_size_y: data.grid_size_y,
          resources: data.resources || [],
        });
        setResourceMap(data.resource_map || {});
      });
    const loadState = fetch(`${BACKEND_URL}/state`).then(res => res.json()).then(setSimulationData);
    const loadModels = fetch(`${BACKEND_URL}/models`).then(res => res.json()).then(models => {
      setModels(models);
      if (models.length > 0) {
        const initialModel = models[0];
        setSelectedModels([initialModel]);
        updateActiveModels([initialModel]);
      }
    });
    Promise.all([loadGrid, loadState, loadModels]).finally(() => setLoading(false));
  }, []);

  // Entrance animations
  useEffect(() => {
    if (loading) return;
    const tl = gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.6 } });
    tl.from(appRef.current, { opacity: 0 })
      .from('.header .h1', { y: 16, opacity: 0 }, '<')
      .from(controlsRef.current, { y: 12, opacity: 0 }, '-=0.3')
      .from(canvasContainerRef.current, { y: 12, opacity: 0 }, '-=0.35');
  }, [loading]);

  const drawScene = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid cells
    for (let x = 0; x < grid.grid_size_x; x++) {
      for (let y = 0; y < grid.grid_size_y; y++) {
        const cellX = x * (CELL_SIZE + MARGIN);
        const cellY = (grid.grid_size_y - 1 - y) * (CELL_SIZE + MARGIN);
        let fillStyle = 'rgba(255,255,255,0.10)';
        if (typeof ctx.createLinearGradient === 'function') {
          const grad = ctx.createLinearGradient(cellX, cellY, cellX + CELL_SIZE, cellY + CELL_SIZE);
          grad.addColorStop(0, 'rgba(255,255,255,0.10)');
          grad.addColorStop(1, 'rgba(148,163,184,0.12)');
          fillStyle = grad;
        }
        ctx.shadowColor = 'rgba(34,139,230,0.18)';
        ctx.shadowBlur = 5;
        ctx.fillStyle = fillStyle;
        ctx.fillRect(
          x * (CELL_SIZE + MARGIN),
          (grid.grid_size_y - 1 - y) * (CELL_SIZE + MARGIN),
          CELL_SIZE, CELL_SIZE
        );
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(0,0,0,0.20)';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          x * (CELL_SIZE + MARGIN),
          (grid.grid_size_y - 1 - y) * (CELL_SIZE + MARGIN),
          CELL_SIZE, CELL_SIZE
        );
      }
    }
    
    // Draw resources with labels
    for (const [rx, ry] of grid.resources) {
      const cellX = rx * (CELL_SIZE + MARGIN);
      const cellY = (grid.grid_size_y - 1 - ry) * (CELL_SIZE + MARGIN);
      
      // Draw resource indicator circle
      ctx.fillStyle = '#ff9800';
      ctx.shadowColor = 'rgba(255, 152, 0, 0.4)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cellX + CELL_SIZE / 2, cellY + CELL_SIZE / 2, CELL_SIZE / 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Draw emoji icon
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📚', cellX + CELL_SIZE / 2, cellY + CELL_SIZE / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    }
    
    if (highlightsRef.current.length > 0) {
      highlightsRef.current.forEach(h => {
        const cx = h.x;
        const cy = h.y;
        if (typeof ctx.arc === 'function' || typeof ctx.rect === 'function') {
          ctx.beginPath();
          if (typeof ctx.arc === 'function') {
            ctx.arc(cx, cy, h.radius, 0, Math.PI * 2);
          } else {
            ctx.rect(cx - h.radius, cy - h.radius, h.radius * 2, h.radius * 2);
          }
          ctx.strokeStyle = `rgba(34,139,230,${h.alpha})`;
          ctx.lineWidth = 3;
          ctx.shadowColor = `rgba(34,139,230,${h.alpha})`;
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });
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

          const anim = arrowAnimationsRef.current['ensemble'];
          const p = anim && anim.fromX === fromX && anim.toX === toX && anim.fromY === fromY && anim.toY === toY ? anim.progress : 1;
          drawArrow(ctx, fromX, fromY, toX, toY, ensemblePathColor, p);
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

          const anim = arrowAnimationsRef.current[modelName];
          const p = anim && anim.fromX === fromX && anim.toX === toX && anim.fromY === fromY && anim.toY === toY ? anim.progress : 1;
          drawArrow(ctx, fromX, fromY, toX, toY, pathColor, p);
        }
      }
    });
  };

  useEffect(() => {
    drawScene();
  }, [grid, simulationData, CELL_SIZE, MARGIN, MODEL_COLORS]);

  const scheduleArrow = (key, fromX, fromY, toX, toY, color) => {
    const segKey = `${fromX},${fromY}->${toX},${toY}`;
    if (lastSegmentsRef.current[key] === segKey) return;
    lastSegmentsRef.current[key] = segKey;
    const animObj = { progress: 0, fromX, fromY, toX, toY, color };
    arrowAnimationsRef.current[key] = animObj;
    const start = performance.now();
    const duration = 700;
    const bezier = (t) => {
      const x1 = 0.4, y1 = 0.0, x2 = 0.2, y2 = 1.0;
      const u = 1 - t;
      return (3 * u * u * t * y1) + (3 * u * t * t * y2) + (t * t * t);
    };
    const step = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      animObj.progress = bezier(t);
      arrowAnimationsRef.current[key] = animObj;
      drawScene();
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        const hl = {
          x: toX,
          y: toY,
          alpha: 0.6,
          radius: Math.max(10, Math.floor(CELL_SIZE * 0.35))
        };
        highlightsRef.current.push(hl);
        const hStart = performance.now();
        const hDuration = 400;
        const hStep = (n) => {
          const e = n - hStart;
          const tt = Math.min(1, e / hDuration);
          const eased = bezier(tt);
          hl.alpha = (1 - eased) * 0.6;
          drawScene();
          if (tt < 1) {
            requestAnimationFrame(hStep);
          } else {
            highlightsRef.current = highlightsRef.current.filter(h => h !== hl);
            drawScene();
          }
        };
        requestAnimationFrame(hStep);
      }
    };
    requestAnimationFrame(step);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!simulationData.states) return;
    if (simulationData.states.ensemble) {
      const s = simulationData.states.ensemble;
      const resourceSet = new Set(grid.resources.map(([rx, ry]) => `${rx},${ry}`));
      const visits = s.path ? s.path.filter(([px, py]) => resourceSet.has(`${px},${py}`)) : [];
      if (visits.length >= 2) {
        const lastIndex = visits.length - 1;
        const [fx, fy] = visits[lastIndex - 1];
        const [tx, ty] = visits[lastIndex];
        const fromX = fx * (CELL_SIZE + MARGIN) + CELL_SIZE / 2;
        const fromY = (grid.grid_size_y - 1 - fy) * (CELL_SIZE + MARGIN) + CELL_SIZE / 2;
        const toX = tx * (CELL_SIZE + MARGIN) + CELL_SIZE / 2;
        const toY = (grid.grid_size_y - 1 - ty) * (CELL_SIZE + MARGIN) + CELL_SIZE / 2;
        scheduleArrow('ensemble', fromX, fromY, toX, toY, MODEL_COLORS.ensemble);
      }
    }
    simulationData.active_models.forEach((modelName, index) => {
      const s = simulationData.states[modelName];
      if (!s) return;
      const resourceSet = new Set(grid.resources.map(([rx, ry]) => `${rx},${ry}`));
      const visits = s.path ? s.path.filter(([px, py]) => resourceSet.has(`${px},${py}`)) : [];
      if (visits.length >= 2) {
        const lastIndex = visits.length - 1;
        const [fx, fy] = visits[lastIndex - 1];
        const [tx, ty] = visits[lastIndex];
        const fromX = fx * (CELL_SIZE + MARGIN) + CELL_SIZE / 2;
        const fromY = (grid.grid_size_y - 1 - fy) * (CELL_SIZE + MARGIN) + CELL_SIZE / 2;
        const toX = tx * (CELL_SIZE + MARGIN) + CELL_SIZE / 2;
        const toY = (grid.grid_size_y - 1 - ty) * (CELL_SIZE + MARGIN) + CELL_SIZE / 2;
        const colorIndex = index % Object.keys(MODEL_COLORS).length;
        const color = MODEL_COLORS[colorIndex];
        scheduleArrow(modelName, fromX, fromY, toX, toY, color);
      }
    });
  }, [simulationData, grid, CELL_SIZE, MARGIN, MODEL_COLORS]);

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
    <div className="App app-container app-shell" ref={appRef}>
      <header className="header">
        <h1 className="h1 brand-gradient">DQN Grid Simulation</h1>
      </header>
      <div className="container flex flex-row flex-wrap gap-24 contain">
      <div ref={controlsRef} className="box md-w-33 lg-w-25 sticky">
        <Controls
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(p => !p)}
        onStep={handleStep}
        onReset={handleReset}
        models={models}
        selectedModels={selectedModels}
        onModelSelectionChange={handleModelSelectionChange}
        />
      </div>
      <div className="canvas-container card container box md-w-67 lg-w-75" ref={canvasContainerRef}>
        <canvas
          ref={canvasRef}
          width={grid.grid_size_x * (CELL_SIZE + MARGIN) + 20}
          height={grid.grid_size_y * (CELL_SIZE + MARGIN) + 20}
          className="canvas"
        />
        {hoverInfo && (
          <div
            className="tooltip"
            style={{ left: hoverInfo.x, top: hoverInfo.y }}
          >
            {hoverInfo.name}
          </div>
        )}
      </div>
      <div className="container col-span-12" style={{marginTop: 16}}>
        <h4 className="h2">Agent Status</h4>
        <div className="status-grid">
          {simulationData.states && simulationData.states.ensemble && (
            <div className="status-card">
              <div className="status-header">
                <div><b>Ensemble</b></div>
                <div className="badges">
                  <span className="badge badge-pos">Pos [{simulationData.states.ensemble.agent_pos[0]}, {simulationData.states.ensemble.agent_pos[1]}]</span>
                  <span className="badge badge-res">Res {getResourceNameAtPosition(simulationData.states.ensemble.agent_pos) || 'None'}</span>
                  <span className="badge badge-reward">Reward {simulationData.states.ensemble.reward || 0}</span>
                </div>
              </div>
              {getResourcePath(simulationData.states.ensemble.path) && (
                <div className="muted">Path {getResourcePath(simulationData.states.ensemble.path)}</div>
              )}
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
              <div key={modelName} className="status-card" style={{ borderColor: color }}>
                <div className="status-header">
                  <div><b>{modelName}</b></div>
                  <div className="badges">
                    <span className="badge badge-pos">Pos [{modelState.agent_pos[0]}, {modelState.agent_pos[1]}]</span>
                    <span className="badge badge-res">Res {resourceName ? resourceName : 'None'}</span>
                    <span className="badge badge-reward">Reward {modelState.reward || 0}</span>
                  </div>
                </div>
                {resourcePath && (
                  <div className="muted">Path {resourcePath}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </div>
      {loading && <LoadingSpinner label="Loading simulation..." />}
    </div>
  );
}

export default App;
