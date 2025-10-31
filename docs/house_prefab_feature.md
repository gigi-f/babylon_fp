# House Prefab Feature Documentation

## Overview
The map editor now includes a **House Prefab** tool that allows quick placement of complete houses with a single click.

## House Structure
Each house prefab creates a **6x6 cell footprint** with the following components:

### Layout
```
┌─────────────┐
│ W   ...   W │
│ .   ...   . │
│ .  FLOOR  . │
│ .   ...   . │
│ D   ...   . │
└─────────────┘

W = Window
D = Door
. = Outer Wall (perimeter)
FLOOR = Inner 4x4 floor (empty interior)
```

### Components
1. **Outer Walls**: 1 cell thick perimeter (gray color #666)
2. **Inner Floor**: 4x4 grid of floor tiles in the center (light gray #ddd)
3. **Door**: Single door on the "front" facing (brown #8B4513)
4. **Windows**: Two windows positioned on perpendicular sides (light blue #87CEEB)

## Usage

### Basic Placement
1. Click the **🏠 House** button in the toolbar
2. Click on the map canvas where you want the house (top-left corner will be placed at click position)
3. The complete house structure is instantly created

### Rotation
Houses are rotatable to change which side the door faces:
- **Rotation 0** (default): Door faces down/south, windows on left/right
- **Rotation 1** (90°): Door faces right/east, windows on top/bottom  
- **Rotation 2** (180°): Door faces up/north, windows on left/right
- **Rotation 3** (270°): Door faces left/west, windows on top/bottom

**To rotate**: Use the rotation controls before placing (same as other tools like doors and vehicles)

### Erasing
Use the **❌ Erase** tool to remove any individual tiles or the entire house footprint

## Technical Details

### Map Editor Changes
- Added `🏠 House` button to tool palette
- Added house color (#8B7355) to tile colors
- Registered house as rotatable tool with 6x6 grid footprint
- Added legend entry showing house color and label
- Implemented `placeHousePrefab()` function that:
  - Clears 6x6 footprint
  - Places perimeter walls
  - Fills interior with floor tiles
  - Places door and windows based on rotation

### Game Engine
- Individual tiles (walls, floors, doors, windows) are already supported by MapBuilder
- Prefab houses export/import as individual building tiles
- No changes needed to MapBuilder - existing tile rendering handles all house components

### Data Format
Houses are exported to JSON as individual building tiles:
```json
{
  "type": "wall|floor|door|window",
  "position": { "x": 0, "y": 0, "z": 0 },
  "gridPosition": { "x": 50, "y": 50 },
  "rotation": 0  // for walls, doors, windows
}
```

## Examples

### Standard House
- Place at grid (45, 45) with default rotation (0)
- Results in 6x6 area with door facing south

### Rotated House
- Select house tool
- Press 'R' to rotate
- Repeat until door faces desired direction
- Click to place

### Accessing the Map Editor
Open in browser: `file:///path/to/babylon_fp/tools/map-editor.html`

## Future Enhancements
Possible improvements for future iterations:
- Multi-room interiors
- Different house styles/sizes
- Interior furniture/decorations
- Roof variations
- Customizable door/window counts
