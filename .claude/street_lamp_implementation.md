# Street Lamp Implementation Guide

## Overview
Street lamps in babylon_fp are environmental lighting entities that flow from the map editor through to the 3D game world, with automatic day/night cycle integration.

## Architecture

### System Components

1. **Map Editor** (`tools/map-editor.html`)
   - Entity type: `"streetLamp"`
   - Properties: `intensity`, `range`, `decayRate`
   - Located in grid coordinates, converted to world coordinates before export

2. **Street Lamp System** (`src/systems/streetLamp.ts`)
   - Full implementation exists and is functional
   - Manages day/night intensity cycling
   - Methods: `addLight()`, `removeLight()`, `getLights()`, `toggleStreetLamps()`, `updateIntensity()`
   - Expected interface:
     ```typescript
     interface StreetLampEntity {
       x: number;
       y: number;
       z: number;
       intensity: number;
       range: number;
       decayRate?: number;
     }
     ```

3. **Map Builder** (`src/systems/mapBuilder.ts`)
   - Method: `buildStreetLamp(position: Vector3)` (line ~759)
   - Instantiates Babylon.js PointLight
   - Calls `lamp.attachToCycle(this.dayNightCycleSystem)` for automatic day/night control

### Data Pipeline Flow

```
Map Editor (tools/map-editor.html)
    ↓
    Place streetLamp entity
    Set: intensity, range, decayRate
    Export to JSON
    ↓
World JSON (public/data/maps/world.json)
    ↓
    {
      "type": "streetLamp",
      "id": "streetLamp_1",
      "position": [x, y, z],
      "properties": {
        "intensity": 0.8,
        "range": 20,
        "decayRate": 1.2
      }
    }
    ↓
Content Loader (src/content/ContentLoader.ts)
    ↓
Map Builder (src/systems/mapBuilder.ts)
    ↓
    createEntity() switch → case 'streetLamp'
    Calls buildStreetLamp(position)
    ↓
Street Lamp System
    ↓
    addLight(lamp)
    attachToCycle(dayNightCycleSystem)
    ↓
3D Scene Rendering
    ↓
Day/Night Cycle Events
    ↓
Auto-intensity updates
```

## Integration Patterns

### Similar Systems Reference

Compare street lamps to other entity types for consistency:

| Aspect | Door System | Street Lamp |
|--------|------------|------------|
| Data Storage | JSON with properties | JSON with properties |
| 3D Asset | Model mesh | PointLight (primitive) |
| Creation | createDoor() in mapBuilder | buildStreetLamp() in mapBuilder |
| System | doorSystem class | streetLamp class |
| Interaction | Click-based | Auto-passive (time-based) |
| Integration | Setup once | attachToCycle() for dynamic updates |

### Key Implementation Details

1. **Coordinate System**
   - Map editor uses grid coordinates (0, 1, 2, ...)
   - Converts to world coordinates: `worldX = ((gridX + offset) - size/2) * CELL_SIZE`
   - Position passed to mapBuilder is ALREADY in world coordinates
   - **CRITICAL:** Do NOT multiply by GRID_CELL_SIZE again in buildStreetLamp()

2. **Day/Night Integration**
   - StreetLamp class has `attachToCycle(system)` method
   - Called immediately after lamp instantiation
   - System automatically modulates intensity based on solar elevation
   - No manual intensity updates needed

3. **Property Ranges** (from map editor)
   - `intensity`: 0-2 (default 1.0)
   - `range`: 1-50 meters (default 20)
   - `decayRate`: 0-2 (default 1, optional)

## Bugs Fixed

### Bug 1: Double Coordinate Multiplication
**Problem:** buildStreetLamp was multiplying position by GRID_CELL_SIZE even though position was already in world coordinates
```typescript
// WRONG (old code):
const lampPosition = new Vector3(
  position.x * GRID_CELL_SIZE,  // Double-scales!
  0,
  position.z * GRID_CELL_SIZE
);
```

**Solution:** Use position directly
```typescript
// CORRECT:
const lamp = new StreetLamp(this.scene, position);
```

### Bug 2: Missing Day/Night Cycle Integration
**Problem:** Street lamps were created but never attached to the day/night cycle system
**Solution:** Call attachToCycle() immediately after instantiation
```typescript
const lamp = new StreetLamp(this.scene, position);
lamp.attachToCycle(this.dayNightCycleSystem);  // Critical!
```

## Testing Checklist

- [ ] Open map-editor.html
- [ ] Select "streetLamp" from entity type dropdown
- [ ] Place street lamp on map grid
- [ ] Set intensity, range, decayRate properties
- [ ] Export map to JSON
- [ ] Verify JSON contains streetLamp entity with correct properties
- [ ] Load game world
- [ ] Verify street lamps appear at correct positions
- [ ] Verify lamps brighten at night, dim during day
- [ ] Verify intensity changes smoothly with day/night cycle

## Code References

| File | Component | Purpose |
|------|-----------|---------|
| `tools/map-editor.html` | Entity editor UI | Place and configure street lamps |
| `src/systems/streetLamp.ts` | StreetLamp class | Day/night cycle management |
| `src/systems/mapBuilder.ts` | buildStreetLamp() | 3D instantiation |
| `public/data/maps/world.json` | Map data | Entity definitions |
| `src/systems/dayNightCycle.ts` | Day/night system | Provides time-based intensity |

## Common Issues & Solutions

### Issue: Street lamps not appearing
- Check position coordinates are valid
- Verify JSON is valid and contains streetLamp entities
- Ensure streetLamp system is registered in SystemManager

### Issue: Lamps not changing intensity with time
- Verify `attachToCycle()` was called
- Check dayNightCycleSystem is available in MapBuilder
- Verify StreetLamp class has cycle attachment logic

### Issue: Lamps positioned incorrectly
- Verify position is NOT being multiplied by GRID_CELL_SIZE
- Check world coordinates in JSON match expected positions
- Compare with other tile creation methods for consistency

## Future Enhancements

Potential improvements for street lamps:
- [ ] Add flickering/pulsing effect options
- [ ] Support for colored lights (e.g., warm/cool tones)
- [ ] Cone-shaped lights instead of point lights
- [ ] Sound effects (hum, flicker sound)
- [ ] Light on/off interaction toggle
- [ ] Performance optimization for many lamps