# NPC Face Editor Guide

## Overview
The NPC Face Editor allows you to create custom pixel art faces for your NPCs. Each NPC can have a unique face that will be displayed in-game on a 128x128 texture.

## Features

### Drawing Canvas
- **512x512 Editor Canvas**: Large canvas for easy pixel art creation
- **128x128 Preview**: Real-time preview of how the face will look in-game
- **Pixelated Rendering**: Sharp, retro pixel art aesthetic

### Drawing Tools

#### 1. Draw Tool (✏️)
- Default tool for drawing pixels
- Use selected color and brush size
- Click and drag to draw

#### 2. Erase Tool (🧹)
- Removes pixels by painting with the NPC's skin color
- Same brush size controls as draw tool
- Useful for fixing mistakes

#### 3. Fill Tool (🪣)
- Flood fill an area with selected color
- Click on any region to fill all connected pixels of the same color
- Great for filling large areas quickly

#### 4. Eyedropper Tool (💧)
- Pick colors from the canvas
- Click any pixel to select its color
- Useful for matching existing colors

### Brush Sizes
Four square brush sizes available:
- **1x1**: Single pixel precision
- **2x2**: Small square brush
- **8x8**: Large square brush for quick coverage
- **16x16**: XL square brush (same size as default face eye)

### Color Palette

#### Preset Colors
12 pre-selected colors optimized for NPC faces:
- Black (#000000) - Eyes, outlines
- White (#FFFFFF) - Eyes, teeth
- Brown (#8B4513) - Hair, eyebrows
- Blue (#4169E1) - Eyes
- Green (#228B22) - Eyes
- Red (#FF0000) - Blush, details
- Gold (#FFD700) - Jewelry, decorations
- Pink (#FF69B4) - Blush, lips
- Gray (#808080) - Beards, shadows
- Sienna (#A0522D) - Dark hair
- Tan (#DEB887) - Light skin tones
- Purple (#9370DB) - Mystical effects

#### Custom Color Picker
- Full color picker for any hex color
- Located below the preset palette
- Selected color is automatically used for drawing

### Quick Actions

#### Clear (🗑️)
- Clears the entire canvas
- Fills with NPC's skin color
- Use this to start fresh

#### Default Face (😊)
- Loads the default hard-coded face
- Features: Simple eyes, nose, and mouth
- Good starting point for customization

## Workflow

### Creating a New Face

1. **Open NPC Editor** (`tools/npc-editor.html`)
2. **Select an NPC** from the list
3. **Click "✏️ Edit Face"** button
4. **Draw your face**:
   - Start with the Default Face button for a template
   - Or clear and draw from scratch
   - Use different tools and brush sizes as needed
5. **Preview** your work in the 128x128 preview box
6. **Save** when satisfied

### Editing an Existing Face

1. Open the Face Editor for an NPC with a saved face
2. The existing face will load automatically
3. Make your changes
4. Save to update

### Best Practices

#### Resolution Awareness
- Editor is 512x512, but game uses 128x128
- What looks smooth at 512px may look blocky at 128px
- Check the preview frequently!

#### Design Tips
- **Keep it simple**: Small details may not be visible
- **Use contrast**: High contrast features read better at low resolution
- **Symmetry**: Most faces look better when symmetrical
- **Reference the default**: The default face is well-proportioned for the 128px resolution

#### Color Choices
- Skin tones are inherited from NPC's base color
- Use darker shades for depth (eyebrows, shadows)
- Use lighter shades for highlights
- Black and white work well for high contrast features

## Technical Details

### Data Storage

#### Format
Faces are stored as Base64-encoded PNG data URLs:
```javascript
{
  "id": "baker",
  "name": "Baker",
  "faceData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

#### Size Considerations
- Base64 PNG data is quite large (10-30KB per face)
- Stored in localStorage and JSON export
- Included in full NPC collection exports

### In-Game Rendering

#### Texture Application
1. Game loads NPC definition with `faceData`
2. Creates 128x128 DynamicTexture
3. Loads face from data URL into texture
4. Applies texture to face plane mesh
5. Face plane is positioned slightly in front of head cube

#### Fallback Behavior
- If `faceData` is not provided: Uses default hard-coded face
- If `faceData` fails to load: Falls back to default face with console warning
- Default face: Simple eyes, nose, and mouth in NPC's skin color

### Canvas Details
- **Editor Canvas**: 512x512 pixels for ease of editing
- **Game Texture**: 128x128 pixels for performance
- **Downscaling**: Automatic when saving/previewing
- **Image Format**: PNG via canvas.toDataURL()

## Integration with Game

### Schema Support
The `NpcDefinition` schema includes optional `faceData`:
```typescript
{
  faceData?: string; // Base64 data URL
}
```

### NPC System
The `NPC` class constructor accepts `faceData` in options:
```typescript
const npc = new NPC(scene, name, schedule, {
  color: skinColor,
  shirtColor: shirtColor,
  pantsColor: pantsColor,
  faceData: "data:image/png;base64,..." // Optional
});
```

### Loading Process
1. `Game.ts` loads NPC definitions from JSON
2. Extracts `faceData` if present
3. Passes to `NpcSystem.createNpc()`
4. `NPC` constructor stores `faceData`
5. `buildMinecraftStyleNPC()` creates face texture
6. Custom face loaded or default face created

## Export and Import

### Exporting NPCs with Faces
When you export NPCs from the NPC Editor:
```json
[
  {
    "id": "custom_npc",
    "name": "Custom NPC",
    "color": [0.9, 0.7, 0.5],
    "shirtColor": [0.87, 0.72, 0.53],
    "pantsColor": [0.55, 0.27, 0.07],
    "faceData": "data:image/png;base64,...",
    "speed": 1.4,
    "schedule": [...],
    "metadata": {}
  }
]
```

### Importing
- Face data is preserved during import
- Compatible with both individual files and collection format
- Face images will load in-game automatically

## Troubleshooting

### Face Not Showing
- **Check console**: Look for load errors
- **Verify faceData**: Ensure it's a valid data URL
- **Check format**: Should start with "data:image/png;base64,"
- **Browser compatibility**: Ensure browser supports data URLs

### Face Looks Blurry
- This is expected - texture is 128x128
- Keep designs simple and high-contrast
- Test in-game to see actual appearance

### Face Editor Not Opening
- Check browser console for errors
- Ensure you're clicking "Edit Face" button
- Try refreshing the page
- Clear browser cache if persisting

### Changes Not Saving
- Ensure you click "💾 Save Face" button
- Check localStorage isn't full
- Verify NPC list updates after save
- Export to verify faceData is included

## Performance Considerations

### Memory Usage
- Each custom face: ~10-30KB of data
- Stored in localStorage (typically 5-10MB limit)
- ~100-200 custom faces should fit comfortably
- Consider exporting and clearing if running low on space

### Loading Time
- Face images load asynchronously
- No blocking of main thread
- Minimal performance impact
- Default face shown if custom face fails

### In-Game Performance
- 128x128 textures are very lightweight
- No impact on frame rate
- Standard Babylon.js texture management
- Efficiently cached by GPU

## Keyboard Shortcuts

Currently the Face Editor uses mouse-only controls. Potential future shortcuts:
- `D` - Draw tool
- `E` - Erase tool
- `F` - Fill tool
- `I` - Eyedropper
- `[` / `]` - Decrease/increase brush size
- `Ctrl+Z` - Undo (not yet implemented)
- `Space` - Pan canvas (not yet implemented)

## Future Enhancements

Potential improvements for future versions:
- Undo/Redo history
- Layer system
- Animation frames for expressions
- Face templates/presets
- Import/export individual faces
- Symmetry tool
- Grid overlay
- Zoom and pan
- Keyboard shortcuts
