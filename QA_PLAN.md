# QA Plan: rbxstudio-cli

## Prerequisites

Before testing, ensure:
- [ ] Roblox Studio is open with a place that has at least one script
- [ ] MCP server is enabled in Studio: Assistant > ... > Manage MCP Servers > "Enable Studio as MCP server"
- [ ] CLI is built and linked: `npm run build && npm link`
- [ ] `rbxstudio --version` returns `1.0.0`

---

## 1. CLI Infrastructure

### 1.1 Help & Version
| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.1.1 | Global help | `rbxstudio --help` | Shows all commands and options |
| 1.1.2 | Version | `rbxstudio --version` | Prints `1.0.0` |
| 1.1.3 | Subcommand help | `rbxstudio read --help` | Shows `--lines` option |
| 1.1.4 | Daemon help | `rbxstudio daemon --help` | Shows start/stop/status |
| 1.1.5 | Unknown command | `rbxstudio notacommand` | Prints error with help suggestion |
| 1.1.6 | No arguments | `rbx` | Shows help text |

### 1.2 Error Handling
| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.2.1 | Missing required arg | `rbxstudio read` | Error: missing required argument 'path' |
| 1.2.2 | Invalid JSON in --edits | `rbxstudio edit game.Workspace --edits 'notjson'` | Error: --edits must be valid JSON |
| 1.2.3 | Invalid JSON in raw | `rbxstudio raw test 'notjson'` | Error: params must be valid JSON |
| 1.2.4 | Exec without code or file | `rbxstudio exec` | Error: Provide code as argument or use --file |
| 1.2.5 | Exec with nonexistent file | `rbxstudio exec --file /tmp/nonexistent.luau` | Error: Cannot read file |
| 1.2.6 | Studio not running | Stop Studio, run `rbxstudio list` | Error message mentioning Studio connection |

---

## 2. Session Management

### 2.1 list
| # | Test | Command | Expected |
|---|------|---------|----------|
| 2.1.1 | List with one Studio | `rbxstudio list` | Shows numbered list with name, id, [active] |
| 2.1.2 | List JSON output | `rbxstudio --json list` | Valid JSON with studio array |
| 2.1.3 | List with no Studio open | Close Studio, `rbxstudio list` | "No connected Studios found" or connection error |

### 2.2 use
| # | Test | Command | Expected |
|---|------|---------|----------|
| 2.2.1 | Set active studio | `rbxstudio list` then `rbxstudio use <id>` | "Active Studio set to: <id>" |
| 2.2.2 | Invalid studio id | `rbxstudio use invalid-id-999` | Error from MCP |
| 2.2.3 | Use JSON output | `rbxstudio --json use <id>` | Valid JSON response |

---

## 3. Script Commands

### Setup
Create a test script in Studio: `game.ServerScriptService.TestScript` with content:
```lua
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
print("Hello from TestScript")
```

### 3.1 read
| # | Test | Command | Expected |
|---|------|---------|----------|
| 3.1.1 | Read full script | `rbxstudio read game.ServerScriptService.TestScript` | Full script content |
| 3.1.2 | Read line range | `rbxstudio read game.ServerScriptService.TestScript --lines 1:2` | First 2 lines only |
| 3.1.3 | Read nonexistent path | `rbxstudio read game.ServerScriptService.NoSuchScript` | Error from MCP |
| 3.1.4 | Read JSON output | `rbxstudio --json read game.ServerScriptService.TestScript` | Valid JSON |
| 3.1.5 | Read deeply nested | `rbxstudio read game.Workspace.Folder.SubFolder.Script` | Script content (create in Studio first) |

### 3.2 edit
| # | Test | Command | Expected |
|---|------|---------|----------|
| 3.2.1 | Add line to script | `rbxstudio edit game.ServerScriptService.TestScript --edits '[{"range":{"start":1,"end":1},"text":"-- Edited by rbx\n"}]'` | Confirmation; verify in Studio |
| 3.2.2 | Verify edit applied | `rbxstudio read game.ServerScriptService.TestScript` | Shows edited content |
| 3.2.3 | Create new script | `rbxstudio edit game.ServerScriptService.NewScript --edits '[{"range":{"start":1,"end":1},"text":"print(\"new\")"}]'` | Script created in Studio |
| 3.2.4 | Multiple edits | `rbxstudio edit game.ServerScriptService.TestScript --edits '[{"range":{"start":1,"end":1},"text":"-- line1\n"},{"range":{"start":3,"end":3},"text":"-- line3\n"}]'` | Both edits applied |

### 3.3 search
| # | Test | Command | Expected |
|---|------|---------|----------|
| 3.3.1 | Search existing name | `rbxstudio search TestScript` | Shows path(s) matching |
| 3.3.2 | Search partial name | `rbxstudio search Test` | Fuzzy matches |
| 3.3.3 | Search no results | `rbxstudio search zzzznonexistent` | "No scripts found" or empty |
| 3.3.4 | Search JSON output | `rbxstudio --json search TestScript` | Valid JSON array |

### 3.4 grep
| # | Test | Command | Expected |
|---|------|---------|----------|
| 3.4.1 | Grep known pattern | `rbxstudio grep "GetService"` | Matches with path:line:text |
| 3.4.2 | Grep no matches | `rbxstudio grep "zzzznonexistent"` | "No matches found" or empty |
| 3.4.3 | Grep regex pattern | `rbxstudio grep "game\\..*Service"` | Matches with regex |
| 3.4.4 | Grep JSON output | `rbxstudio --json grep "GetService"` | Valid JSON array |

---

## 4. Data Model

### 4.1 tree
| # | Test | Command | Expected |
|---|------|---------|----------|
| 4.1.1 | Full tree | `rbxstudio tree` | Hierarchical list of instances |
| 4.1.2 | Filter by path | `rbxstudio tree --path game.Workspace` | Only Workspace descendants |
| 4.1.3 | Filter by type | `rbxstudio tree --type Part` | Only Part instances |
| 4.1.4 | Filter by keyword | `rbxstudio tree --keyword Spawn` | Instances matching keyword |
| 4.1.5 | Combined filters | `rbxstudio tree --path game.Workspace --type Part` | Parts in Workspace |
| 4.1.6 | Tree JSON output | `rbxstudio --json tree` | Valid JSON array |

### 4.2 inspect
| # | Test | Command | Expected |
|---|------|---------|----------|
| 4.2.1 | Inspect part | `rbxstudio inspect game.Workspace.Baseplate` | Name, Class, Properties, Children |
| 4.2.2 | Inspect script | `rbxstudio inspect game.ServerScriptService.TestScript` | Script metadata |
| 4.2.3 | Inspect with attributes | Set a custom attribute in Studio, then inspect | Shows Attributes section |
| 4.2.4 | Inspect nonexistent | `rbxstudio inspect game.Workspace.NoSuchThing` | Error from MCP |
| 4.2.5 | Inspect JSON output | `rbxstudio --json inspect game.Workspace.Baseplate` | Valid JSON object |

---

## 5. Luau Execution

### 5.1 exec
| # | Test | Command | Expected |
|---|------|---------|----------|
| 5.1.1 | Simple expression | `rbxstudio exec 'return 1+1'` | `2` |
| 5.1.2 | Print statement | `rbxstudio exec 'print("hello")'` | Output or confirmation |
| 5.1.3 | Multi-line code | `rbxstudio exec 'local x = 5\nlocal y = 10\nreturn x + y'` | `15` |
| 5.1.4 | From file | Create `/tmp/test.luau` with `return "from file"`, run `rbxstudio exec --file /tmp/test.luau` | `from file` |
| 5.1.5 | Luau error | `rbxstudio exec 'error("boom")'` | Error message from Studio |
| 5.1.6 | Game API access | `rbxstudio exec 'return #game.Workspace:GetChildren()'` | Number of workspace children |
| 5.1.7 | Exec JSON output | `rbxstudio --json exec 'return 42'` | Valid JSON |

---

## 6. Asset Generation

### 6.1 mesh
| # | Test | Command | Expected |
|---|------|---------|----------|
| 6.1.1 | Generate mesh | `rbxstudio mesh 'a wooden chair'` | Confirmation or asset reference |
| 6.1.2 | Mesh JSON output | `rbxstudio --json mesh 'a red car'` | Valid JSON |

### 6.2 material
| # | Test | Command | Expected |
|---|------|---------|----------|
| 6.2.1 | Generate material | `rbxstudio material 'rusty metal'` | Confirmation or asset reference |
| 6.2.2 | Material JSON output | `rbxstudio --json material 'grass'` | Valid JSON |

### 6.3 store
| # | Test | Command | Expected |
|---|------|---------|----------|
| 6.3.1 | Insert from store | `rbxstudio store 'sword'` | Confirmation of insertion |
| 6.3.2 | Store no results | `rbxstudio store 'zzzznonexistent12345'` | Error or no results |
| 6.3.3 | Store JSON output | `rbxstudio --json store 'sword'` | Valid JSON |

---

## 7. Playtesting

### 7.1 play
| # | Test | Command | Expected |
|---|------|---------|----------|
| 7.1.1 | Start playtest | `rbxstudio play start` | Studio enters play mode |
| 7.1.2 | Get console output | `rbxstudio console` (while playing) | Console log entries |
| 7.1.3 | Stop playtest | `rbxstudio play stop` | Studio exits play mode |
| 7.1.4 | Play without argument | `rbxstudio play` | Toggles or shows status |
| 7.1.5 | Console when not playing | `rbxstudio console` | Empty or appropriate message |
| 7.1.6 | Play JSON output | `rbxstudio --json play start` | Valid JSON |

---

## 8. Player Input Simulation

> These tests require an active playtest session. Run `rbxstudio play start` first.

### 8.1 nav
| # | Test | Command | Expected |
|---|------|---------|----------|
| 8.1.1 | Navigate to instance | `rbxstudio nav 'game.Workspace.SpawnLocation'` | Character moves |
| 8.1.2 | Navigate to position | `rbxstudio nav '0,10,0'` | Character moves (if supported) |

### 8.2 key
| # | Test | Command | Expected |
|---|------|---------|----------|
| 8.2.1 | Tap key | `rbxstudio key W tap` | Simulates W key tap |
| 8.2.2 | Hold key | `rbxstudio key W press --duration 1000` | Holds W for 1 second |
| 8.2.3 | Release key | `rbxstudio key W release` | Releases W |

### 8.3 mouse
| # | Test | Command | Expected |
|---|------|---------|----------|
| 8.3.1 | Click | `rbxstudio mouse 400,300 click` | Simulates click |
| 8.3.2 | Move | `rbxstudio mouse 500,400 move` | Moves mouse cursor |
| 8.3.3 | Scroll | `rbxstudio mouse 400,300 scroll --scroll 5` | Simulates scroll |

### Post-test
| # | Test | Command | Expected |
|---|------|---------|----------|
| 8.4.1 | Stop playtest | `rbxstudio play stop` | Exits play mode |

---

## 9. Daemon Mode

### 9.1 Lifecycle
| # | Test | Command | Expected |
|---|------|---------|----------|
| 9.1.1 | Status when not running | `rbxstudio daemon status` | "Daemon is not running" |
| 9.1.2 | Start daemon | `rbxstudio daemon start` | "Daemon started (pid: XXXX)" |
| 9.1.3 | Status when running | `rbxstudio daemon status` | "Daemon is running (pid: XXXX)" |
| 9.1.4 | Socket file created | `ls /tmp/rbx-daemon.sock` | File exists |
| 9.1.5 | PID file created | `cat /tmp/rbx-daemon.pid` | Contains valid PID |
| 9.1.6 | Double start | `rbxstudio daemon start` | "Daemon already running" |
| 9.1.7 | Stop daemon | `rbxstudio daemon stop` | "Daemon stopped (pid: XXXX)" |
| 9.1.8 | Socket cleaned up | `ls /tmp/rbx-daemon.sock` | File does not exist |
| 9.1.9 | PID cleaned up | `ls /tmp/rbx-daemon.pid` | File does not exist |

### 9.2 Routing
| # | Test | Command | Expected |
|---|------|---------|----------|
| 9.2.1 | Command without daemon | `rbxstudio daemon stop && rbx list` | Works (per-invocation, ~300ms) |
| 9.2.2 | Command with daemon | `rbxstudio daemon start && rbx list` | Works (faster, ~10-50ms) |
| 9.2.3 | Latency comparison | Time both: `time rbx list` (with/without daemon) | Daemon version noticeably faster |
| 9.2.4 | All commands via daemon | Run `rbxstudio read`, `rbxstudio tree`, `rbxstudio exec` with daemon running | All return correct results |
| 9.2.5 | Daemon crash recovery | Kill daemon process, then `rbxstudio list` | Falls back to per-invocation |
| 9.2.6 | Stale socket cleanup | Kill daemon, run `rbxstudio daemon status` | Reports not running, cleans stale files |

### 9.3 Auto-timeout
| # | Test | Command | Expected |
|---|------|---------|----------|
| 9.3.1 | Daemon auto-exits | Start daemon, wait 10+ min, `rbxstudio daemon status` | "Daemon is not running" |

---

## 10. Raw / Meta Commands

| # | Test | Command | Expected |
|---|------|---------|----------|
| 10.1 | List MCP tools | `rbxstudio tools` | All 17 tool names with descriptions |
| 10.2 | Raw tool call | `rbxstudio raw list_roblox_studios` | JSON output of studios |
| 10.3 | Raw with params | `rbxstudio raw script_search '{"query":"Test"}'` | JSON search results |
| 10.4 | Raw nonexistent tool | `rbxstudio raw fake_tool_name` | Error from MCP |

---

## 11. Output Formatting

| # | Test | What to verify |
|---|------|----------------|
| 11.1 | `rbxstudio list` output is numbered lines, not JSON |
| 11.2 | `rbxstudio tree` output is indented hierarchy, not JSON array |
| 11.3 | `rbxstudio inspect` output shows labeled sections (Properties, Attributes, Children) |
| 11.4 | `rbxstudio grep` output is `path:line: text` format |
| 11.5 | `rbxstudio console` output is `[source] timestamp message` format |
| 11.6 | `rbxstudio exec` output is just the return value, no wrapping |
| 11.7 | All errors go to stderr (redirect: `rbxstudio read nonexistent 2>/dev/null` shows nothing) |
| 11.8 | `--json` on every command produces parseable JSON (`rbxstudio --json list \| jq .`) |

---

## 12. Claude Code Integration

### 12.1 Token measurement
| # | Step | Action |
|---|------|--------|
| 12.1.1 | Start Claude Code session **with** Roblox MCP server connected |
| 12.1.2 | Run `/context` and record token count under "Tools" |
| 12.1.3 | Remove MCP server: `claude mcp remove Roblox_Studio` |
| 12.1.4 | Start new session in the `rbxstudio-cli` directory (so CLAUDE.md is loaded) |
| 12.1.5 | Run `/context` and record token count |
| 12.1.6 | Compare: expect 80%+ reduction in tool tokens |

### 12.2 Functional test with Claude Code
| # | Step | Action | Expected |
|---|------|--------|----------|
| 12.2.1 | Start session | New Claude Code session in project dir | CLAUDE.md is loaded |
| 12.2.2 | Ask "list my studios" | | Claude runs `rbxstudio list` |
| 12.2.3 | Ask "read the main script in ServerScriptService" | | Claude runs `rbxstudio read game.ServerScriptService.MainScript` |
| 12.2.4 | Ask "find all scripts using GetService" | | Claude runs `rbxstudio grep "GetService"` |
| 12.2.5 | Ask "show me the workspace hierarchy" | | Claude runs `rbxstudio tree --path game.Workspace` |
| 12.2.6 | Ask "run print('hello') in Studio" | | Claude runs `rbxstudio exec 'print("hello")'` |
| 12.2.7 | Ask "add a comment to line 1 of TestScript" | | Claude runs `rbxstudio edit` with correct edits JSON |
| 12.2.8 | Ask "start playtesting and show me the console" | | Claude runs `rbxstudio play start` then `rbxstudio console` |

### 12.3 Token comparison (side-by-side task)
| # | Task | With MCP (tokens) | With CLI (tokens) | Savings |
|---|------|--------------------|--------------------|---------| 
| 12.3.1 | "Read a script and explain it" | _record_ | _record_ | _calc_ |
| 12.3.2 | "Find and fix a bug in scripts using GetService" | _record_ | _record_ | _calc_ |
| 12.3.3 | "Add a new script and test it" | _record_ | _record_ | _calc_ |
| 12.3.4 | "Explore the data model and describe it" | _record_ | _record_ | _calc_ |
| 12.3.5 | "Generate a mesh and insert a store asset" | _record_ | _record_ | _calc_ |

---

## 13. Cross-Platform (if applicable)

| # | Test | Platform | Expected |
|---|------|----------|----------|
| 13.1 | Build and run | macOS (Apple Silicon) | All tests pass |
| 13.2 | Build and run | macOS (Intel) | All tests pass |
| 13.3 | Build and run | Windows | Uses `cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat` |
| 13.4 | Custom path | Set `STUDIO_MCP_PATH=/custom/path`, run `rbxstudio list` | Uses custom binary |

---

## Test Summary Tracker

| Section | Total | Pass | Fail | Skip | Notes |
|---------|-------|------|------|------|-------|
| 1. CLI Infrastructure | 11 | | | | |
| 2. Session Management | 6 | | | | |
| 3. Script Commands | 17 | | | | |
| 4. Data Model | 11 | | | | |
| 5. Luau Execution | 7 | | | | |
| 6. Asset Generation | 6 | | | | |
| 7. Playtesting | 6 | | | | |
| 8. Player Input | 9 | | | | |
| 9. Daemon Mode | 11 | | | | |
| 10. Raw / Meta | 4 | | | | |
| 11. Output Formatting | 8 | | | | |
| 12. Claude Code Integration | 16 | | | | |
| 13. Cross-Platform | 4 | | | | |
| **Total** | **116** | | | | |
