# State Serialization Usage Guide

This guide explains how to use the state serialization system for save/load functionality.

## Overview

The state serialization system provides a complete infrastructure for saving and loading game state. It consists of:

1. **State Interfaces** (`src/state/gameState.ts`) - Define the structure of serialized data
2. **StateManager** (`src/state/StateManager.ts`) - Handles persistence and validation
3. **Serializable Interface** - Systems implement this to support serialization

## Quick Start

### Saving Game State

```typescript
import { StateManager } from './state/StateManager';

// Create state manager
const stateManager = new StateManager();

// Serialize current game state
const gameState: GameState = {
  version: STATE_VERSION,
  timestamp: Date.now(),
  loopManager: loopManager.serialize(),
  npcSystem: npcSystem.serialize(),  // To be implemented
  doorSystem: doorSystem.serialize(), // To be implemented
  photoSystem: photoSystem.serialize(), // To be implemented
  dayNightCycle: dayNightCycle.serialize(), // To be implemented
  hourlyCycle: hourlyCycle.serialize(), // To be implemented
};

// Save to localStorage
stateManager.saveToLocalStorage('manual1', gameState);

// Or save as quicksave
stateManager.saveToLocalStorage('quicksave', gameState);
```

### Loading Game State

```typescript
// Load from save slot
const saveData = stateManager.loadFromLocalStorage('manual1');

if (saveData) {
  // Restore state to systems
  loopManager.deserialize(saveData.state.loopManager);
  npcSystem.deserialize(saveData.state.npcSystem);
  doorSystem.deserialize(saveData.state.doorSystem);
  // ... etc
  
  console.log('Game loaded from', new Date(saveData.metadata.timestamp));
}
```

### Listing Available Saves

```typescript
const saves = stateManager.listSaves();

saves.forEach(save => {
  console.log(`Slot: ${save.slot}`);
  console.log(`Saved: ${new Date(save.timestamp).toLocaleString()}`);
  console.log(`Loop time: ${save.loopTime}s`);
  console.log(`Version: ${save.version}`);
});
```

## Save Slots

The system supports multiple save slots:

- `'auto'` - Automatic save (overwritten regularly)
- `'quicksave'` - Quick save (F5 key)
- `'manual1'` - Manual save slot 1
- `'manual2'` - Manual save slot 2
- `'manual3'` - Manual save slot 3

```typescript
// Check if a save exists
if (stateManager.hasSave('manual1')) {
  // Load it
  const save = stateManager.loadFromLocalStorage('manual1');
}

// Delete a save
stateManager.deleteSave('manual1');

// Clone a save
stateManager.cloneSave('manual1', 'manual2');
```

## Import/Export

Export saves to files for backup or sharing:

```typescript
// Export to JSON file (triggers download)
stateManager.exportToFile('manual1');

// Import from file
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.onchange = async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const saveData = await stateManager.importFromFile(file, 'manual1');
    console.log('Save imported:', saveData.metadata);
  }
};
fileInput.click();
```

## Implementing Serialization in Systems

To make a system serializable:

### 1. Define State Interface

```typescript
// In src/state/gameState.ts
export interface MySystemState {
  someValue: number;
  someArray: string[];
  someObject: { x: number; y: number };
}
```

### 2. Implement Serializable Interface

```typescript
import { Serializable } from '../state/gameState';
import type { MySystemState } from '../state/gameState';

export class MySystem implements Serializable<MySystemState> {
  private someValue: number = 0;
  private someArray: string[] = [];
  
  serialize(): MySystemState {
    return {
      someValue: this.someValue,
      someArray: [...this.someArray],
      someObject: { x: 1, y: 2 },
    };
  }
  
  deserialize(state: MySystemState): void {
    this.someValue = state.someValue;
    this.someArray = [...state.someArray];
    // Restore internal state
  }
}
```

### 3. Add to GameState

```typescript
// Update GameState interface
export interface GameState {
  version: string;
  timestamp: number;
  loopManager: LoopManagerState;
  mySystem: MySystemState; // Add your system
  // ... other systems
}
```

## Important Notes

### Event Callbacks

⚠️ **Event callbacks cannot be serialized!**

When LoopManager is deserialized, events lose their callbacks. You must re-register them:

```typescript
// After deserializing
loopManager.deserialize(savedState.loopManager);

// Re-register event callbacks
loopManager.scheduleEvent('crime1', 60, stagedCrimeAt(scene, pos));
// ... re-register all events
```

To help with this, use `getSerializedEventIds()`:

```typescript
const eventIds = loopManager.getSerializedEventIds();
console.log('Need to re-register:', eventIds);
```

### Babylon.js Objects

Babylon.js objects (meshes, materials, etc.) cannot be directly serialized. Instead:

1. Serialize relevant data (positions, rotations, states)
2. On deserialize, recreate or update existing objects

Example:

```typescript
// Don't do this:
serialize() {
  return { mesh: this.mesh }; // ❌ Won't work
}

// Do this instead:
serialize() {
  return {
    position: {
      x: this.mesh.position.x,
      y: this.mesh.position.y,
      z: this.mesh.position.z,
    },
    rotation: { /* ... */ },
    isVisible: this.mesh.isVisible,
  };
}

deserialize(state) {
  // Update existing mesh
  this.mesh.position.set(state.position.x, state.position.y, state.position.z);
  this.mesh.isVisible = state.isVisible;
}
```

## Validation

State is automatically validated on load:

```typescript
try {
  const save = stateManager.loadFromLocalStorage('manual1');
} catch (error) {
  console.error('Invalid save file:', error);
  // Handle error (corrupted save, incompatible version, etc.)
}
```

You can also manually validate:

```typescript
import { validateGameState } from './state/gameState';

const result = validateGameState(someState);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

## Best Practices

1. **Save Frequently**: Auto-save on significant events (checkpoint reached, level completed, etc.)

2. **Version Your State**: The `STATE_VERSION` constant helps handle format changes

3. **Test Round-Trips**: Always test that serialized state can be deserialized and produces the same behavior

4. **Handle Missing Data**: Be defensive when deserializing:
   ```typescript
   deserialize(state) {
     this.value = state.value ?? DEFAULT_VALUE;
     this.array = state.array || [];
   }
   ```

5. **Validate Early**: Validate state as soon as it's loaded, before applying it

6. **Metadata is Your Friend**: Include useful metadata in saves (playtime, location, screenshot, etc.)

## Example: Complete Save/Load Flow

```typescript
// Save game
function saveGame(slot: SaveSlot) {
  const gameState: GameState = {
    version: STATE_VERSION,
    timestamp: Date.now(),
    loopManager: loopManager.serialize(),
    npcSystem: npcSystem.serialize(),
    doorSystem: doorSystem.serialize(),
    photoSystem: photoSystem.serialize(),
    dayNightCycle: dayNightCycle.serialize(),
    hourlyCycle: hourlyCycle.serialize(),
  };
  
  stateManager.saveToLocalStorage(slot, gameState, {
    playTime: getPlayTime(),
  });
  
  console.log('Game saved to', slot);
}

// Load game
function loadGame(slot: SaveSlot) {
  const saveData = stateManager.loadFromLocalStorage(slot);
  
  if (!saveData) {
    console.error('No save found in slot', slot);
    return false;
  }
  
  try {
    // Deserialize all systems
    loopManager.deserialize(saveData.state.loopManager);
    npcSystem.deserialize(saveData.state.npcSystem);
    doorSystem.deserialize(saveData.state.doorSystem);
    photoSystem.deserialize(saveData.state.photoSystem);
    dayNightCycle.deserialize(saveData.state.dayNightCycle);
    hourlyCycle.deserialize(saveData.state.hourlyCycle);
    
    // Re-register event callbacks
    registerGameEvents();
    
    console.log('Game loaded from', slot);
    return true;
  } catch (error) {
    console.error('Failed to load game:', error);
    return false;
  }
}

// Auto-save every 5 minutes
setInterval(() => {
  if (game.isRunning) {
    saveGame('auto');
  }
}, 5 * 60 * 1000);

// Quick save on F5
window.addEventListener('keydown', (e) => {
  if (e.key === 'F5') {
    e.preventDefault();
    saveGame('quicksave');
    showNotification('Quick save created');
  }
});

// Quick load on F9
window.addEventListener('keydown', (e) => {
  if (e.key === 'F9') {
    e.preventDefault();
    if (loadGame('quicksave')) {
      showNotification('Quick save loaded');
    }
  }
});
```

## Testing

Test serialization in your system tests:

```typescript
describe('MySystem Serialization', () => {
  it('should maintain state through round-trip', () => {
    mySystem.someValue = 42;
    
    const state = mySystem.serialize();
    const newSystem = new MySystem();
    newSystem.deserialize(state);
    
    expect(newSystem.someValue).toBe(42);
  });
  
  it('should be JSON-serializable', () => {
    const state = mySystem.serialize();
    const json = JSON.stringify(state);
    const parsed = JSON.parse(json);
    
    mySystem.deserialize(parsed);
    // Verify state is correct
  });
});
```

## Troubleshooting

### "Invalid state" error on load

- Check that all required fields are present in the serialized state
- Verify the state version matches
- Check for typos in property names

### Objects not updating after deserialize

- Make sure you're updating the actual objects, not just internal variables
- Verify Babylon.js objects still exist
- Check that dispose wasn't called on objects

### Save file too large

- Consider compressing data before saving
- Don't serialize unnecessary data
- Use indices instead of full object references where possible

## Summary

The state serialization system provides:
- ✅ Type-safe serialization
- ✅ Automatic validation
- ✅ Multiple save slots
- ✅ Import/export functionality
- ✅ Metadata tracking
- ✅ Easy to extend for new systems

Follow the patterns in `LoopManager` to implement serialization in other systems!
