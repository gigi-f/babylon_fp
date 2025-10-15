# Map Editor Visual Preview & Orientation Guide

## New Features Added

### 1. **Cursor Preview** 👁️
- Semi-transparent preview of the tile you're about to place
- Shows exactly what the tile will look like before clicking
- Preview follows your mouse cursor in real-time
- Changes instantly when you switch tools or rotation

### 2. **Orientation Indicators** 🧭

#### Bright Green Line & Arrow
All rotatable items show a **bright green line** on their "front" edge with an arrow:

**Walls, Doors, Windows:**
- **0° (Horizontal)**: Green line on **bottom** edge (facing south)
- **90° (Vertical)**: Green line on **left** edge (facing west)
- **180°**: Green line on **top** edge (facing north)
- **270°**: Green line on **right** edge (facing east)

**NPC & Player Spawns:**
- Default orientation facing **south** (down) with green line on bottom

#### Placed Tiles
Already-placed tiles show a **darker green line** (more subtle) to indicate their orientation.

### 3. **Enhanced Erase Tool** ❌
- Shows a red X under cursor when erase tool is selected
- Clear visual indication of what will be deleted

## How to Use

### Visual Feedback
1. **Select a tool** (Wall, Door, Window, etc.)
2. **Set rotation** (0°, 90°, 180°, 270°)
3. **Move mouse over grid** → See preview with green orientation indicator
4. **Press 'R'** → Preview updates instantly to show new rotation
5. **Click** → Place the tile

### Interpreting Orientation

The **green line + arrow** shows the "front" or "facing direction":

```
Wall at 0°:           Wall at 90°:
┌─────────┐          ┌─────────┐
│         │          ↓         │
│  WALL   │          │  WALL   │
│         │          │         │
└────↓────┘          └─────────┘
  (front)              (front)
```

**For NPCs/Players:**
- Green line indicates where they will face initially
- Useful for positioning guards at doors, NPCs at counters, etc.

### Tooltip Enhancement
Hover tooltip now shows:
```
Grid: (50, 54) | World: (0, 4) | Rotation: 90°
```

## Tips for Better Building

1. **Orient Doors Properly**: Make sure green line faces the direction you want the door to open
2. **NPC Placement**: Face NPCs toward counters, desks, or points of interest
3. **Player Spawn**: Orient player to face the building entrance or key landmark
4. **Visual Planning**: Use the preview to "sketch" your building before committing
5. **Quick Rotation**: Keep pressing 'R' while hovering to find the right orientation

## Color Legend

| Color | Meaning |
|-------|---------|
| **Bright Green (#00FF00)** | Cursor preview orientation (not placed yet) |
| **Dark Green (#00AA00)** | Placed tile orientation |
| **Red (#FF0000)** | Erase cursor |
| **50% Transparent** | Preview tile (not placed yet) |
| **100% Opaque** | Placed tile |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **R** | Rotate preview by 90° clockwise |
| **Click** | Place tile at cursor position |
| **Mouse Move** | Update preview position |

## Technical Details

### Rotation Angles
- **0°**: Default horizontal, faces south (+Z direction in 3D)
- **90°**: Rotates to face west (-X direction in 3D)
- **180°**: Faces north (-Z direction in 3D)
- **270°**: Faces east (+X direction in 3D)

### Arrow Drawing
Each orientation shows:
1. **Line**: The front edge
2. **Arrow**: Points outward from the front (direction of facing)

This makes it immediately clear which way doors open and which way NPCs/players face.

## Examples

### Building a Shop Entrance
```
1. Place walls with rotation 0° (horizontal front)
2. Place door at 0° with green line facing outward
3. Place NPC spawn inside with 180° (facing door)
4. Result: NPC faces customers entering through door
```

### Creating Corner Walls
```
1. North wall: Place at 0° (green line on bottom = inner room)
2. West wall: Place at 90° (green line on left = inner room)
3. Result: Green lines face into the room, walls form corner
```

## Future Enhancements
- Multi-select for batch rotation
- Copy/paste with orientation preserved
- Flip horizontal/vertical
- Snap guides for alignment
