/**
 * Example: Loading NPCs from JSON files
 * 
 * This example demonstrates how to use the ContentLoader to load NPC definitions
 * from JSON files and spawn them in the game.
 */

import { Scene } from '@babylonjs/core';
import { ContentLoader } from '../content/ContentLoader';
import { NpcSystem } from '../systems/npcSystem';
import HourlyCycle from '../systems/hourlyCycle';

/**
 * Load and spawn a single NPC from a JSON file
 */
export async function loadNpcFromFile(
  scene: Scene,
  npcSystem: NpcSystem,
  filePath: string
): Promise<void> {
  const loader = new ContentLoader('/data');
  
  const result = await loader.loadNpc(filePath);
  
  if (result.success) {
    console.log(`✅ Loaded NPC: ${result.data.name}`);
    const npc = npcSystem.createNpcFromDefinition(result.data);
    console.log(`✅ Spawned NPC: ${npc.name}`);
  } else {
    console.error(`❌ Failed to load NPC from ${filePath}:`, result.error);
    if (result.details) {
      console.error('Validation errors:', result.details);
    }
  }
}

/**
 * Load multiple NPCs from a list of file paths
 */
export async function loadMultipleNpcs(
  scene: Scene,
  npcSystem: NpcSystem,
  filePaths: string[]
): Promise<void> {
  const loader = new ContentLoader('/data');
  
  console.log(`📦 Loading ${filePaths.length} NPCs...`);
  
  const results = await loader.loadNpcs(filePaths);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const result of results) {
    if (result.success) {
      npcSystem.createNpcFromDefinition(result.data);
      successCount++;
    } else {
      failCount++;
      console.error(`❌ Failed to load NPC:`, result.error);
    }
  }
  
  console.log(`✅ Successfully loaded ${successCount} NPCs`);
  if (failCount > 0) {
    console.warn(`⚠️  Failed to load ${failCount} NPCs`);
  }
}

/**
 * Load a complete content pack with NPCs, events, and investigations
 */
export async function loadContentPack(
  scene: Scene,
  npcSystem: NpcSystem,
  packPath: string
): Promise<void> {
  const loader = new ContentLoader('/data');
  
  console.log(`📦 Loading content pack from ${packPath}...`);
  
  const result = await loader.loadContentPack(packPath);
  
  if (!result.success) {
    console.error(`❌ Failed to load content pack:`, result.error);
    return;
  }
  
  const pack = result.data;
  console.log(`✅ Loaded content pack: ${pack.name} v${pack.version}`);
  
  // Spawn all NPCs
  console.log(`  📍 Spawning ${pack.npcs.length} NPCs...`);
  for (const npcDef of pack.npcs) {
    try {
      npcSystem.createNpcFromDefinition(npcDef);
      console.log(`    ✓ ${npcDef.name}`);
    } catch (error) {
      console.error(`    ✗ Failed to spawn ${npcDef.name}:`, error);
    }
  }
  
  // TODO: Load events into LoopManager
  console.log(`  ⏱️  ${pack.events.length} events defined (not yet loaded)`);
  
  // TODO: Load investigations
  console.log(`  🔍 ${pack.investigations.length} investigations defined (not yet loaded)`);
  
  console.log(`✅ Content pack loaded successfully!`);
}

/**
 * Example usage in your Game class:
 * 
 * ```typescript
 * // In Game.ts constructor or init method:
 * 
 * // Load individual NPCs
 * await loadNpcFromFile(this.scene, this.npcSystem, 'npcs/baker.json');
 * await loadNpcFromFile(this.scene, this.npcSystem, 'npcs/guard.json');
 * 
 * // Or load multiple at once
 * await loadMultipleNpcs(this.scene, this.npcSystem, [
 *   'npcs/baker.json',
 *   'npcs/guard.json',
 *   'npcs/merchant.json'
 * ]);
 * 
 * // Or load a complete content pack
 * await loadContentPack(
 *   this.scene,
 *   this.npcSystem,
 *   'packs/bakery_scenario.json'
 * );
 * ```
 */
