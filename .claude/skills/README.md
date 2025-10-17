# Claude Skills for Babylon FP Project

This directory contains custom Claude Skills that provide bash automation and project management capabilities.

## What are Skills?

Skills are reusable, filesystem-based resources that give Claude specialized capabilities for specific tasks. They work through a progressive disclosure model where Claude only loads what's needed when needed.

## Available Skills

### 1. TypeScript Build Checker (`typescript-build-checker/`)
**When to use**: TypeScript compilation errors, build issues, type checking

**Key Commands**:
- Check for errors: `npx tsc --noEmit`
- Build project: `npm run build`
- Watch mode: `npx tsc --watch --noEmit`

### 2. Dev Server Manager (`dev-server-manager/`)
**When to use**: Starting/stopping dev server, testing the game, server troubleshooting

**Key Commands**:
- Start server: `npm run dev`
- Check if running: `lsof -i :5173`
- Stop server: `pkill -f "vite"`

### 3. Data Backup Manager (`data-backup-manager/`)
**When to use**: Backing up maps/NPCs, creating snapshots, restoring data

**Key Commands**:
- Create backup: `TIMESTAMP=$(date +%Y%m%d_%H%M%S) && mkdir -p backups/$TIMESTAMP && cp -r public/data backups/$TIMESTAMP/`
- List backups: `ls -lht backups/`
- Restore latest: `LATEST=$(ls -t backups/ | head -1) && cp -r backups/$LATEST/data/* public/data/`

### 4. Test Runner (`test-runner/`)
**When to use**: Running tests, checking coverage, debugging test failures

**Key Commands**:
- Run all tests: `npm test`
- Watch mode: `npm run test:watch`
- Coverage: `npm run test:coverage`

### 5. Project Overview (`project-overview/`)
**When to use**: Getting project stats, health checks, understanding structure

**Key Commands**:
- Line counts: `find src -name "*.ts" -exec wc -l {} + | tail -1`
- File counts: `find src -name '*.ts' | wc -l`
- Health check: Comprehensive validation script included

**Recent Features Documented**:
- Pause system (Game.ts, firstPersonController.ts, dayNightCycle.ts)
- Enhanced map editor with NPC modal, auto schedule editor
- Editable waypoint times, map import/export
- Click-and-drag tile painting

### 6. Update Project Documentation (`update-project-docs/`)
**When to use**: After implementing features, at end of sessions, when documentation needs updating

**Purpose**: 
- Reminds AI to update project-overview when changes are made
- Ensures documentation stays synchronized with code
- Captures new features, systems, and file locations

**Triggers Automatically**:
- After implementing new features
- After refactoring major components
- At conversation end with significant changes

**Manual Invocation**: "Update the project documentation"

## How Claude Uses Skills

1. **Skill Discovery**: Claude reads the `name` and `description` from each SKILL.md frontmatter
2. **Automatic Triggering**: When you mention something matching a skill's description, Claude loads it
3. **Command Execution**: Claude executes bash commands from the skill via the terminal
4. **Progressive Loading**: Only loads what's needed, when needed

## Example Usage

**You say**: "Check if there are any TypeScript errors in the project"
**Claude does**: 
1. Recognizes this matches "TypeScript Build Checker" skill
2. Loads the skill's instructions
3. Runs `cd /home/gianfiorenzo/Documents/Vs\ Code/babylon_fp && npx tsc --noEmit`
4. Reports the results

**You say**: "Create a backup of all the game data"
**Claude does**:
1. Recognizes this matches "Data Backup Manager" skill
2. Loads the backup instructions
3. Creates timestamped backup directory
4. Copies all data files
5. Confirms backup location

## Skill Structure

Each skill follows this structure:
```
skill-name/
├── SKILL.md          # Required: Instructions with YAML frontmatter
└── scripts/          # Optional: Executable scripts (future enhancement)
```

## Benefits

- ✅ **No Repetition**: Define commands once, use automatically
- ✅ **Context Aware**: Claude knows when to use each skill
- ✅ **Token Efficient**: Skills load on-demand, not upfront
- ✅ **Composable**: Can combine multiple skills in one task
- ✅ **Maintainable**: Update skills without changing conversations

## Adding New Skills

To add a new skill:

1. Create directory: `.claude/skills/my-new-skill/`
2. Create `SKILL.md` with frontmatter:
```markdown
---
name: My New Skill
description: What it does and when to use it
---

# My New Skill

Instructions and commands here...
```

3. Claude will automatically discover and use it!

## Best Practices

1. **Specific Descriptions**: Make descriptions clear about when to trigger
2. **Full Paths**: Always use absolute paths in commands
3. **Error Handling**: Include error checking in bash commands
4. **Examples**: Provide clear command examples
5. **Documentation**: Explain what each command does

## Resources

- [Claude Skills Documentation](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview)
- [Skills Cookbook](https://github.com/anthropics/claude-cookbooks/tree/main/skills)
- [Skills Best Practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)

## Testing Skills

To verify a skill works, ask Claude to use it:
- "Check for TypeScript errors" → Tests TypeScript Build Checker
- "Show me project statistics" → Tests Project Overview
- "Run the tests" → Tests Test Runner
- "Backup my game data" → Tests Data Backup Manager
- "Start the dev server" → Tests Dev Server Manager
