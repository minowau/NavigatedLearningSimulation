import React from 'react';

function Controls({ isPlaying, onPlayPause, onStep, onReset, models, selectedModels, onModelSelectionChange }) {
  const handleModelToggle = (model) => {
    const newSelection = selectedModels.includes(model)
      ? selectedModels.filter(m => m !== model)
      : [...selectedModels, model];
    onModelSelectionChange(newSelection);
  };

  return (
    <div style={{ margin: '16px 0' }}>
      <div>
        <button onClick={onPlayPause}>{isPlaying ? 'Pause' : 'Play'}</button>
        <button onClick={onStep} disabled={isPlaying}>Step</button>
        <button onClick={onReset}>Reset</button>
      </div>
      
      <div style={{ marginTop: '12px', border: '1px solid #ccc', padding: '10px', borderRadius: '4px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Select Models:</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {models.map(model => (
            <label key={model} style={{ display: 'flex', alignItems: 'center', marginRight: '12px' }}>
              <input
                type="checkbox"
                checked={selectedModels.includes(model)}
                onChange={() => handleModelToggle(model)}
              />
              <span style={{ marginLeft: '4px' }}>{model}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Controls;