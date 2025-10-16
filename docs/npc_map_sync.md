# NPC Editor and Map Editor Synchronization

## Overview
The Map Editor now automatically syncs with the NPC Editor, ensuring that the list of available NPCs stays consistent between both tools.

## How It Works

### Storage Key
Both editors use the same localStorage key: `babylon-fp-npc-editor-v1`

- **NPC Editor**: Writes NPC definitions to localStorage whenever changes are made
- **Map Editor**: Reads from the same localStorage key to populate the NPC dropdown

### Automatic Syncing

1. **On Load**: When you open the Map Editor, it automatically loads all NPCs from the NPC Editor's localStorage
2. **Dynamic Population**: The NPC dropdown is dynamically populated with all NPCs created in the NPC Editor
3. **Color Mapping**: Each NPC's color (from shirt or skin color) is automatically applied to NPC spawn markers on the map
4. **Emoji Assignment**: NPCs get appropriate emojis based on their name/type

### Manual Refresh

If you make changes in the NPC Editor while the Map Editor is open:
1. Click the **🔄 Refresh** button next to the NPC Type dropdown
2. The NPC list will reload from localStorage
3. The map will redraw to show updated colors

## Workflow

### Step 1: Create NPCs
1. Open `tools/npc-editor.html`
2. Create or edit NPCs with custom colors, names, etc.
3. NPCs are automatically saved to localStorage

### Step 2: Place NPCs on Map
1. Open `tools/map-editor.html`
2. NPC list is automatically loaded from NPC Editor
3. Select an NPC type from the dropdown
4. Place NPC spawn points on the map
5. Each spawn point will display in the NPC's color

### Step 3: Update and Refresh
If you need to add more NPCs:
1. Switch to NPC Editor tab
2. Add/edit NPCs
3. Switch back to Map Editor tab
4. Click **🔄 Refresh** button
5. New NPCs are now available in the dropdown

## Features

### Dynamic NPC Dropdown
- Automatically populated from localStorage
- Shows NPC name with appropriate emoji
- Uses NPC ID as the value for map data

### Color Coding
- Each NPC type gets a unique color on the map
- Colors derived from shirt color (or skin color if no shirt)
- RGB arrays (0-1 range) automatically converted to hex

### Emoji Mapping
NPCs automatically get emojis based on their name:
- Baker → 🥖
- Guard → 🛡️
- Beggar → 🪙
- Merchant → 💰
- Farmer → 🌾
- Blacksmith → 🔨
- Priest/Cleric → ⛪
- Noble → 👑
- Child → 👶
- Default → 👤

### Fallback Behavior
If no NPCs are found in localStorage:
- Map Editor uses default NPCs (baker, guard, beggar)
- Console logs "Using default NPC list"
- You can still place spawn points normally

## Technical Details

### Code Location
- **Map Editor**: `tools/map-editor.html`
  - `loadNpcsFromStorage()`: Reads from localStorage
  - `populateNpcList()`: Updates dropdown and color mapping
  - `refreshNpcList()`: Manual refresh trigger
  - `colorArrayToHex()`: Converts RGB arrays to hex colors
  - `getEmojiForNpc()`: Assigns emojis based on NPC name

### Data Format
NPCs in localStorage are stored as a JSON array:
```json
[
  {
    "id": "baker",
    "name": "Baker",
    "color": [0.9, 0.7, 0.5],
    "shirtColor": [0.87, 0.72, 0.53],
    "pantsColor": [0.55, 0.27, 0.07],
    "speed": 1.4,
    "schedule": [...],
    "metadata": {}
  }
]
```

### Map Data Format
NPC spawn points in map JSON:
```json
{
  "type": "npc-spawn",
  "npcType": "baker",
  "x": 10,
  "z": 5,
  "rotation": 0,
  "schedule": [...]
}
```

## Benefits

1. **Single Source of Truth**: NPC Editor is the authoritative source for NPC definitions
2. **No Manual Copying**: No need to manually update NPC lists in multiple places
3. **Consistent Colors**: NPC colors automatically match across editors
4. **Flexible Workflow**: Edit NPCs and maps in any order
5. **Easy Updates**: Simple refresh button to sync changes

## Troubleshooting

### NPCs Not Showing
- Check browser console for errors
- Verify NPCs exist in NPC Editor
- Click the 🔄 Refresh button
- Try reloading the Map Editor page

### Wrong Colors
- Colors come from `shirtColor` (preferred) or `color` (fallback)
- Check NPC definitions in NPC Editor
- Click 🔄 Refresh to reload colors

### Default NPCs Only
- NPCs might not be saved in NPC Editor
- Click Export in NPC Editor to verify data
- Check browser localStorage using DevTools
- Key should be `babylon-fp-npc-editor-v1`
