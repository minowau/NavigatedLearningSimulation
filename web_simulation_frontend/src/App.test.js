import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
jest.mock('gsap');
import App from './App';

beforeEach(() => {
  jest.restoreAllMocks();
  // Provide a minimal canvas 2D context for tests
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

test('loads initial data and displays agent positions and models', async () => {
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
    if (url.endsWith('/step')) return Promise.resolve({ json: () => Promise.resolve(mockState) });
    if (url.endsWith('/reset')) return Promise.resolve({ json: () => Promise.resolve(mockState) });
    if (url.endsWith('/set_active_models')) return Promise.resolve({ json: () => Promise.resolve(mockState) });
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });

  render(<App />);

  await waitFor(() => expect(screen.getByText(/Agent Status/i)).toBeInTheDocument());

  // Ensure backend endpoints were requested and model checkboxes render
  expect(global.fetch).toHaveBeenCalled();
  expect(global.fetch.mock.calls.some(call => call[0].toString().includes('/grid'))).toBeTruthy();
  expect(global.fetch.mock.calls.some(call => call[0].toString().includes('/state'))).toBeTruthy();
  expect(global.fetch.mock.calls.some(call => call[0].toString().includes('/models'))).toBeTruthy();

  // Model checkboxes should appear
  await waitFor(() => expect(screen.getByLabelText('m1')).toBeInTheDocument());
  await waitFor(() => expect(screen.getByLabelText('m2')).toBeInTheDocument());
});

test('play/pause toggles and step triggers /step call', async () => {
  const mockGrid = { grid_size_x: 2, grid_size_y: 2, resources: [], resource_map: {} };
  const mockState = { active_models: [], states: {} };
  const mockModels = [];

  const fetchMock = jest.fn((url, opts) => {
    if (url.endsWith('/grid')) return Promise.resolve({ json: () => Promise.resolve(mockGrid) });
    if (url.endsWith('/state')) return Promise.resolve({ json: () => Promise.resolve(mockState) });
    if (url.endsWith('/models')) return Promise.resolve({ json: () => Promise.resolve(mockModels) });
    if (url.endsWith('/step')) return Promise.resolve({ json: () => Promise.resolve(mockState) });
    return Promise.resolve({ json: () => Promise.resolve(mockState) });
  });
  global.fetch = fetchMock;

  render(<App />);

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());

  const playButton = screen.getByText('Play');
  const stepButton = screen.getByText('Step');

  // Start playing
  fireEvent.click(playButton);
  expect(screen.getByText('Pause')).toBeInTheDocument();

  // Step should be disabled while playing
  expect(stepButton).toBeDisabled();

  // Pause again
  fireEvent.click(screen.getByText('Pause'));
  expect(screen.getByText('Play')).toBeInTheDocument();

  // Click Step when not playing should call /step
  fetchMock.mockClear();
  fireEvent.click(screen.getByText('Step'));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(fetchMock.mock.calls.some(call => call[0].toString().includes('/step'))).toBeTruthy();
});

test('reset calls /reset and selecting models posts to set_active_models', async () => {
  const mockGrid = { grid_size_x: 2, grid_size_y: 2, resources: [], resource_map: {} };
  const mockState = { active_models: [], states: {} };
  const mockModels = ['m1', 'm2'];

  const fetchMock = jest.fn((url, opts) => {
    if (url.endsWith('/grid')) return Promise.resolve({ json: () => Promise.resolve(mockGrid) });
    if (url.endsWith('/state')) return Promise.resolve({ json: () => Promise.resolve(mockState) });
    if (url.endsWith('/models')) return Promise.resolve({ json: () => Promise.resolve(mockModels) });
    if (url.endsWith('/set_active_models')) return Promise.resolve({ json: () => Promise.resolve(mockState) });
    if (url.endsWith('/reset')) return Promise.resolve({ json: () => Promise.resolve(mockState) });
    return Promise.resolve({ json: () => Promise.resolve(mockState) });
  });
  global.fetch = fetchMock;

  render(<App />);

  await waitFor(() => expect(screen.getByLabelText('m1')).toBeInTheDocument());

  // Click Reset
  fireEvent.click(screen.getByText('Reset'));
  await waitFor(() => expect(fetchMock.mock.calls.some(call => call[0].toString().includes('/reset'))).toBeTruthy());

  // Toggle model m2 checkbox to trigger set_active_models
  const m2Checkbox = screen.getByLabelText('m2');
  fireEvent.click(m2Checkbox);

  await waitFor(() => expect(fetchMock.mock.calls.some(call => call[0].toString().includes('/set_active_models'))).toBeTruthy());
});
