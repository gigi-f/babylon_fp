# Brainstorming — Unique Gameplay Mechanics & Procedural Content

This document expands on the core time loop mystery mechanics from [`docs/roadmap.md`](roadmap.md) and [`docs/creative.md`](creative.md) with innovative ideas to make the game unique, fun, and replayable.

---

## 1. Unique Core Mechanics

### 1.1 Multi-Exposure Photography
- **Concept**: Instead of single snapshots, certain clues require **layered exposures** across multiple loops
  - Take a photo of the town square at 9 AM in Loop 1, then the same spot at 3 PM in Loop 2
  - Overlay the images in the darkroom to reveal hidden patterns (ghost trails, temporal echoes)
  - Example: A cult member's path becomes visible only when 3+ photos of the same location at different times are combined
- **Implementation**: Store photo metadata (location, time, loop number) and provide a darkroom UI for manual overlay/comparison
- **Gameplay value**: Encourages strategic photo planning and rewards attention to detail across loops

### 1.2 Intoxication as Dual-Edged Sword
- **Enhanced Mechanics**:
  - **Sober State**: Sharp controls, reliable memory, but "normal" reality—can't see temporal anomalies or cult symbols
  - **Mild Intoxication**: Shaky camera (adds challenge to photos), but reveals shimmer effects around ritual sites and inter-dimensional "folds"
  - **Heavy Intoxication**: Controls deteriorate, vision blurs, but grants access to exclusive "blackout memories"—cutscenes of events Rahul witnessed but can't consciously recall
  - **Hangover State** (next loop): Partial memory loss—previous loop's photos are blurry or corrupted unless developed immediately
- **Strategic Choice**: Players must balance drinking for clue access vs. sobriety for execution precision
- **Narrative Tie-in**: Drinking mimics Rahul's character arc—addiction as both crutch and curse

### 1.3 Dynamic NPC Memory System
- **Concept**: NPCs remember player actions *across loops*, but imperfectly
  - Help an NPC in Loop 1 → they're slightly friendlier in Loop 2, may share a secret
  - Interrogate aggressively → NPCs become defensive or stop answering questions in future loops
  - Plant evidence → NPCs may reference it later, creating false leads you must untangle
- **Memory Decay**: NPC memories fade over 2–3 loops unless reinforced by repeated interactions
- **Cult Awareness**: If Rahul gets too close to the truth, cult members coordinate to mislead him in subsequent loops (gaslighting mechanic)
- **Implementation**: Track NPC "affinity" and "suspicion" scores per loop; trigger dialogue branches and behavior changes based on thresholds

### 1.4 Temporal Graffiti & Player Messages
- **Concept**: Leave notes, symbols, or photos for your "future self" in later loops
  - Scrawl a clue on a wall (e.g., "Check bakery at 11 AM") that persists across loops
  - Pin photos to a corkboard in Rahul's safehouse—organize investigation visually
  - Use chalk or spray paint to mark safe paths, suspicious locations, or ritual sites
- **Discovery**: Early loops feel chaotic; later loops become increasingly organized as player builds a web of evidence
- **Meta-Gameplay**: Players literally "teach themselves" how to solve the mystery

### 1.5 The "Echo" System
- **Concept**: Major player actions create **temporal echoes**—ghostly reenactments visible in later loops
  - Confront an NPC at the town square → a faint, translucent version of that confrontation replays at the same time in Loop 3
  - Solve a crime publicly → NPCs gather to discuss it in subsequent loops, changing their schedules
- **Gameplay**: Echoes can obstruct or guide—a past argument might block a doorway, or reveal where an NPC was standing during a crime
- **Visual Design**: Echoes render as low-poly, desaturated wireframes with subtle glow—fitting the lo-fi aesthetic

---

## 2. Innovative Investigation Mechanics

### 2.1 Audio Spectral Analysis
- **Concept**: Record ambient sounds (muzak, clock ticks, NPC conversations) with a tape recorder
  - Play recordings backward or speed them up in the lab to decode hidden messages
  - Example: The clocksmith's mutterings contain reversed ritual chants; the bakery's muzak skips at timestamps matching crime times
- **Technical**: Use Web Audio API for real-time pitch/speed manipulation
- **Clue Type**: Audio becomes a first-class evidence type alongside photos

### 2.2 Object "Haunting"
- **Concept**: Certain objects (ritual candles, cult tokens, the anchor flask) leave **residual auras** visible only through the camera viewfinder
  - Example: A stolen trophy glows faintly in photos, creating a trail back to the thief
  - Cult symbols on walls are invisible to the naked eye but appear in photographs
- **Mechanic**: Photograph objects/locations to reveal hidden information not visible during normal exploration
- **Inspired by**: Fatal Frame's ghost photography, but applied to mundane mystery objects

### 2.3 Predictive Newspaper Puzzles
- **Concept**: The librarian's newspapers print "future" headlines—but they're cryptic and conditional
  - Example: "Theft at Bakery — Suspect Wears Red" appears at 9 AM; the crime happens at 3 PM
  - If Rahul prevents the crime, the headline changes: "Attempted Bakery Break-In Foiled by Stranger"
- **Gameplay**: Use newspapers to anticipate crimes and position yourself for perfect photo evidence
- **Branching**: Headlines can mislead if cult members plant false evidence

### 2.4 Topiary Telepathy
- **Concept**: Ms. Voss's topiaries subtly shift to mimic suspects' postures
  - A topiary shaped like the mayor droops when he's lying; one resembling the baker leans toward the ritual site
- **Mechanic**: Photograph topiaries at different times to track suspect behavior
- **Hidden Depth**: Topiaries change faster near ritual events—visual timers for escalation

### 2.5 Confession Candy Interrogations
- **Concept**: Mr. Pudd's candies force NPCs to tell one truth when consumed
  - Rahul can gift candies (or slip them into drinks) to extract confessions
  - Each candy works once per NPC per loop—must choose interrogation targets carefully
- **Risk**: Giving candy to a cult member may expose Rahul's investigation, triggering retaliation
- **Ethical Choice**: The game doesn't punish using candies, but NPCs comment on feeling "violated," adding moral weight

---

## 3. Procedural & Randomized Content

### 3.1 Procedural Low-Poly Trees
- **Visual Style**: Blocky, L-system-based trees with vertex-colored foliage (no textures)
  - Parameters: trunk angle variance, branch recursion depth (2–3 levels), leaf cluster size
  - Color palette: Saturated pastels (mint, lavender, peachy-orange) with occasional neon accents for "wrong" trees near ritual sites
- **Technical Implementation**:
  ```typescript
  // Pseudo-code for tree generation
  function generateLowPolyTree(seed: number, params: TreeParams) {
    const rng = seededRandom(seed);
    const trunkHeight = params.baseHeight + rng() * params.heightVariance;
    const trunkMesh = createCylinderMesh(trunkHeight, params.trunkRadius);
    
    // Recursive branching
    function addBranches(parentNode, depth, remainingDepth) {
      if (remainingDepth === 0) {
        addLeafCluster(parentNode, rng);
        return;
      }
      const branchCount = 2 + Math.floor(rng() * 2); // 2-3 branches
      for (let i = 0; i < branchCount; i++) {
        const angle = (i / branchCount) * Math.PI * 2 + rng() * 0.5;
        const branch = createBranch(parentNode, angle, rng);
        addBranches(branch, depth + 1, remainingDepth - 1);
      }
    }
    
    addBranches(trunkMesh, 0, params.recursionDepth);
    applyLowPolyMaterial(trunkMesh, chooseColor(rng, params.palette));
    return trunkMesh;
  }
  ```
- **Seeded Generation**: Use deterministic seeds tied to world coordinates so trees are consistent across loops
- **Anomaly Trees**: Near ritual sites, generate "wrong" trees—upside-down, pulsing neon, or with geometry that defies physics (Escher-like branches)

### 3.2 Procedural Building Interiors
- **Concept**: Generate room layouts for minor buildings (homes, side shops) on first visit
  - Fixed template pool (bedroom, kitchen, living room modules)
  - Randomize furniture placement, color schemes, and decorative props within templates
  - Clues placed deterministically: "crime site" rooms always have 2 interactive objects
- **Benefits**: Increases replayability—non-critical buildings feel different each playthrough
- **Seeded by Loop**: Interiors regenerate every 5–10 loops to keep exploration fresh

### 3.3 Dynamic Graffiti & Street Art
- **Concept**: K's murals change content based on player progress
  - Early loops: Abstract shapes
  - After discovering cult: Murals subtly depict ritual symbols or member silhouettes
  - Final loops: Murals animate to point toward the church or anchor object
- **Procedural Element**: Generate mural patterns using noise functions (Perlin/simplex) and apply cult symbol stencils
- **Player Interaction**: Photograph murals at different stages to decode messages

### 3.4 Randomized Crime Variants
- **Concept**: Each playthrough shuffles minor crime details while keeping core structure
  - Bakery theft: Victim, stolen item, and time vary within a 2-hour window
  - Smashed trophy: Location alternates between 3 possible rooms in mayor's office
  - Missing person: Different NPC each playthrough (excluding core story NPCs)
- **Clue Consistency**: Core clue chains (e.g., "find 3 photos to unlock church") remain static, but surrounding events differ
- **Replayability**: Encourages multiple playthroughs without feeling repetitive

### 3.5 Procedural Soundscapes
- **Concept**: Layer ambient audio dynamically based on location, time, and loop progress
  - Baseline: Lo-fi synth loops, distant traffic, clock ticks
  - Near ritual sites: Add reversed vocals, dissonant harmonics, micro-tempo shifts
  - Late loops: Increase audio glitches and déjà vu effects (repeated sound bites)
- **Procedural Variation**: Randomly pitch-shift and time-stretch audio clips each loop to create subtle unease
- **Technical**: Use Web Audio API's `AudioContext` for real-time effects

### 3.6 Generative NPC Daily Routines
- **Concept**: NPCs have core waypoints (work, home, social) but shuffle minor activities
  - Baker always opens shop at 8 AM, but alternates between restocking at 10 AM or chatting with florist at 10:30 AM
  - Bus driver's route includes 5 core stops, but order varies slightly each loop
- **Purpose**: Reduces predictability—players can't memorize exact schedules, must actively observe
- **Implementation**: JSON schedules with "flex" time slots that randomize within constraints

---

## 4. Unique World-Building Mechanics

### 4.1 "Fold" Zones
- **Concept**: Hidden areas accessible only when Rahul is intoxicated or during specific loop conditions
  - Example: A door in the library that's "painted on" when sober but opens to a tunnel system when drunk
  - Fold zones contain lore notes, cult artifacts, and shortcut paths between buildings
- **Visual Design**: Fold zones use inverted color palettes (neon on dark) and impossible geometry (Escher stairs, non-Euclidean hallways)
- **Risk/Reward**: Entering folds while heavily drunk risks "getting lost"—camera blacks out, Rahul wakes up at a random location with fragmented memory

### 4.2 Underground Cult Tunnels
- **Layout**: Procedurally connected tunnels linking the church basement to 5–7 key buildings
  - Tunnels contain ritual chambers, evidence lockers, and hidden observation posts
- **Discovery**: Find entrances by photographing floor anomalies (discolored tiles, faint symbols) or following cult members
- **Hazard**: Cult members patrol tunnels—if caught, Rahul is ejected and NPCs become hostile in next loop
- **Mapping**: Players can draw/annotate tunnel maps in the notebook UI

### 4.3 The "Anchor Object" as Puzzle Box
- **Concept**: The artifact (flask + jukebox) isn't just a plot device—it's an interactive multi-stage puzzle
  - Stage 1: Discover it exists (hidden in bar basement)
  - Stage 2: Photograph it to reveal rune inscriptions
  - Stage 3: Play specific songs on jukebox in correct order (decoded from audio clues)
  - Stage 4: Pour ritual spirits into flask while jukebox plays—triggers final confrontation
- **Failure States**: Wrong song order scrambles runes; wrong liquid causes temporal "skip" (loop resets mid-action)

### 4.4 Reactive World Events
- **Concept**: Major player actions trigger town-wide responses
  - Expose a cult member publicly → emergency town hall meeting, NPCs debate, schedules change
  - Prevent a crime → victim NPC offers help, shares secret, or becomes suspicious of Rahul's foreknowledge
  - Destroy evidence → cult stages a counter-crime to distract Rahul
- **Butterfly Effect**: Creates branching loop states—no two playthroughs feel identical

---

## 5. Player Progression & Meta-Mechanics

### 5.1 Sobriety Skill Tree
- **Concept**: As Rahul maintains sobriety across loops, unlock permanent perks
  - "Steady Hands": Reduced camera shake, easier photo timing
  - "Clear Mind": Improved memory—notebook auto-annotates repeat events
  - "Sober Vision": Detect faint anomalies without drinking (reduced reliance on intoxication)
- **Counterpoint**: Drinking unlocks temporary "Drunk Vision" perks (see echoes, access folds)
- **Narrative Payoff**: Sobriety endings reward skill tree investment; addiction endings show consequences

### 5.2 Notebook as Living Document
- **Concept**: Auto-populating investigation journal with tabs:
  - **Evidence**: Photos, audio clips, notes organized by category
  - **NPCs**: Auto-generated profiles with observed schedules, relationships, secrets
  - **Map**: Hand-drawn style with player annotations and echo markers
  - **Timeline**: Visual timeline of events across loops—identify patterns
- **Interaction**: Players can pin items, draw connections (red string/conspiracy board aesthetic), and set reminders for next loop

### 5.3 Loop Mastery System
- **Concept**: Track player efficiency across loops—award "mastery" badges
  - "Perfect Photo": Capture all clues in a single loop
  - "Shadow Detective": Complete investigation without NPCs noticing
  - "Speedrunner": Solve mystery in under 5 loops
- **Rewards**: Cosmetic (camera skins, outfit colors) or unlockable challenge modes (drunk-only, photo-less runs)

### 5.4 Alternate Loop Paths
- **Concept**: After first playthrough, unlock alternate starting conditions
  - "Sober Start": Begin loops with no intoxication—harder mode
  - "Cult Infiltrator": Start disguised as a member—access tunnels early but must maintain cover
  - "Time Scramble": Events occur in randomized order—ultimate challenge

---

## 6. Surreal & Memorable Moments

### 6.1 The Midnight Mayor Parade
- **Event**: At exactly midnight every loop, Mayor Pippin announces a parade—but it never actually starts
  - Floats materialize as low-poly wireframes, NPCs freeze mid-applause, confetti falls upward
  - Photographing the parade reveals hidden cult symbols on float banners
- **Easter Egg**: If Rahul drinks heavily and waits until 12:01 AM, the parade "glitches" into motion for 10 seconds—reveals a secret route to the church

### 6.2 The Confessional Bus Ride
- **Event**: Ride Gareth's night bus after 10 PM while drunk
  - Bus enters a "time fold"—passengers are ghosts of past loops, whispering clues
  - Rahul can't exit until the ride ends—forced to listen to fragmented testimonies
- **Clue Type**: Audio-only evidence—requires multiple rides to piece together full statements

### 6.3 The Living Flowers
- **Event**: Photograph Iris's flowers during eclipse events (rare loop trigger)
  - Petals detach and float toward ritual sites, creating a glowing trail
  - Follow the trail to discover a cult meeting in progress—photograph for major evidence

### 6.4 The Bleeding Clock
- **Event**: At Jory's clockshop, the grandfather clock "bleeds" red light at 3:33 AM/PM
  - Photographing the clock face reveals a hidden map of fold zone entrances
  - Clock hands spin backward if Rahul is near the anchor object

### 6.5 The Mirror Mural
- **Event**: K paints a mural of Rahul's face that ages across loops
  - Loop 1: Young and optimistic
  - Loop 5: Tired and disheveled
  - Loop 10+: Cracked and distorted, eyes glowing (reflects Rahul's descent or ascension)
- **Purpose**: Visual representation of player's moral/story progress

---

## 7. Technical Implementation Ideas

### 7.1 Instanced Mesh System for Performance
- **Use Case**: Trees, streetlamps, and minor props
  ```typescript
  // Pseudo-code for instancing
  const treeTemplate = generateLowPolyTree(0, defaultParams);
  const instancedTrees = new InstancedMesh(treeTemplate, 100);
  
  for (let i = 0; i < 100; i++) {
    const position = getTownTreePosition(i);
    instancedTrees.setInstanceAt(i, position, rotation, scale);
  }
  ```
- **Benefits**: Render 100+ trees at minimal performance cost

### 7.2 Deterministic Seeding for Consistency
- **Implementation**: Use seeded PRNG (e.g., `mulberry32`) keyed to world coordinates + loop number
  ```typescript
  function seededRandom(seed: number) {
    return function() {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }
  
  const treeAtXY = generateLowPolyTree(hashCoords(x, y), params);
  ```
- **Result**: Trees, graffiti, and crime details are consistent across loops but differ between playthroughs

### 7.3 Photo Storage & Compression
- **Concept**: Store photos as low-res thumbnails (128x128) + metadata
  - Use canvas `toDataURL('image/jpeg', 0.7)` for compression
  - Store up to 50 photos per save file (~500KB total)
- **Darkroom UI**: Scale up thumbnails with nearest-neighbor filtering (preserves blocky aesthetic)

### 7.4 Audio Reversal & Effects
- **Implementation**: Use Web Audio API's `OfflineAudioContext`
  ```typescript
  function reverseAudio(audioBuffer: AudioBuffer) {
    const reversed = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const input = audioBuffer.getChannelData(channel);
      const output = reversed.getChannelData(channel);
      for (let i = 0; i < input.length; i++) {
        output[i] = input[input.length - 1 - i];
      }
    }
    return reversed;
  }
  ```

---

## 8. Content Expansion Hooks

### 8.1 DLC / Expansion Ideas
- **"The Forgotten Loops"**: Prequel campaign as a different detective investigating the cult 10 years prior
- **"New Dawn Ascendant"**: Post-game campaign where Rahul joins/opposes the cult's next ritual
- **"Drunk Mode" Challenge Pack**: 10 puzzle scenarios solvable only while heavily intoxicated

### 8.2 Modding Support
- **JSON-Driven Content**: All NPCs, crimes, and clues defined in JSON—easy for community to create custom mysteries
- **Custom Tree Shaders**: Expose procedural generation parameters for players to design surreal flora
- **Photo Challenges**: Community-submitted "scavenger hunt" photo lists

### 8.3 Speedrun & Challenge Modes
- **"One Loop Wonder"**: Solve the mystery in a single loop (requires perfect play)
- **"No Photos"**: Solve using only audio and environmental clues
- **"Blind Drunk"**: Complete the game while permanently intoxicated (hardest difficulty)

---

## 9. Polish & Juice Ideas

### 9.1 Camera Feedback
- **Shutter Sound**: Lo-fi, satisfying click with subtle reverb
- **Flash Effect**: Brief white overlay + particle burst (low-poly sparkles)
- **Film Advance**: Physical film counter on HUD decrements with tactile animation

### 9.2 Darkroom Ritual
- **UI Design**: Overhead view of darkroom table—drag photos into chemical trays
- **Development Animation**: Photos fade in over 3 seconds, revealing hidden details in stages
- **Optional Mini-Game**: Adjust chemical ratios for optimal clarity (too much = overexposed, too little = underexposed)

### 9.3 NPC Reaction Animations
- **Caught in Photo**: NPC briefly freezes, then glances at camera nervously (if guilty) or waves (if innocent)
- **Confession Candy**: NPC's eyes briefly glow, speech stutters, then delivers truth in monotone
- **Loop Memory**: NPC does a double-take if they recognize Rahul from previous loops

### 9.4 Environmental Storytelling
- **Trash Cans**: Contain discarded ritual notes, candy wrappers with messages, torn photos
- **Posters**: Town event posters change subtly across loops (dates shift, text corrupts)
- **Graffiti Tags**: K's signature symbol appears in more locations as loops progress—tracking the artist's anxiety

---

## 10. Accessibility & Quality of Life

### 10.1 Colorblind Modes
- **Options**: Deuteranopia, Protanopia, Tritanopia palette swaps
- **Clue Markers**: Add symbol shapes alongside color-coded clues (e.g., cult symbols also pulse)

### 10.2 Photo Assist Mode
- **Feature**: Outline important photograph targets with faint highlight when aiming camera
- **Justification**: Reduces pixel-hunting frustration while maintaining challenge

### 10.3 Text-to-Speech for Notes
- **Feature**: Voice-acted readings of all diary entries, notes, and newspaper headlines
- **Style**: Distorted, lo-fi voice filter matching game's aesthetic

### 10.4 Save Anywhere
- **Feature**: Manual save at any point (separate from loop auto-saves)
- **Use Case**: Experiment with different choices without replaying entire loops

---

## Summary

This brainstorming document proposes:
- **10+ unique mechanics** (multi-exposure photos, dynamic NPC memory, temporal graffiti, echo system)
- **6 procedural content systems** (trees, buildings, graffiti, crimes, soundscapes, NPC routines)
- **5 investigation innovations** (audio analysis, object haunting, predictive newspapers, topiary telepathy, confession candy)
- **4 world-building systems** (fold zones, cult tunnels, anchor puzzle, reactive events)
- **Progression systems** (sobriety skill tree, notebook, loop mastery, alternate paths)
- **Technical implementations** (instancing, seeding, photo storage, audio effects)

All ideas align with the game's lo-fi, surreal, time-loop mystery core while adding depth, replayability, and unique moments that differentiate it from other detective games.

Next steps: Prototype 2–3 high-priority mechanics (multi-exposure photos, procedural trees, NPC memory) and playtest for fun factor before expanding.
