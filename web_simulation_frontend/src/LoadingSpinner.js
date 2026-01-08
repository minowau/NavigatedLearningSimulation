import React from 'react';

function LoadingSpinner({ label = 'Loading...' }) {
  return (
    <div className="loading-overlay" role="alert" aria-live="polite">
      <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '4px solid rgba(148, 163, 184, 0.35)',
            borderTopColor: 'var(--color-primary)',
            animation: 'spin 900ms linear infinite'
          }}
        />
        <div className="muted">{label}</div>
      </div>
      <style>
        {`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}
      </style>
    </div>
  );
}

export default LoadingSpinner;
