# Content Loading System

## Overview

The Content Loading System enables **data-driven game content** by separating game logic from content definitions. Game designers can create NPCs, events, and investigations in JSON files without touching TypeScript code.

## Architecture

```
public/data/          # JSON content files
  ├── npcs/          # NPC definitions
  ├── events/        # Loop event definitions
  ├── investigations/# Investigation definitions
  └── packs/         # Complete content packs

src/content/         # Content system code
  ├── schemas.ts     # Zod validation schemas
  └── ContentLoader.ts  # JSON loading with validation
```

## Key Components

### 1. Schemas (`src/content/schemas.ts`)

Defines the structure and validation rules for all content types using [Zod](https://zod.dev/):

- **NpcDefinitionSchema**: Validates NPC appearance, behavior, and schedule
- **LoopEventDefinitionSchema**: Validates time-triggered events
- **InvestigationDefinitionSchema**: Validates investigations with clues and suspects
- **ContentPackSchema**: Validates collections of content

### 2. ContentLoader (`src/content/ContentLoader.ts`)

Handles loading and validating JSON files:

```typescript
const loader = new ContentLoader('/data');

// Load individual content
const npc = await loader.loadNpc('npcs/baker.json');
const event = await loader.loadEvent('events/crime.json');
const investigation = await loader.loadInvestigation('investigations/case1.json');

// Load complete pack
const pack = await loader.loadContentPack('packs/scenario1.json');
```

### 3. System Integration

Game systems accept content definitions:

```typescript
// NpcSystem
if (result.success) {
  const npc = npcSystem.createNpcFromDefinition(result.data);
}
```

## Content Format Reference

### NPC Definition

**File**: `public/data/npcs/*.json`

```json
{
  "id": "npc_baker",
  "name": "Baker Bob",
  "color": [0.9, 0.7, 0.5],
  "speed": 1.5,
  "schedule": {
    "0": { "x": 0, "y": 0, "z": 0 },
    "30": { "x": 10, "y": 0, "z": 5 },
    "60": { "x": 0, "y": 0, "z": 0 }
  },
  "metadata": {
    "role": "merchant",
    "dialogue": "Fresh bread!"
  }
}
```

**Fields**:
- `id` (string, required): Unique identifier
- `name` (string, required): Display name
- `color` (array, required): RGB color `[r, g, b]` where each value is 0-1
- `speed` (number, optional): Movement speed (default: 2.0)
- `schedule` (object, required): Time-to-position mapping
  - Keys: Time in seconds as strings (`"0"`, `"30"`, `"60"`)
  - Values: 3D positions `{x, y, z}`
- `metadata` (object, optional): Custom data for gameplay

### Loop Event Definition

**File**: `public/data/events/*.json`

```json
{
  "id": "event_crime_001",
  "triggerTime": 45.0,
  "type": "crime",
  "position": { "x": 10, "y": 0, "z": -5 },
  "repeat": true,
  "repeatInterval": 120.0,
  "metadata": {
    "crimeType": "theft",
    "severity": "high"
  }
}
```

**Fields**:
- `id` (string, required): Unique identifier
- `triggerTime` (number, required): When event triggers (seconds in loop)
- `type` (enum, required): `"crime"`, `"patrol"`, `"interaction"`, or `"custom"`
- `position` (object, optional): World position `{x, y, z}`
- `repeat` (boolean, optional): Whether event repeats (default: false)
- `repeatInterval` (number, optional): Repeat interval in seconds
- `metadata` (object, optional): Custom event data

### Investigation Definition

**File**: `public/data/investigations/*.json`

```json
{
  "id": "case_bread_thief",
  "title": "The Missing Bread",
  "description": "Someone stole bread from the bakery",
  "clues": [
    {
      "id": "clue_footprints",
      "position": { "x": 15, "y": 0, "z": 8 },
      "description": "Muddy footprints",
      "discoveryTime": 10.0
    }
  ],
  "suspects": ["npc_thief", "npc_guard"],
  "solution": {
    "culprit": "npc_thief",
    "requiredClues": ["clue_footprints", "clue_witness"]
  }
}
```

**Fields**:
- `id` (string, required): Unique identifier
- `title` (string, required): Investigation title
- `description` (string, required): Investigation description
- `clues` (array, required): Available clues
  - `id`: Clue identifier
  - `position`: World position
  - `description`: Clue description
  - `discoveryTime` (optional): When clue becomes available
- `suspects` (array, required): List of suspect NPC IDs
- `solution` (object, required): Investigation solution
  - `culprit`: Culprit NPC ID
  - `requiredClues`: Array of clue IDs needed to solve
- `metadata` (object, optional): Custom investigation data

### Content Pack

**File**: `public/data/packs/*.json`

A content pack bundles multiple content types together:

```json
{
  "id": "pack_bakery_scenario",
  "name": "Bakery District Scenario",
  "version": "1.0.0",
  "description": "Complete bakery district with NPCs and investigation",
  "npcs": [ /* NPC definitions */ ],
  "events": [ /* Event definitions */ ],
  "investigations": [ /* Investigation definitions */ ]
}
```

## Usage Examples

### Loading Individual Content

```typescript
import { ContentLoader } from './content/ContentLoader';
import { NpcSystem } from './systems/npcSystem';

const loader = new ContentLoader('/data');
const npcSystem = new NpcSystem(scene, hourlyCycle);

// Load NPC
const result = await loader.loadNpc('npcs/baker.json');
if (result.success) {
  console.log('Loaded:', result.data.name);
  const npc = npcSystem.createNpcFromDefinition(result.data);
} else {
  console.error('Failed:', result.error);
  console.error('Details:', result.details);
}
```

### Loading Multiple NPCs

```typescript
const paths = ['npcs/baker.json', 'npcs/guard.json', 'npcs/merchant.json'];
const results = await loader.loadNpcs(paths);

for (const result of results) {
  if (result.success) {
    npcSystem.createNpcFromDefinition(result.data);
  }
}
```

### Loading Content Pack

```typescript
const pack = await loader.loadContentPack('packs/bakery_scenario.json');
if (pack.success) {
  // Load all NPCs
  pack.data.npcs.forEach(npcDef => {
    npcSystem.createNpcFromDefinition(npcDef);
  });
  
  // Load events (TODO: implement in LoopManager)
  // Load investigations (TODO: implement investigation system)
}
```

## Validation and Error Handling

The system validates all content against schemas:

```typescript
const result = await loader.loadNpc('invalid.json');

if (!result.success) {
  console.error('Validation failed:', result.error);
  
  // Details contain Zod validation issues
  if (result.details) {
    result.details.forEach(issue => {
      console.error(`- ${issue.path.join('.')}: ${issue.message}`);
    });
  }
}
```

Common validation errors:
- Missing required fields
- Invalid color format (must be `[r, g, b]` with values 0-1)
- Invalid schedule format (keys must be numeric strings)
- Invalid event type (must be one of the enum values)
- Invalid version format (must be semver like `1.0.0`)

## Best Practices

### 1. Content Organization

```
public/data/
  ├── npcs/
  │   ├── merchants/
  │   │   ├── baker.json
  │   │   └── butcher.json
  │   └── guards/
  │       ├── day_guard.json
  │       └── night_guard.json
  ├── events/
  │   ├── crimes/
  │   └── patrols/
  └── packs/
      ├── tutorial.json
      └── main_story.json
```

### 2. Content Naming

- Use descriptive IDs: `npc_baker`, `event_crime_theft`, `case_missing_bread`
- Use lowercase with underscores
- Include type prefix for clarity

### 3. Schedule Design

- Use meaningful time points (seconds in loop)
- Ensure NPCs have at least 2 schedule points
- Consider loop duration when planning schedules
- Y coordinate should match ground level (usually 0)

### 4. Metadata Usage

Store custom gameplay data in `metadata` fields:

```json
{
  "metadata": {
    "occupation": "baker",
    "shop": "main_bakery",
    "friendliness": 8,
    "dialogue_tree": "baker_conversations"
  }
}
```

## Testing Content

### Manual Testing

1. Start dev server: `npm run dev`
2. Open browser console
3. Check for loading errors
4. Verify NPCs appear at correct positions

### Automated Testing

Tests are in `tests/content/ContentLoader.test.ts`:

```bash
npm test ContentLoader
```

### Validation Testing

Use the validation functions directly:

```typescript
import { validateNpcDefinition } from './content/schemas';

const json = /* load from file */;
const result = validateNpcDefinition(json);

if (!result.success) {
  console.error('Validation errors:', result.error.issues);
}
```

## Future Enhancements

- [ ] Hot-reload support for development
- [ ] Content editor UI
- [ ] Event loading in LoopManager
- [ ] Investigation system integration
- [ ] Content pack dependencies
- [ ] Localization support
- [ ] Asset references (models, textures)
- [ ] Content versioning and migration

## Related Files

- `src/content/schemas.ts` - Schema definitions
- `src/content/ContentLoader.ts` - Loading implementation
- `src/systems/npcSystem.ts` - NPC system with JSON support
- `tests/content/ContentLoader.test.ts` - Test suite
- `src/examples/loadNpcExample.ts` - Usage examples
- `public/data/` - Example content files

## Troubleshooting

### NPCs not appearing

- Check browser console for loading errors
- Verify JSON file is in `public/data/` directory
- Ensure schedule has valid positions
- Check color values are 0-1 range

### Validation errors

- Compare your JSON against schema examples
- Check for missing required fields
- Verify numeric values are not strings
- Ensure color is array format `[r, g, b]`, not object

### File not found (404)

- Verify file path relative to `/data`
- Check file exists in `public/data/`
- Ensure Vite dev server is running
- Clear browser cache if needed

## See Also

- [action_plan.md](./action_plan.md) - Phase 4: Data-Driven Content
- [implementation_progress.md](./implementation_progress.md) - Progress tracking
- [Zod Documentation](https://zod.dev/) - Schema validation library
