# Todo List

[English](#english) | 中文

---

## 中文

一款终端风格（TUI）的周维度待办清单应用。纯前端，零依赖，离线优先，支持云端同步。

### 功能特性

- **周视图** — 按 ISO 周组织任务，支持周导航
- **分类管理** — 可无限嵌套的类别树
- **重复任务** — 按自定义频率和次数自动生成任务实例
- **TUI 美学** — 终端风格深色主题，等宽字体，`[按钮]` 风格，反色选中
- **离线优先** — Service Worker 缓存全部静态资源，无网络亦可完整使用
- **云端同步** — 通过 GitHub Contents API 手动同步至私密仓库
- **导入导出** — JSON 文件导入/导出，便于备份和迁移
- **撤销重做** — Ctrl+Z / Ctrl+Shift+Z 支持所有数据操作
- **三路合并** — 仿 Git merge 的冲突解决，防止已删除条目在同步后复活

### 快速开始

1. 克隆此仓库
2. 启用 GitHub Pages（Settings → Pages → 从 `main` 分支部署，根目录 `/`）
3. 访问 `https://<你的用户名>.github.io/todolist-app/`

无需构建工具，无需依赖，直接打开 HTML 即可。

### 云端同步配置

数据同步使用 GitHub Contents API 读写私密仓库中的 JSON 文件。

#### 1. 创建私密数据仓库

创建一个 **private** GitHub 仓库（例如 `todolist-data`）。仓库**必须有至少一次提交**（如初始化时勾选"添加 README"）。

#### 2. 创建个人访问令牌

前往 [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)，创建令牌，勾选：

- `repo` 权限（访问私密仓库必需）

复制令牌——仅显示一次。

#### 3. 在应用中配置

点击页面头部的 `[Config]`，填写：

| 字段 | 说明 | 示例 |
|------|------|------|
| **Cloud URL** | 数据仓库地址 | `https://github.com/yourname/todolist-data` |
| **Token** | 个人访问令牌 | `github_pat_xxxxxxxxxxxx` |
| **File Path** | 仓库中数据文件的路径 | `todolist-data.json`（默认） |

点击 `[Save]`，然后 `[Sync]` 即可拉取或推送数据。

#### 接入其他平台

同步模块默认对接 GitHub Contents API（`api.github.com/repos/{owner}/{repo}/contents/{path}`）。如需接入其他平台，需提供兼容以下规范的端点：

- `GET` — 返回 `{ content: "<base64>", sha: "<sha>" }`
- `PUT` — 接受 `{ message, content, sha? }`，返回 `{ content: { sha: "<sha>" } }`

可适配的常见方案：
- **GitLab**：[Repository Files API](https://docs.gitlab.com/ee/api/repository_files.html)
- **Gitea**：[Contents API](https://docs.gitea.com/api/1.21/#tag/repository/operation/repoGetContents)（兼容 GitHub API）
- **自建服务**：使用 Cloudflare Workers / Vercel Edge 等无服务器函数，将 GitHub 风格的 API 调用转译为其他后端操作

修改 `sync.js` 中的 `buildAPIURL` 函数即可自定义同步目标。

### 架构

```
model.js       — 数据模型、日期工具、类别树构造
storage.js     — localStorage 持久化、CRUD、导入导出
sync.js        — GitHub API 客户端、Base64 UTF-8 编解码、三路合并
ui.js          — TUI 渲染（头部、侧边栏、任务列表、面板）
app.js         — 应用调度、键盘绑定、撤销重做
sw.js          — Service Worker（缓存优先、自动更新）
```

### 键盘快捷键

| 按键 | 操作 |
|------|------|
| `j` / `↓` | 光标下移 |
| `k` / `↑` | 光标上移 |
| `n` | 新建任务 |
| `Space` | 切换任务完成状态 |
| `d` | 删除当前项 |
| `h` / `←` | 上一周 |
| `l` / `→` | 下一周 |
| `c` | 云端同步 |
| `u` | 撤销 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` | 重做 |
| `Esc` | 取消 / 关闭面板 |

### 数据格式

数据文件为人类可读的 JSON 文档：

```json
{
  "version": 1,
  "tasks": [
    {
      "id": "uuid",
      "title": "买菜",
      "categoryId": "uuid-或-null",
      "weekId": "2026-W23",
      "completed": false,
      "createdAt": "2026-06-06T12:00:00.000Z",
      "recurringId": null
    }
  ],
  "categories": [
    {
      "id": "uuid",
      "name": "工作",
      "parentId": null,
      "order": 0
    }
  ],
  "recurringTasks": [
    {
      "id": "uuid",
      "title": "周报",
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

---

<h2 id="english">English</h2>

A terminal-style (TUI) weekly todo list app. Pure frontend, zero dependencies, offline-first with cloud sync.

### Features

- **Weekly view** — Tasks organized by ISO week, with week navigation
- **Categories** — Nestable category tree for organizing tasks
- **Recurring tasks** — Auto-generate task instances at configurable intervals
- **TUI aesthetics** — Terminal-inspired dark theme, monospace font, `[bracket]` buttons, inverse selection
- **Offline-first** — Service Worker caches all assets; fully functional without network
- **Cloud sync** — Manual sync to any GitHub repository via Contents API
- **Import/Export** — JSON file export/import for backups and migration
- **Undo/Redo** — Ctrl+Z / Ctrl+Shift+Z for all data operations
- **Three-way merge** — Git-style conflict resolution prevents deleted items from resurrecting

### Quick Start

1. Clone this repo
2. Enable GitHub Pages (Settings → Pages → deploy from `main` branch, root `/`)
3. Open `https://<your-username>.github.io/todolist-app/`

No build step. No dependencies. Just open the HTML.

### Cloud Sync Setup

Data sync uses the GitHub Contents API to read/write a JSON file in a private repository.

#### 1. Create a Private Data Repository

Create a **private** GitHub repository (e.g., `todolist-data`). It must have at least one commit (initialize with a README).

#### 2. Create a Personal Access Token

Go to [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens) and create a token with:

- `repo` scope (for private repos)

Copy the token — you'll only see it once.

#### 3. Configure the App

Click `[Config]` in the app header and fill in:

| Field | Description | Example |
|-------|-------------|---------|
| **Cloud URL** | Your data repo URL | `https://github.com/yourname/todolist-data` |
| **Token** | Personal access token | `github_pat_xxxxxxxxxxxx` |
| **File Path** | Path to data file in the repo | `todolist-data.json` (default) |

Click `[Save]`, then `[Sync]` to pull or push data.

#### Using Other Providers

The sync module targets the GitHub Contents API (`api.github.com/repos/{owner}/{repo}/contents/{path}`). To use a different provider, you need an endpoint compatible with:

- `GET` — returns `{ content: "<base64>", sha: "<sha>" }`
- `PUT` — accepts `{ message, content, sha? }`, returns `{ content: { sha: "<sha>" } }`

Common alternatives that can be adapted:
- **GitLab**: [Repository Files API](https://docs.gitlab.com/ee/api/repository_files.html)
- **Gitea**: [Contents API](https://docs.gitea.com/api/1.21/#tag/repository/operation/repoGetContents) (GitHub-compatible)
- **Raw Git via CORS proxy**: Write a simple serverless function (Cloudflare Workers, Vercel Edge) that translates GitHub-style API calls to raw Git operations

To customize the sync target, modify `buildAPIURL` in `sync.js` to construct the appropriate endpoint for your provider.

### Architecture

```
model.js       — Data types, date utilities, tree builder
storage.js     — localStorage persistence, CRUD, import/export
sync.js        — GitHub API client, Base64 UTF-8 codec, three-way merge
ui.js          — TUI rendering (header, sidebar, tasks, panels)
app.js         — App controller, keyboard bindings, undo/redo
sw.js          — Service Worker (cache-first, auto-update)
```

### Keyboard Shortcuts

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

### Data Format

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

### License

MIT
