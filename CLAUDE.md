# Roblox Studio CLI (`rbxstudio`)

Use `rbxstudio` via Bash to interact with Roblox Studio. Always run `rbxstudio list` first to verify Studio is connected.

## Commands

### Session
- `rbxstudio list` — list connected Studios (run first!)
- `rbxstudio use <id>` — set active Studio

### Read/Search Scripts
- `rbxstudio read <path>` — read script (e.g. `rbxstudio read game.ServerScriptService.MyScript`)
- `rbxstudio read <path> --lines 10:20` — read lines 10-20
- `rbxstudio search <query>` — fuzzy search script names
- `rbxstudio grep <pattern>` — regex search across all scripts

### Edit Scripts
- `rbxstudio edit <path> --edits '<json>'` — apply edits (uses old_string/new_string format)
  Example: `rbxstudio edit game.ServerScriptService.MyScript --edits '[{"old_string":"print(\"hi\")","new_string":"print(\"hello\")"}]'`
  New script: `rbxstudio edit game.ServerScriptService.NewScript --edits '[{"old_string":"","new_string":"print(\"hello world\")"}]'`

### Data Model
- `rbxstudio tree` — show full game hierarchy
- `rbxstudio tree --path game.Workspace --type Part` — filter by path/type/keyword
- `rbxstudio inspect <path>` — get instance details (properties, attributes, children)

### Execute Luau
- `rbxstudio exec '<code>'` — run Luau in Studio
- `rbxstudio exec --file script.luau` — run from file

### Assets
- `rbxstudio mesh '<prompt>'` — generate 3D mesh from text
- `rbxstudio material '<prompt>'` — generate material/texture from text
- `rbxstudio store '<query>'` — insert asset from Creator Store

### Playtesting
- `rbxstudio play start` / `rbxstudio play stop` — toggle playtest
- `rbxstudio console` — get console output

### Player Input (during playtest)
- `rbxstudio nav '<target>'` — move character to position/instance
- `rbxstudio key <key> <press|release|tap> [--duration ms]` — keyboard input
- `rbxstudio mouse <x,y> <click|move|scroll> [--scroll delta]` — mouse input

### Advanced
- `rbxstudio raw <tool_name> '<json_params>'` — call any MCP tool directly
- `rbxstudio tools` — list all available MCP tools
- `rbxstudio daemon start|stop|status` — manage persistent connection for faster calls
- Add `--json` to any command for raw JSON output

## Tips
- Paths use dot notation: `game.ServerScriptService.MyScript`
- All output is plain text — no JSON parsing needed
- Errors go to stderr with actionable messages
- Run `rbxstudio daemon start` for faster repeated calls (~10ms vs ~300ms)
