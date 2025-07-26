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

# --- DQN Model ---
class DQN(torch.nn.Module):
    def __init__(self, state_size, action_size):
        super(DQN, self).__init__()
        self.fc1 = torch.nn.Linear(state_size, 128)
        self.relu = torch.nn.ReLU()
        self.fc2 = torch.nn.Linear(128, action_size)

    def forward(self, x):
        x = self.relu(self.fc1(x))
        return self.fc2(x)

# --- Pygame Setup ---
CELL_SIZE = 40
MARGIN = 2
WIDTH = GRID_SIZE_X * (CELL_SIZE + MARGIN)
HEIGHT = GRID_SIZE_Y * (CELL_SIZE + MARGIN)

pygame.init()
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Multiple DQN Agents Simulation")
clock = pygame.time.Clock()

# Load emoji font
font_path = os.path.join("fonts", "NotoEmoji-Bold.ttf")
emoji_font = pygame.font.Font(font_path, 24)

# Colors
WHITE = (255, 255, 255)
GREY = (180, 180, 180)
RED = (255, 0, 0)

# Different colors for different agents
AGENT_COLORS = [
    (66, 135, 245),   # Blue
    (34, 177, 76),    # Green
    (255, 165, 0),    # Orange
]
PATH_COLORS = [
    (173, 216, 230),  # Light Blue
    (144, 238, 144),  # Light Green
    (255, 200, 100),  # Light Orange
]

# --- Utility ---
def get_state(x, y):
    return y * GRID_SIZE_X + x

# --- Simulation Loop ---
# --- Simulation Loop ---
def run_simulation_all_models(model_paths, goal_offsets, output_video_path):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    state_size = GRID_SIZE_X * GRID_SIZE_Y
    action_size = 2  # 0: UP, 1: RIGHT

    models = []
    for model_path in model_paths:
        model = DQN(state_size, action_size).to(device)
        model.load_state_dict(torch.load(model_path, map_location=device))
        model.eval()
        models.append(model)

    agents_pos = [[0, 0] for _ in range(len(models))]
    goals = [[GRID_SIZE_X - 1, GRID_SIZE_Y - offset] for offset in goal_offsets]
    paths = [set() for _ in range(len(models))]

    resources_set = set(adjusted_resources)
    frames = []

    running = True

    while running:
        screen.fill(GREY)

        for event in pygame.event.get():
            if event.type == QUIT:
                running = False

        # Draw base grid
        for x in range(GRID_SIZE_X):
            for y in range(GRID_SIZE_Y):
                screen_x = x * (CELL_SIZE + MARGIN)
                screen_y = (GRID_SIZE_Y - 1 - y) * (CELL_SIZE + MARGIN)
                rect = pygame.Rect(screen_x, screen_y, CELL_SIZE, CELL_SIZE)
                pygame.draw.rect(screen, WHITE, rect)

        # Draw transparent paths
        for i, path in enumerate(paths):
            for (x, y) in path:
                path_surface = pygame.Surface((CELL_SIZE, CELL_SIZE), pygame.SRCALPHA)
                path_surface.set_alpha(120)  # 0 = fully transparent, 255 = opaque
                path_surface.fill(PATH_COLORS[i])
                screen_x = x * (CELL_SIZE + MARGIN)
                screen_y = (GRID_SIZE_Y - 1 - y) * (CELL_SIZE + MARGIN)
                screen.blit(path_surface, (screen_x, screen_y))

        # Draw resources (books) *after* paths
        for (x, y) in resources_set:
            screen_x = x * (CELL_SIZE + MARGIN)
            screen_y = (GRID_SIZE_Y - 1 - y) * (CELL_SIZE + MARGIN)
            emoji_surface = emoji_font.render("📚", True, (0, 0, 0))
            screen.blit(emoji_surface, (screen_x + 6, screen_y + 4))

        # Draw goals
        for gx, gy in goals:
            goal_rect = pygame.Rect(gx * (CELL_SIZE + MARGIN),
                                    (GRID_SIZE_Y - 1 - gy) * (CELL_SIZE + MARGIN),
                                    CELL_SIZE, CELL_SIZE)
            pygame.draw.rect(screen, RED, goal_rect)

        # Draw agents
        for i, (ax, ay) in enumerate(agents_pos):
            agent_rect = pygame.Rect(ax * (CELL_SIZE + MARGIN),
                                     (GRID_SIZE_Y - 1 - ay) * (CELL_SIZE + MARGIN),
                                     CELL_SIZE, CELL_SIZE)
            pygame.draw.rect(screen, AGENT_COLORS[i], agent_rect)

        pygame.display.flip()

        # Capture frame
        frame_str = pygame.image.tostring(screen, 'RGB')
        frame_surf = pygame.image.fromstring(frame_str, (WIDTH, HEIGHT), 'RGB')
        frame_array = pygame.surfarray.array3d(frame_surf)
        frame_array = frame_array.swapaxes(0, 1)
        frames.append(frame_array)

        clock.tick(5)

        # Move agents
        all_reached = True
        for i, model in enumerate(models):
            if agents_pos[i] != goals[i]:
                all_reached = False
                ax, ay = agents_pos[i]
                state = get_state(ax, ay)
                state_tensor = torch.eye(state_size)[state].unsqueeze(0).to(device)
                with torch.no_grad():
                    q_values = model(state_tensor)
                    action = torch.argmax(q_values).item()

                if action == 0 and ay < GRID_SIZE_Y - 1:
                    ay += 1  # UP
                elif action == 1 and ax < GRID_SIZE_X - 1:
                    ax += 1  # RIGHT

                agents_pos[i] = [ax, ay]
                paths[i].add((ax, ay))

        if all_reached:
            print("All agents reached their goals!")
            pygame.time.wait(1000)
            running = False

    # Save video
    imageio.mimsave(output_video_path, frames, fps=5)
    print(f"Saved video to {output_video_path}")


# --- Main ---
if __name__ == "__main__":
    model_paths = ["model1.pth", "model2.pth", "model3.pth"]
    goal_offsets = [1, 3, 6]  # model1 -> -1, model2 -> -3, model3 -> -6
    output_video_path = "simulation_multiple_agents.mp4"

    run_simulation_all_models(model_paths, goal_offsets, output_video_path)

    pygame.quit()
