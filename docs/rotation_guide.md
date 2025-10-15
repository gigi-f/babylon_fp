# Map Building with Rotation

## Overview

The map building system now supports rotation for walls, doors, and windows. This allows you to create proper buildings with walls oriented in any direction.

## Grid System

- **Cell Size**: 1 unit (smallest unit)
- **Grid Size**: 100x100 (default)
- **World Size**: 100x100 units
- **Wall Dimensions**: 2 units wide × 1 unit deep × 3 units tall
- **Door Dimensions**: 2 units wide × 1 unit deep × 2.2 units tall
- **Window Dimensions**: 2 units wide × 1 unit deep × 1.5 units tall

## Rotation

### In the Map Editor

1. **Rotation Dropdown**: Select 0°, 90°, 180°, or 270°
2. **Keyboard Shortcut**: Press 'R' to rotate by 90° increments

### Rotation Values

- **0°**: Horizontal (default) - 2 units wide along X-axis, 1 unit deep along Z-axis
- **90°**: Vertical - 1 unit wide along X-axis, 2 units deep along Z-axis
- **180°**: Horizontal (flipped)
- **270°**: Vertical (flipped)

## How to Build Continuous Walls

### Horizontal Wall (0° or 180°)
Place walls at grid positions with X-spacing of 2:
```
Grid: (0,0) → (2,0) → (4,0) → (6,0)
World: x=-50, x=-48, x=-46, x=-44
```

### Vertical Wall (90° or 270°)
Place walls at grid positions with Y-spacing of 2:
```
Grid: (0,0) → (0,2) → (0,4) → (0,6)
World: z=-50, z=-48, z=-46, z=-44
```

### Creating Corners
```
Horizontal wall at (0,0) rotation=0°
Vertical wall at (0,0) rotation=90°
```

## JSON Format

```json
{
  "type": "wall",
  "position": { "x": 0, "y": 0, "z": 4 },
  "gridPosition": { "x": 50, "y": 54 },
  "rotation": 90
}
```

**Note**: `rotation` field is optional. If omitted, defaults to 0°.

## Tips

1. **Planning Buildings**: Sketch on graph paper with 1-unit squares
2. **Wall Placement**: Use even-numbered grid coordinates for 2-unit-wide elements
3. **Testing**: Export and test frequently in-game
4. **Keyboard Efficiency**: Use 'R' key for quick rotation while placing
5. **Visual Feedback**: The map editor shows rotation visually (coming soon)

## Example: Simple Room

```
Grid positions for a 4x4 room:

North wall (horizontal, 0°): (0,0), (2,0), (4,0)
South wall (horizontal, 0°): (0,4), (2,4), (4,4)
West wall (vertical, 90°): (0,0), (0,2), (0,4)
East wall (vertical, 90°): (4,0), (4,2), (4,4)
Door (horizontal, 0°): (2,4)
Floor tiles: All positions from (0,0) to (4,4)
```

## Migration from Old Maps

Old maps without rotation will default to 0° (horizontal orientation). You may need to:
1. Identify vertically-placed walls
2. Add `"rotation": 90` to their JSON entries
3. Adjust grid positions if needed

## Future Enhancements

- Visual rotation indicator in map editor
- Snap-to-grid for continuous walls
- Wall direction auto-detection
- Copy/paste with rotation
