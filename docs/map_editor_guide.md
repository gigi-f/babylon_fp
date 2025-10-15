# Map Editor Guide

## Overview

The Map Editor is a visual tool for designing buildings and placing objects in your Babylon.js game world. It uses a grid-based system where each cell represents 10 units in the 3D world.

## Getting Started

### 1. Open the Map Editor

Simply open `tools/map-editor.html` in your web browser. No server needed!

```bash
# From your project root
open tools/map-editor.html
# or
firefox tools/map-editor.html
```

### 2. Using the Tools

**Available Tools:**
- 🧱 **Wall** - Create solid walls for buildings
- ⬜ **Floor** - Create floor tiles
- 🚪 **Door** - Create doorways (interactive in-game)
- 🪟 **Window** - Create windows
- 👤 **NPC Spawn** - Mark NPC spawn points
- 🎮 **Player Spawn** - Mark player spawn points
- ❌ **Erase** - Remove tiles

**How to Use:**
1. Click a tool button to select it (it will highlight green)
2. Click on the grid to place tiles
3. Click on existing tiles with the Erase tool to remove them
4. Hover over the grid to see coordinates

### 3. Grid System

- **Grid Size**: 50x50 by default (adjustable)
- **Cell Size**: Each cell = 10 units in 3D world
- **World Size**: 500x500 units total
- **Origin**: Center of the grid is world position (0, 0, 0)

**Coordinate Conversion:**
- Grid (25, 25) = World (0, 0) (center)
- Grid (0, 0) = World (-250, -250) (top-left corner)
- Grid (50, 50) = World (250, 250) (bottom-right corner)

### 4. Exporting Your Map

Once you've designed your map:

1. **Copy JSON**: Copies the map data to your clipboard
2. **Download JSON**: Downloads as a `.json` file
3. Save the file to `/public/data/maps/your_map_name.json`

### 5. Loading Maps in Game

To load your map in the game:

1. Save your JSON file to `/public/data/maps/`
2. In `src/Game.ts`, uncomment and modify the map loading line:

```typescript
// In the init() method
await this.mapBuilder.loadMapFromFile('/data/maps/your_map_name.json');
```

## Building Types

### Walls
- Default height: 3 units
- Blocks player movement
- Used for building exteriors and interiors

### Floors
- Thin tiles (0.1 units high)
- Create interior floors or platforms
- Collision enabled

### Doors
- Height: 2.2 units
- Width: 1.0 units
- Can be made interactive with the DoorSystem
- Initially blocks movement

### Windows
- Placed higher on walls (1.5 units from top)
- Semi-transparent
- Blocks movement (glass)

### Spawn Points
- **Player Spawn**: Where the player starts
- **NPC Spawn**: Where NPCs are placed
- Include `npcId` in the JSON to link to specific NPC data

## Tips for Collaboration

### Version Control
- Save maps as JSON files in `/public/data/maps/`
- Commit maps to git for team collaboration
- Use descriptive filenames: `bakery_shop.json`, `town_plaza.json`

### Map Organization
Create separate maps for different areas:
- `town_center.json` - Main plaza
- `residential_01.json` - House group 1
- `commercial_bakery.json` - Bakery building
- `police_station.json` - Police station

### Naming Conventions
```
{area}_{building_type}_{variant}.json

Examples:
- downtown_shop_general.json
- downtown_shop_bakery.json
- residential_house_01.json
- plaza_fountain.json
```

### Map Metadata
Always include metadata in your maps:

```json
{
  "metadata": {
    "gridSize": 50,
    "cellSize": 10,
    "worldSize": 500,
    "version": "1.0.0",
    "description": "Town bakery - single story building",
    "author": "Your Name",
    "created": "2025-10-15"
  },
  ...
}
```

## Advanced Usage

### Multi-Story Buildings
To create multi-story buildings:
1. Create multiple floor plans as separate map files
2. Load them with different Y offsets in code:

```typescript
// Ground floor
await this.mapBuilder.loadMapFromFile('/data/maps/building_floor1.json');

// Second floor - offset Y position in the JSON or in code
// Modify positions before building
```

### Complex Structures
For complex buildings:
1. Start with the outer walls
2. Add interior walls to create rooms
3. Place floors
4. Add doors and windows
5. Mark spawn points for NPCs

### Performance Tips
- Keep maps under 500 tiles for best performance
- Use floor tiles sparingly (they add geometry)
- Group related structures in separate map files
- Reuse maps with position offsets for similar buildings

## Example Workflow

1. **Sketch**: Draw your building layout on paper
2. **Design**: Open map editor and create the structure
3. **Export**: Download JSON file
4. **Save**: Move to `/public/data/maps/`
5. **Test**: Load in game and walk through
6. **Iterate**: Adjust and refine
7. **Commit**: Save to version control

## Troubleshooting

**Map doesn't load:**
- Check browser console for errors
- Verify JSON syntax is valid
- Ensure file path is correct

**Walls overlap or look wrong:**
- Remember each cell is 10 units wide
- Check grid coordinates vs world coordinates
- Verify wall thickness settings

**Player gets stuck:**
- Add doors where needed
- Check for overlapping collision geometry
- Verify spawn points are in valid locations

## Future Enhancements

Planned features:
- [ ] Undo/Redo functionality
- [ ] Copy/Paste regions
- [ ] Rotation tools
- [ ] Prefab buildings (templates)
- [ ] Height adjustments
- [ ] Texture selection
- [ ] 3D preview
- [ ] Multi-map management
