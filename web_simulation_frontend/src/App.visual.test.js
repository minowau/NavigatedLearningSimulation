import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
jest.mock('gsap');
import App from './App';

beforeEach(() => {
  jest.restoreAllMocks();
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    closePath: () => {},
    fill: () => {},
  }));
});

test('App visual structure snapshot after initial load', async () => {
  const mockGrid = {
    grid_size_x: 2,
    grid_size_y: 2,
    resources: [[0,0],[1,1]],
    resource_map: { '0,0': 'Book', '1,1': 'Pen' }
  };
  const mockState = {
    active_models: ['m1'],
    states: {
      ensemble: { agent_pos: [0,0], path: [[0,0],[1,1]], reward: 5 },
      m1: { agent_pos: [1,1], path: [[1,1]], reward: 2 }
    }
  };
  const mockModels = ['m1', 'm2'];

  global.fetch = jest.fn((url) => {
    if (url.endsWith('/grid')) return Promise.resolve({ json: () => Promise.resolve(mockGrid) });
    if (url.endsWith('/state')) return Promise.resolve({ json: () => Promise.resolve(mockState) });
    if (url.endsWith('/models')) return Promise.resolve({ json: () => Promise.resolve(mockModels) });
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });

  const { container } = render(<App />);
  await waitFor(() => expect(screen.getByText(/Agent Status/i)).toBeInTheDocument());

  const section = screen.getByText(/Agent Status/i).parentElement;
  expect(section).toMatchSnapshot();
});
