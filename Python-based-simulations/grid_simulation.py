import pygame
import json
import torch
import imageio
import numpy as np
import os
from pygame.locals import *

# --- Load Resource Data ---
SCALE = 100
json_path = "extracted_data.json"
with open(json_path, "r") as f:
    extracted_data = json.load(f)

resource_cells = []
for name, data in extracted_data.items():
    x = int(float(data['x_coordinate']) * SCALE)
    y = int(float(data['y_coordinate']) * SCALE)
    resource_cells.append((x, y))

# Normalize to (0, 0)
min_x = min(x for x, y in resource_cells)
min_y = min(y for x, y in resource_cells)
adjusted_resources = [(x - min_x, y - min_y) for x, y in resource_cells]

GRID_SIZE_X = max(x for x, y in adjusted_resources) + 1
GRID_SIZE_Y = max(y for x, y in adjusted_resources) + 1

# --- Load Model ---
class DQN(torch.nn.Module):
    def __init__(self, state_size, action_size):
        super(DQN, self).__init__()
        self.fc1 = torch.nn.Linear(state_size, 128)
        self.relu = torch.nn.ReLU()
        self.fc2 = torch.nn.Linear(128, action_size)

    def forward(self, x):
        x = self.relu(self.fc1(x))
        return self.fc2(x)

model_path = "model1.pth"  # <- Path to the .pth file
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
state_size = GRID_SIZE_X * GRID_SIZE_Y
action_size = 2  # 0: UP, 1: RIGHT

model = DQN(state_size, action_size).to(device)
model.load_state_dict(torch.load(model_path, map_location=device))
model.eval()

# --- Pygame Setup ---
CELL_SIZE = 40
MARGIN = 2
WIDTH = GRID_SIZE_X * (CELL_SIZE + MARGIN)
HEIGHT = GRID_SIZE_Y * (CELL_SIZE + MARGIN)

pygame.init()
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("DQN Agent Simulation")
clock = pygame.time.Clock()

# Load emoji font
font_path = os.path.join("fonts", "NotoEmoji-Bold.ttf")
emoji_font = pygame.font.Font(font_path, 24)

# Colors
WHITE = (255, 255, 255)
GREY = (180, 180, 180)
BLUE = (66, 135, 245)
RED = (255, 0, 0)
LIGHT_BLUE = (173, 216, 230)

# --- Utility ---
def get_state(x, y):
    return y * GRID_SIZE_X + x

# --- Simulation Loop ---
def run_simulation():
    running = True
    agent_pos = [0, 0]
    goal_pos = [GRID_SIZE_X - 1, GRID_SIZE_Y - 1]
    path = set()
    resources_set = set(adjusted_resources)

    # --- Initialize video recording ---
    frames = []

    while running:
        screen.fill(GREY)

        for event in pygame.event.get():
            if event.type == QUIT:
                running = False

        # Draw grid
        for x in range(GRID_SIZE_X):
            for y in range(GRID_SIZE_Y):
                screen_x = x * (CELL_SIZE + MARGIN)
                screen_y = (GRID_SIZE_Y - 1 - y) * (CELL_SIZE + MARGIN)
                rect = pygame.Rect(screen_x, screen_y, CELL_SIZE, CELL_SIZE)

                if (x, y) in path:
                    pygame.draw.rect(screen, LIGHT_BLUE, rect)
                else:
                    pygame.draw.rect(screen, WHITE, rect)

                if (x, y) in resources_set:
                    emoji_surface = emoji_font.render("📚", True, (0, 0, 0))
                    screen.blit(emoji_surface, (screen_x + 6, screen_y + 4))

        # Draw goal
        gx, gy = goal_pos
        goal_rect = pygame.Rect(gx * (CELL_SIZE + MARGIN),
                                (GRID_SIZE_Y - 1 - gy) * (CELL_SIZE + MARGIN),
                                CELL_SIZE, CELL_SIZE)
        pygame.draw.rect(screen, RED, goal_rect)

        # Draw agent
        ax, ay = agent_pos
        agent_rect = pygame.Rect(ax * (CELL_SIZE + MARGIN),
                                 (GRID_SIZE_Y - 1 - ay) * (CELL_SIZE + MARGIN),
                                 CELL_SIZE, CELL_SIZE)
        pygame.draw.rect(screen, BLUE, agent_rect)

        pygame.display.flip()

        # --- Capture frame for video ---
        frame_str = pygame.image.tostring(screen, 'RGB')
        frame_surf = pygame.image.fromstring(frame_str, (WIDTH, HEIGHT), 'RGB')
        frame_array = pygame.surfarray.array3d(frame_surf)
        frame_array = frame_array.swapaxes(0, 1)  # Convert to (H, W, C)
        frames.append(frame_array)

        clock.tick(5)

        # Agent decision
        state = get_state(ax, ay)
        state_tensor = torch.eye(state_size)[state].unsqueeze(0).to(device)
        with torch.no_grad():
            q_values = model(state_tensor)
            action = torch.argmax(q_values).item()

        # Move agent
        if action == 0 and ay < GRID_SIZE_Y - 1:
            ay += 1  # UP
        elif action == 1 and ax < GRID_SIZE_X - 1:
            ax += 1  # RIGHT
        agent_pos = [ax, ay]
        path.add((ax, ay))

        if agent_pos == goal_pos:
            print("Goal reached!")
            pygame.time.wait(1500)
            running = False

    # --- Save video ---
    output_path = "simulation_output.mp4"
    imageio.mimsave(output_path, frames, fps=5)
    print(f"Video saved to {output_path}")

    pygame.quit()


if __name__ == "__main__":
    run_simulation()
