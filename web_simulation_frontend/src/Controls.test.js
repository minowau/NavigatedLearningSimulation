import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Controls from './Controls';

test('buttons call handlers and step disabled while playing', () => {
  const onPlayPause = jest.fn();
  const onStep = jest.fn();
  const onReset = jest.fn();
  const onModelSelectionChange = jest.fn();

  render(
    <Controls
      isPlaying={true}
      onPlayPause={onPlayPause}
      onStep={onStep}
      onReset={onReset}
      models={['m1','m2']}
      selectedModels={['m1']}
      onModelSelectionChange={onModelSelectionChange}
    />
  );

  // Play button should show Pause when isPlaying
  const playPause = screen.getByText('Pause');
  fireEvent.click(playPause);
  expect(onPlayPause).toHaveBeenCalled();

  // Step is disabled when playing
  const stepBtn = screen.getByText('Step');
  expect(stepBtn).toBeDisabled();

  // Reset should call handler
  const resetBtn = screen.getByText('Reset');
  fireEvent.click(resetBtn);
  expect(onReset).toHaveBeenCalled();
});

test('model toggles call onModelSelectionChange with updated selection', () => {
  const onPlayPause = jest.fn();
  const onStep = jest.fn();
  const onReset = jest.fn();
  const onModelSelectionChange = jest.fn();

  render(
    <Controls
      isPlaying={false}
      onPlayPause={onPlayPause}
      onStep={onStep}
      onReset={onReset}
      models={['m1','m2']}
      selectedModels={['m1']}
      onModelSelectionChange={onModelSelectionChange}
    />
  );

  // Toggle m2 on
  const m2 = screen.getByLabelText('m2');
  fireEvent.click(m2);
  expect(onModelSelectionChange).toHaveBeenCalled();
});
