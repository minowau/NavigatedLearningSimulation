import React from 'react';

function Controls({ isPlaying, onPlayPause, onStep, onReset, models, selectedModels, onModelSelectionChange }) {
  const handleModelToggle = (model) => {
    const newSelection = selectedModels.includes(model)
      ? selectedModels.filter(m => m !== model)
      : [...selectedModels, model];
    onModelSelectionChange(newSelection);
  };

  return (
    <aside className="controls container sidebar">
      <div className="sidebar-title">Models</div>
      <div className="row" role="group" aria-label="Simulation controls">
        <button className="btn btn-primary" onClick={onPlayPause} aria-pressed={isPlaying}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button className="btn" onClick={onStep} disabled={isPlaying}>
          Step
        </button>
        <button className="btn btn-outline" onClick={onReset}>
          Reset
        </button>
      </div>
      
      <div className="panel card" style={{ marginTop: 12, padding: 12 }}>
        <h4 className="h2 vis-title">Select Models</h4>
        <div className="model-list" role="group" aria-label="Model selection">
          {models.map(model => (
            <label key={model} className="model-item">
              <input
                type="checkbox"
                aria-label={model}
                checked={selectedModels.includes(model)}
                onChange={() => handleModelToggle(model)}
              />
              <span>{model}</span>
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default Controls;
