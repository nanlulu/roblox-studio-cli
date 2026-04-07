# rbx-studio-cli

CLI wrapper for the [Roblox Studio MCP server](https://create.roblox.com/docs/studio/mcp) — designed for use with [Claude Code](https://claude.ai/code) to reduce token usage by **68–80%** compared to connecting the MCP server directly.

## Why?

When Claude Code connects to the Roblox Studio MCP server, it loads all 17 tool schemas into every message (~2,500 tokens), plus JSON envelope overhead on every call. This CLI replaces that with:

- A **CLAUDE.md** file (~350 tokens) that teaches Claude Code the commands
- **Plain text output** instead of JSON-wrapped MCP responses
- **Zero tool schema injection** — commands run via Bash, not MCP

## Installation

```bash
npm install -g rbx-studio-cli
rbxstudio setup    # installs Claude Code skill for auto-discovery
```

That's it. `rbxstudio` is now available globally and Claude Code will automatically know how to use it.

To uninstall the Claude Code skill later: `rbxstudio uninstall`

### From source

```bash
git clone https://github.com/nanlulu/roblox-studio-cli.git
cd roblox-studio-cli
npm install
npm run build
npm link
rbxstudio setup
```

### Prerequisites

- **Node.js 18+**
- **Roblox Studio** with MCP server enabled:
  Studio > Assistant > ... > Manage MCP Servers > "Enable Studio as MCP server"

## Usage

```bash
# Verify Studio is connected
rbxstudio list

# Set active Studio (if multiple instances)
rbxstudio use <studio_id>

# Read a script
rbxstudio read game.ServerScriptService.MyScript
rbxstudio read game.ServerScriptService.MyScript --lines 10:20

# Search scripts
rbxstudio search MyScript
rbxstudio grep "GetService"

# Explore the data model
rbxstudio tree
rbxstudio tree --path game.Workspace --type Part
rbxstudio inspect game.Workspace.Baseplate

# Edit a script (old_string/new_string format)
rbxstudio edit game.ServerScriptService.MyScript --edits '[{"old_string":"print(\"hi\")","new_string":"print(\"hello\")"}]'

# Create a new script (--class required for new scripts)
rbxstudio edit game.ServerScriptService.NewScript --class Script --edits '[{"old_string":"","new_string":"print(\"hello world\")"}]'

# Execute Luau code (print output goes to console, not return value)
rbxstudio exec 'print(1+1)'
rbxstudio exec --file script.luau

# Generate assets
rbxstudio mesh 'a red sports car'
rbxstudio material 'weathered stone brick'
rbxstudio store 'sword'

# Playtesting
rbxstudio play start
rbxstudio console
rbxstudio play stop

# Player input simulation (during playtest)
rbxstudio nav 'game.Workspace.SpawnLocation'
rbxstudio key W tap
rbxstudio mouse 400,300 click
```

### Daemon mode

The CLI automatically starts a background daemon on the first command. The daemon keeps a persistent MCP connection to Roblox Studio, so subsequent calls are fast (~10ms vs ~300ms):

```bash
# The daemon starts automatically — no manual setup needed
rbxstudio list             # first call: starts daemon + discovers Studio (~4-5s)
rbxstudio tree             # subsequent calls: instant via daemon

# Manual daemon management (optional)
rbxstudio daemon start     # explicitly start the daemon
rbxstudio daemon status    # check if running
rbxstudio daemon stop      # shut down

# Auto-exits after 10 minutes of inactivity
```

### Advanced

```bash
rbxstudio raw <tool_name> '<json_params>'   # call any MCP tool directly
rbxstudio tools                             # list all available MCP tools
rbxstudio --json <any command>              # get raw JSON output
```

## Claude Code Integration

### How it works

`rbxstudio setup` installs a [Claude Code skill](https://code.claude.com/docs/en/skills) at `~/.claude/skills/rbxstudio/SKILL.md`. This teaches Claude Code all the `rbxstudio` commands globally — it works from any project directory.

### Setup

1. Install the CLI and run setup (see Installation above)
2. **Remove** the Roblox Studio MCP server from your Claude Code MCP config (this is what saves the tokens):
   ```bash
   claude mcp remove Roblox_Studio
   ```
3. Start a new Claude Code session — it will auto-discover the skill

### Permissions

When Claude Code first tries to run `rbxstudio`, it will ask for permission. You can pre-approve by adding to your `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["Bash(rbxstudio:*)"]
  }
}
```

## Token Savings

| Metric | MCP Server | CLI (`rbxstudio`) | Savings |
|--------|-----------|-------------|---------|
| Context overhead (per conversation) | ~2,500 tokens (17 tool schemas) | ~350 tokens (CLAUDE.md) | **86%** |
| Per-call overhead | ~80–150 tokens (JSON envelope) | ~10–30 tokens (bash command) | **75%** |
| Response payload overhead | +20–40 tokens (JSON wrapping) | 0 (plain text) | **100%** |

### How to verify

1. Start a Claude Code session **with** the MCP server connected
2. Run `/context` and note the token count under "Tools"
3. Remove the MCP server, keep only the `CLAUDE.md`
4. Run `/context` again and compare

## Commands Reference

| Command | MCP Tool | Description |
|---------|----------|-------------|
| `rbxstudio list` | `list_roblox_studios` | List connected Studio instances |
| `rbxstudio use <id>` | `set_active_studio` | Set active Studio |
| `rbxstudio read <path>` | `script_read` | Read a script |
| `rbxstudio edit <path>` | `multi_edit` | Edit a script (`--class` for new) |
| `rbxstudio search <query>` | `script_search` | Fuzzy search scripts |
| `rbxstudio grep <pattern>` | `script_grep` | Regex search across scripts |
| `rbxstudio tree` | `search_game_tree` | Explore instance hierarchy |
| `rbxstudio inspect <path>` | `inspect_instance` | Get instance details |
| `rbxstudio mesh <prompt>` | `generate_mesh` | Generate 3D mesh |
| `rbxstudio material <prompt>` | `generate_material` | Generate material |
| `rbxstudio store <query>` | `insert_from_creator_store` | Insert from Creator Store |
| `rbxstudio exec <code>` | `execute_luau` | Run Luau code |
| `rbxstudio play [start\|stop]` | `start_stop_play` | Toggle playtesting |
| `rbxstudio console` | `console_output` | Get console logs |
| `rbxstudio nav <target>` | `character_navigation` | Move player character |
| `rbxstudio key <key> <action>` | `keyboard_input` | Simulate keyboard |
| `rbxstudio mouse <pos> <action>` | `mouse_input` | Simulate mouse |

## Architecture

```
rbxstudio <command>
  │
  ├─ daemon running? ──yes──> Unix socket IPC (~10ms)
  │                              │
  │                              └─> persistent MCP connection ──> StudioMCP ──> Roblox Studio
  │
  └─ no ──> auto-start daemon ──> wait for Studio discovery (~3-5s) ──> tool call
```

- **Auto-start**: the daemon starts automatically on the first command if not already running
- **Eager discovery**: on startup, the daemon connects to StudioMCP and polls until Roblox Studio is found (~3 seconds)
- **Persistent connection**: once running, the daemon keeps the MCP connection alive on a Unix socket, auto-exits after 10 min idle
- **Fallback**: if the daemon fails, commands fall back to single-shot per-invocation mode (~300ms)

Built with:
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) — MCP client
- [commander](https://www.npmjs.com/package/commander) — CLI framework
- [tsup](https://www.npmjs.com/package/tsup) — TypeScript bundler

## Development

```bash
npm install
npm run dev          # watch mode
npm run build        # production build
npm test             # run tests
```

## License

MIT
