import React from 'react';

function Controls({ isPlaying, onPlayPause, onStep, onReset, models, selectedModel, onModelChange }) {
  return (
    <div style={{ margin: '16px 0' }}>
      <button onClick={onPlayPause}>{isPlaying ? 'Pause' : 'Play'}</button>
      <button onClick={onStep} disabled={isPlaying}>Step</button>
      <button onClick={onReset}>Reset</button>
      <select value={selectedModel} onChange={e => onModelChange(e.target.value)} style={{ marginLeft: 12 }}>
        {models.map(model => (
          <option key={model} value={model}>{model}</option>
        ))}
      </select>
    </div>
  );
}

export default Controls; 