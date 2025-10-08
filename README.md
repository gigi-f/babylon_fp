# Babylon.js local docs

This project stores a curated subset of Babylon.js documentation for quick offline reference.

Local docs
- Index: [`docs/babylon/index.json`](docs/babylon/index.json:1)
- Aggregated JSON: [`docs/babylon/json/all_docs.json`](docs/babylon/json/all_docs.json:1)

Quick search examples (requires jq)
```bash
jq '.topics[] | select(.topic == "getting-started")' docs/babylon/json/all_docs.json
```

Print a snippet by id
```bash
jq -r '.topics[] .snippets[] | select(.id=="app-initialization") .content' docs/babylon/json/all_docs.json
```

VSCode workspace settings
- Edit [`.vscode/settings.json`](.vscode/settings.json:1) to ensure docs are included in workspace search.

Recommended settings snippet:
```json
{
  "search.exclude": {
    "**/node_modules": true
  },
  "files.exclude": {
    "**/.git": false
  }
}
```

Next steps: implement query scripts or let me add the workspace settings file.