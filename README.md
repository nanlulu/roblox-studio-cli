# rbx-studio-cli

CLI wrapper for the [Roblox Studio MCP server](https://create.roblox.com/docs/studio/mcp) — designed for use with [Claude Code](https://claude.ai/code) to reduce token usage by **68–80%** compared to connecting the MCP server directly.

## Why?

When Claude Code connects to the Roblox Studio MCP server, it loads all 17 tool schemas into every message (~2,500 tokens), plus JSON envelope overhead on every call. This CLI replaces that with:

- A **CLAUDE.md** file (~350 tokens) that teaches Claude Code the commands
- **Plain text output** instead of JSON-wrapped MCP responses
- **Zero tool schema injection** — commands run via Bash, not MCP

## Installation

```bash
# Clone and install
git clone https://github.com/nanlulu/roblox-studio-cli.git
cd roblox-studio-cli
npm install
npm run build
npm link    # makes 'rbxstudio' available globally
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

# Edit a script
rbxstudio edit game.ServerScriptService.MyScript --edits '[{"range":{"start":1,"end":1},"text":"-- edited\n"}]'

# Execute Luau code
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

For rapid-fire sessions, start the daemon to keep the MCP connection alive (~10ms vs ~300ms per call):

```bash
rbxstudio daemon start     # starts background process
rbxstudio daemon status    # check if running
rbxstudio daemon stop      # shut down

# All rbxstudio commands automatically use the daemon when it's running
# Falls back to per-invocation if daemon is not available
# Auto-exits after 10 minutes of inactivity
```

### Advanced

```bash
rbxstudio raw <tool_name> '<json_params>'   # call any MCP tool directly
rbxstudio tools                             # list all available MCP tools
rbxstudio --json <any command>              # get raw JSON output
```

## Claude Code Integration

### Setup

1. Build and link the CLI (see Installation above)
2. **Remove** the Roblox Studio MCP server from your Claude Code MCP config (this is what saves the tokens)
3. The `CLAUDE.md` in this repo automatically teaches Claude Code how to use `rbxstudio`

### Permissions

Add to your `.claude/settings.local.json`:

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
| `rbxstudio edit <path>` | `multi_edit` | Edit a script |
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
  └─ no ──> spawn StudioMCP ──> handshake ──> tool call ──> format output ──> exit (~300ms)
```

- **Per-invocation** (default): spawns StudioMCP process, does MCP handshake, makes one call, exits
- **Daemon mode** (optional): background process keeps MCP connection alive on a Unix socket, auto-exits after 10 min idle

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
