# Update Project Documentation Skill

## Description
This skill reminds the AI to update the project-overview skill whenever significant changes are made to the codebase. It ensures documentation stays synchronized with actual implementation.

## Triggers
This skill should be invoked:
- After implementing new features or systems
- After refactoring major components
- After adding new files or directories
- After completing user requests that change functionality
- At the end of a significant conversation
- When the user explicitly asks to update documentation

## Actions
1. Review what changes were made in the current session
2. Check the project-overview skill documentation
3. Update the overview with new features, files, or architectural changes
4. Ensure all key systems and their purposes are documented
5. Update feature lists with implementation details and file locations

## Update Checklist
When updating documentation, ensure you capture:
- ✅ New feature names and descriptions
- ✅ File paths where features are implemented
- ✅ Key functions or classes added
- ✅ Integration points with existing systems
- ✅ User-facing functionality (what users can do)
- ✅ Tool/editor enhancements
- ✅ Data structure changes

## How to Use This Skill
**The AI should automatically consider this at the end of feature work.**

User can also explicitly invoke by saying:
- "Update the project documentation"
- "Add this to the project overview"
- "Document what we just built"

## Related Skills
- project-overview (the skill being updated)
- all other skills (changes to functionality affect overview)

## Last Updated
Features documented include:
- Pause system (Game.ts, firstPersonController.ts, dayNightCycle.ts, hud.ts)
- Enhanced map editor with modal NPC selector
- Auto-opening schedule editor
- Editable waypoint times
- Map JSON import/export
- Click-and-drag tile painting
- Select tool and NPC editing workflow
