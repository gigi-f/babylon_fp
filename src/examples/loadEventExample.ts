/**
 * Example: Loading and handling events from JSON files
 * 
 * This example demonstrates how to use the ContentLoader to load event definitions
 * from JSON files and schedule them in the LoopManager.
 */

import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core';
import { ContentLoader } from '../content/ContentLoader';
import { LoopManager } from '../systems/loopManager';
import type { LoopEventDefinition } from '../content/schemas';

/**
 * Load and schedule a single event from a JSON file
 */
export async function loadEventFromFile(
  loop: LoopManager,
  filePath: string,
  handler: (scene: Scene, definition: LoopEventDefinition) => void
): Promise<void> {
  const loader = new ContentLoader('/data');
  
  const result = await loader.loadEvent(filePath);
  
  if (result.success) {
    console.log(`✅ Loaded event: ${result.data.id} (type: ${result.data.type})`);
    loop.scheduleEventFromDefinition(result.data, handler);
    console.log(`✅ Scheduled event at ${result.data.triggerTime}s`);
  } else {
    console.error(`❌ Failed to load event from ${filePath}:`, result.error);
    if (result.details) {
      console.error('Validation errors:', result.details);
    }
  }
}

/**
 * Load multiple events from a list of file paths
 */
export async function loadMultipleEvents(
  loop: LoopManager,
  filePaths: string[],
  handler: (scene: Scene, definition: LoopEventDefinition) => void
): Promise<void> {
  const loader = new ContentLoader('/data');
  
  console.log(`📦 Loading ${filePaths.length} events...`);
  
  const results = await loader.loadEvents(filePaths);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const result of results) {
    if (result.success) {
      loop.scheduleEventFromDefinition(result.data, handler);
      successCount++;
    } else {
      failCount++;
      console.error(`❌ Failed to load event:`, result.error);
    }
  }
  
  console.log(`✅ Successfully loaded ${successCount} events`);
  if (failCount > 0) {
    console.warn(`⚠️  Failed to load ${failCount} events`);
  }
}

/**
 * Generic event handler that dispatches based on event type
 */
export function handleGameEvent(scene: Scene, definition: LoopEventDefinition): void {
  console.log(`⏰ Event triggered: ${definition.id} (type: ${definition.type})`);
  
  switch (definition.type) {
    case 'crime':
      handleCrimeEvent(scene, definition);
      break;
    case 'patrol':
      handlePatrolEvent(scene, definition);
      break;
    case 'interaction':
      handleInteractionEvent(scene, definition);
      break;
    case 'custom':
      handleCustomEvent(scene, definition);
      break;
  }
}

/**
 * Handle crime events - spawn visual indicators and trigger gameplay
 */
function handleCrimeEvent(scene: Scene, definition: LoopEventDefinition): void {
  console.log('🚨 Crime event triggered!');
  
  // Access metadata for crime-specific data
  const crimeType = definition.metadata?.crimeType || 'unknown';
  const severity = definition.metadata?.severity || 'low';
  
  console.log(`  Type: ${crimeType}, Severity: ${severity}`);
  
  // Spawn visual indicator at crime location
  if (definition.position) {
    const crimeMarker = MeshBuilder.CreateSphere(
      `crime_${definition.id}`,
      { diameter: 0.5 },
      scene
    );
    crimeMarker.position = new Vector3(
      definition.position.x,
      definition.position.y + 0.5,
      definition.position.z
    );
    
    const mat = new StandardMaterial(`crime_mat_${definition.id}`, scene);
    mat.emissiveColor = Color3.Red();
    crimeMarker.material = mat;
    
    // Auto-cleanup after 5 seconds
    setTimeout(() => {
      crimeMarker.dispose();
    }, 5000);
  }
  
  // TODO: Trigger investigation system
  // TODO: Alert nearby NPCs
  // TODO: Add to crime log
}

/**
 * Handle patrol events - update NPC patrol routes
 */
function handlePatrolEvent(scene: Scene, definition: LoopEventDefinition): void {
  console.log('👮 Patrol event triggered!');
  
  const patrolRoute = definition.metadata?.route || 'default';
  console.log(`  Route: ${patrolRoute}`);
  
  // TODO: Update patrol NPC positions
  // TODO: Check for nearby crimes
}

/**
 * Handle interaction events - trigger NPC conversations or activities
 */
function handleInteractionEvent(scene: Scene, definition: LoopEventDefinition): void {
  console.log('💬 Interaction event triggered!');
  
  const interactionType = definition.metadata?.interactionType || 'conversation';
  const participantIds = definition.metadata?.participants || [];
  
  console.log(`  Type: ${interactionType}, Participants: ${participantIds.join(', ')}`);
  
  // TODO: Trigger NPC interaction
  // TODO: Show dialogue UI
}

/**
 * Handle custom events - execute custom game logic
 */
function handleCustomEvent(scene: Scene, definition: LoopEventDefinition): void {
  console.log('⚙️  Custom event triggered!');
  
  const customType = definition.metadata?.customType;
  console.log(`  Custom type: ${customType}`);
  
  // Custom event logic based on metadata
  // This allows for flexible event types without modifying code
}

/**
 * Load events from a content pack
 */
export async function loadContentPackEvents(
  loop: LoopManager,
  packPath: string
): Promise<void> {
  const loader = new ContentLoader('/data');
  
  console.log(`📦 Loading events from content pack: ${packPath}`);
  
  const result = await loader.loadContentPack(packPath);
  
  if (!result.success) {
    console.error(`❌ Failed to load content pack:`, result.error);
    return;
  }
  
  const pack = result.data;
  console.log(`✅ Loaded content pack: ${pack.name} v${pack.version}`);
  console.log(`  📅 ${pack.events.length} events to schedule`);
  
  // Schedule all events with the generic handler
  loop.scheduleEventsFromDefinitions(pack.events, handleGameEvent);
  
  console.log(`✅ All events scheduled!`);
}

/**
 * Example: Advanced event handling with custom callbacks per event type
 */
export async function loadEventsWithCustomHandlers(
  loop: LoopManager,
  packPath: string
): Promise<void> {
  const loader = new ContentLoader('/data');
  const result = await loader.loadContentPack(packPath);
  
  if (!result.success) {
    console.error('Failed to load pack:', result.error);
    return;
  }
  
  // Schedule each event with a type-specific handler
  for (const eventDef of result.data.events) {
    switch (eventDef.type) {
      case 'crime':
        loop.scheduleEventFromDefinition(eventDef, (scene, def) => {
          // Crime-specific handler with specialized logic
          handleCrimeEvent(scene, def);
          // Additional crime-specific processing
          notifyInvestigationSystem(def);
        });
        break;
        
      case 'patrol':
        loop.scheduleEventFromDefinition(eventDef, (scene, def) => {
          handlePatrolEvent(scene, def);
        });
        break;
        
      default:
        loop.scheduleEventFromDefinition(eventDef, handleGameEvent);
    }
  }
}

/**
 * Example: Event filtering and conditional loading
 */
export async function loadEventsConditionally(
  loop: LoopManager,
  packPath: string,
  difficulty: 'easy' | 'normal' | 'hard'
): Promise<void> {
  const loader = new ContentLoader('/data');
  const result = await loader.loadContentPack(packPath);
  
  if (!result.success) {
    console.error('Failed to load pack:', result.error);
    return;
  }
  
  // Filter events based on difficulty
  const filteredEvents = result.data.events.filter(eventDef => {
    const eventDifficulty = eventDef.metadata?.difficulty || 'normal';
    
    switch (difficulty) {
      case 'easy':
        return eventDifficulty === 'easy';
      case 'normal':
        return eventDifficulty === 'easy' || eventDifficulty === 'normal';
      case 'hard':
        return true; // All events
    }
  });
  
  console.log(`Loading ${filteredEvents.length}/${result.data.events.length} events for ${difficulty} difficulty`);
  
  loop.scheduleEventsFromDefinitions(filteredEvents, handleGameEvent);
}

// Stub function for investigation system integration
function notifyInvestigationSystem(eventDef: LoopEventDefinition): void {
  // TODO: Integrate with investigation system when implemented
  console.log(`  🔍 Investigation system notified: ${eventDef.id}`);
}

/**
 * Example usage in Game class:
 * 
 * ```typescript
 * // In Game.ts constructor or init method:
 * 
 * // Load individual event
 * await loadEventFromFile(
 *   this.loopManager,
 *   'events/crime_theft.json',
 *   handleGameEvent
 * );
 * 
 * // Load multiple events
 * await loadMultipleEvents(
 *   this.loopManager,
 *   [
 *     'events/crime_theft.json',
 *     'events/patrol_route1.json',
 *     'events/interaction_market.json'
 *   ],
 *   handleGameEvent
 * );
 * 
 * // Load all events from content pack
 * await loadContentPackEvents(
 *   this.loopManager,
 *   'packs/bakery_scenario.json'
 * );
 * 
 * // Load events with difficulty filter
 * await loadEventsConditionally(
 *   this.loopManager,
 *   'packs/main_scenario.json',
 *   'normal'
 * );
 * ```
 */
