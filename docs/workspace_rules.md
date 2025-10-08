# Workspace Rules — Babylon FP (Lo-fi 3D)

Purpose: Establish coding standards, tooling, and workflow for this repo.

## TypeScript
- Always use strict mode. Avoid `any`. Prefer explicit types and readonly where applicable.
- Enable compiler options:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "moduleResolution": "node",
    "target": "ES2020",
    "module": "ESNext",
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@src/*": ["src/*"] }
  }
}
```

## Linting & Formatting
- Use ESLint (TypeScript plugin) + Prettier. Lint error = CI fail.
- Run locally: `npm run lint` and `npm run format`.
- Use Husky + lint-staged to auto-fix/format on commit.

## Commit & PR rules
- Follow Conventional Commits: feat/fix/docs/chore/etc.
- Branch names: feature/<short-desc>, fix/<short-desc>, chore/<...>
- Every PR requires at least one approving review and CI green.

## Project structure
- src/
  - scenes/  — scene initializers and registries
  - systems/ — game systems (physics, input, rendering helpers)
  - controllers/ — player controllers (first-person)
  - assets/ — models, textures, audio (keep small, low-fi)
  - typings/ — global types and module declarations

## Imports & Modules
- Use path alias `@src/*` (see tsconfig).
- Prefer named exports for components and systems.

## Scripts (package.json)
```bash
npm run dev     # start dev server with HMR
npm run build   # production build
npm run lint    # eslint
npm run format  # prettier
npm test        # run unit tests (vitest)
```

## Testing
- Use Vitest for unit tests. Aim for fast, deterministic tests for systems and controllers.

## Assets & Style
- Low-fi aesthetic: low-poly meshes, flat or vertex shading, limited palette.
- Keep texture sizes small; prefer vertex colors and simple materials.

## Performance
- Maintain 60 FPS budget; profile with browser devtools.
- Use instancing, merge meshes where appropriate, control draw calls.

## Dev tools & recommended VSCode extensions
- ESLint, Prettier, TypeScript, EditorConfig, GitLens
- Use workspace settings to align editor behavior.

## CI/CD
- GitHub Actions to run lint, test, and build on PRs to main.

## Dependency & Security
- Pin direct deps when possible. Run `npm audit` before releases.
- Use Renovate/Dependabot for updates.

## Enforcement
- Husky pre-commit for lint-staged.
- CI blocks merging on failing checks.

## How to apply these rules
1. Create/verify `tsconfig.json` with above compiler options.
2. Add ESLint & Prettier configs.
3. Add Husky + lint-staged hooks.
4. Add GitHub Actions workflow for lint/test/build.

For quick reference see [`docs/workspace_rules.md`](docs/workspace_rules.md:1)