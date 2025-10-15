# Map Building System - Quick Start

## What I've Created for You ✅

### 1. **Visual Map Editor** (`tools/map-editor.html`)
A browser-based grid editor where you can:
- Draw walls, floors, doors, and windows
- Place NPC and player spawn points
- Export to JSON format
- Works offline - just open in browser!

### 2. **MapBuilder System** (`src/systems/mapBuilder.ts`)
A TypeScript class that:
- Loads JSON map files
- Converts 2D grid data to 3D Babylon.js meshes
- Creates walls, doors, windows with proper physics
- Manages spawn points for players and NPCs

### 3. **Example Map** (`public/data/maps/example_bakery.json`)
A sample bakery building to get you started

### 4. **Documentation** (`docs/map_editor_guide.md`)
Complete guide for using the system

## How to Use It

### Step 1: Open the Map Editor
```bash
# Just open the HTML file in any browser
open tools/map-editor.html
# or double-click it in your file explorer
```

### Step 2: Design Your Building
1. Click a tool (Wall, Floor, Door, etc.)
2. Click on the grid to place tiles
3. See the JSON update in real-time at the bottom

### Step 3: Export Your Map
1. Click "Download JSON" button
2. Save to `public/data/maps/your_building.json`

### Step 4: Load in Game
In `src/Game.ts`, uncomment line ~137:
```typescript
await this.mapBuilder.loadMapFromFile('/data/maps/example_bakery.json');
```

### Step 5: Run and Test
```bash
npm run dev
```

## Grid System Explained

**Simple Concept:**
- Grid is 50x50 cells
- Each cell = 10 units in the 3D world
- Total world = 500x500 units
- Center of grid (25,25) = World position (0,0,0)

**Why This Works:**
- ✅ Easy to plan on paper (just count squares)
- ✅ Easy to collaborate (share JSON files)
- ✅ Version control friendly
- ✅ No coding required to design buildings
- ✅ Visual feedback while designing

## For Collaboration

### Workflow for Team Members:

1. **Designer creates building:**
   - Opens map-editor.html
   - Designs the layout
   - Downloads JSON

2. **Developer adds to game:**
   - Places JSON in `public/data/maps/`
   - Loads it in Game.ts
   - Tests in game

3. **Share via Git:**
   ```bash
   git add public/data/maps/new_building.json
   git commit -m "Add police station building"
   git push
   ```

### File Naming Convention:
```
{area}_{type}_{name}.json

Examples:
- downtown_building_bakery.json
- plaza_building_fountain.json
- residential_house_01.json
```

## Quick Example

Let's create a simple 3x3 room:

```json
{
  "metadata": {
    "gridSize": 50,
    "cellSize": 10,
    "worldSize": 500,
    "version": "1.0.0"
  },
  "buildings": [
    {"type": "wall", "position": {"x": 0, "y": 0, "z": 0}, "gridPosition": {"x": 25, "y": 25}},
    {"type": "wall", "position": {"x": 10, "y": 0, "z": 0}, "gridPosition": {"x": 26, "y": 25}},
    {"type": "wall", "position": {"x": 20, "y": 0, "z": 0}, "gridPosition": {"x": 27, "y": 25}},
    {"type": "door", "position": {"x": 10, "y": 0, "z": 20}, "gridPosition": {"x": 26, "y": 27}},
    {"type": "floor", "position": {"x": 10, "y": 0, "z": 10}, "gridPosition": {"x": 26, "y": 26}}
  ],
  "spawns": {
    "player": [{"x": 0, "y": 1.7, "z": -50}],
    "npcs": [{"x": 10, "y": 0, "z": 10, "npcId": "shop_keeper"}]
  }
}
```

## Next Steps

1. **Try the editor**: Open `tools/map-editor.html` in your browser
2. **Create a building**: Design a simple structure
3. **Export and test**: Save JSON and load in game
4. **Iterate**: Refine based on how it looks in 3D

## Benefits of This System

✅ **Visual Design**: See your layout while building
✅ **No Coding**: Non-programmers can design buildings
✅ **Collaboration**: Share JSON files easily
✅ **Version Control**: Track changes in Git
✅ **Modular**: Create separate buildings, combine in game
✅ **Fast Iteration**: Design → Export → Test in seconds
✅ **Reusable**: Copy/modify existing buildings
✅ **Documentation**: JSON files document the world layout

## Pro Tips

1. **Start Small**: Begin with a single room
2. **Test Early**: Load in game frequently to check scale
3. **Use Layers**: Create different maps for different floors
4. **Document**: Add descriptions in metadata
5. **Backup**: Commit maps to Git regularly
6. **Templates**: Create reusable building patterns

## Questions?

Check the full guide: `docs/map_editor_guide.md`

The system is ready to use right now! 🎉
