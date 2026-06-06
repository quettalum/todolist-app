# Todo List

A terminal-style (TUI) weekly todo list app. Pure frontend, zero dependencies, offline-first with cloud sync.

## Features

- **Weekly view** — Tasks organized by ISO week, with week navigation
- **Categories** — Nestable category tree for organizing tasks
- **Recurring tasks** — Auto-generate task instances at configurable intervals
- **TUI aesthetics** — Terminal-inspired dark theme, monospace font, `[bracket]` buttons, inverse selection
- **Offline-first** — Service Worker caches all assets; fully functional without network
- **Cloud sync** — Manual sync to any GitHub repository via Contents API
- **Import/Export** — JSON file export/import for backups and migration
- **Undo/Redo** — Ctrl+Z / Ctrl+Shift+Z for all data operations
- **Three-way merge** — Git-style conflict resolution prevents deleted items from resurrecting

## Quick Start

1. Clone this repo
2. Enable GitHub Pages (Settings → Pages → deploy from `main` branch, root `/`)
3. Open `https://<your-username>.github.io/todolist-app/`

No build step. No dependencies. Just open the HTML.

## Cloud Sync Setup

Data sync uses the GitHub Contents API to read/write a JSON file in a private repository.

### 1. Create a Private Data Repository

Create a **private** GitHub repository (e.g., `todolist-data`). It must have at least one commit (initialize with a README).

### 2. Create a Personal Access Token

Go to [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens) and create a token with:

- `repo` scope (for private repos)

Copy the token — you'll only see it once.

### 3. Configure the App

Click `[Config]` in the app header and fill in:

| Field | Description | Example |
|-------|-------------|---------|
| **Cloud URL** | Your data repo URL | `https://github.com/yourname/todolist-data` |
| **Token** | Personal access token | `github_pat_xxxxxxxxxxxx` |
| **File Path** | Path to data file in the repo | `todolist-data.json` (default) |

Click `[Save]`, then `[Sync]` to pull or push data.

### Using Other Providers

The sync module targets the GitHub Contents API (`api.github.com/repos/{owner}/{repo}/contents/{path}`). To use a different provider, you need an endpoint compatible with:

- `GET` — returns `{ content: "<base64>", sha: "<sha>" }`
- `PUT` — accepts `{ message, content, sha? }`, returns `{ content: { sha: "<sha>" } }`

Common alternatives that can be adapted:
- **GitLab**: [Repository Files API](https://docs.gitlab.com/ee/api/repository_files.html)
- **Gitea**: [Contents API](https://docs.gitea.com/api/1.21/#tag/repository/operation/repoGetContents) (GitHub-compatible)
- **Raw Git via CORS proxy**: Write a simple serverless function (Cloudflare Workers, Vercel Edge) that translates GitHub-style API calls to raw Git operations

To customize the sync target, modify `buildAPIURL` in `sync.js` to construct the appropriate endpoint for your provider.

## Architecture

```
model.js       — Data types, date utilities, tree builder
storage.js     — localStorage persistence, CRUD, import/export
sync.js        — GitHub API client, Base64 UTF-8 codec, three-way merge
ui.js          — TUI rendering (header, sidebar, tasks, panels)
app.js         — App controller, keyboard bindings, undo/redo
sw.js          — Service Worker (cache-first, auto-update)
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `↓` | Move cursor down |
| `k` / `↑` | Move cursor up |
| `n` | New task |
| `Space` | Toggle task completion |
| `d` | Delete current item |
| `h` / `←` | Previous week |
| `l` / `→` | Next week |
| `c` | Sync with cloud |
| `u` | Undo |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Esc` | Cancel / close panel |

## Data Format

The data file is a human-readable JSON document:

```json
{
  "version": 1,
  "tasks": [
    {
      "id": "uuid",
      "title": "Buy groceries",
      "categoryId": "uuid-or-null",
      "weekId": "2026-W23",
      "completed": false,
      "createdAt": "2026-06-06T12:00:00.000Z",
      "recurringId": null
    }
  ],
  "categories": [
    {
      "id": "uuid",
      "name": "Work",
      "parentId": null,
      "order": 0
    }
  ],
  "recurringTasks": [
    {
      "id": "uuid",
      "title": "Weekly review",
      "categoryId": null,
      "frequencyWeeks": 1,
      "repeatCount": 4,
      "startWeekId": "2026-W23",
      "createdAt": "2026-06-06T12:00:00.000Z"
    }
  ],
  "lastSync": "2026-06-06T12:00:00.000Z"
}
```

## License

MIT
