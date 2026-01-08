import React from 'react';
import { render, screen } from '@testing-library/react';
import Controls from './Controls';

test('Controls visual snapshot', () => {
  render(
    <Controls
      isPlaying={false}
      onPlayPause={() => {}}
      onStep={() => {}}
      onReset={() => {}}
      models={['A', 'B']}
      selectedModels={['A']}
      onModelSelectionChange={() => {}}
    />
  );
  const group = screen.getByRole('group', { name: /Simulation controls/i });
  expect(group).toMatchSnapshot();
});
