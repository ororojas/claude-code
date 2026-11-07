# Nova's second batch, 2 Nov 2026

Nova sent 26 repos under "Claude Code skills that improve Claude usage". Oro asked for
everything that can be installed now, and for anything that needs a Mac to go on the
"When I get my Mac" page in Notion. All 26 repos exist. Claude cloned and checked each one on
2 Nov.

## Added here

| Item | Upstream | What it does |
| --- | --- | --- |
| 9 Vercel skills | vercel-labs/agent-skills @ `1a2c79d` (MIT) | React and Next.js performance rules, composition patterns, view transitions, React Native, UI and writing reviews, Vercel deploys and cost tuning |
| `find-skills` | vercel-labs/skills @ `92a9a34` (MIT) | Finds skills on skills.sh with `npx skills find`. The `npx skills` CLI itself needs no install |
| 6 mem0 skills | mem0ai/mem0 @ `753496c` (Apache-2.0) | Building long-term memory into apps, including Pipecat and LangGraph setups |
| `shelf` | Five collections, below | Search and pull any of 2,810 indexed items on demand |

## On the claude.ai account

These are in the Anthropic Directory on claude.ai, so they install on the account instead of
into this repo. Then they load in every session on every repo, and on a Mac later.

| Plugin | Covers |
| --- | --- |
| Superpowers | obra/superpowers: 15 skills plus its SessionStart hook |
| playwright | microsoft/playwright-mcp. Tested in a cloud session on 2 Nov: it started Chromium and loaded a page |
| agent-sdk-dev | anthropics/claude-agent-sdk-python: `/new-sdk-app` and two verifier agents |
| mcp-server-dev | modelcontextprotocol/python-sdk: skills for building MCP servers |
| frontend-design | Anthropic's UI design skill, from anthropics/claude-plugins-official |

## On the shelf

alirezarezvani/claude-skills, wshobson/agents, ccplugins/awesome-claude-code-plugins,
rohitg00/awesome-claude-code-toolkit and ComposioHQ/awesome-claude-skills. Together that is
1,562 skills, 600 agents and 648 commands, about 115,000 tokens a turn if all were loaded.
`.claude/THIRD_PARTY_SKILLS.md` explains the index and `pull.sh`.

## Already had

- cloudflare/security-audit-skill and bradautomates/claude-video were added this morning.
  Upstream is still at the same commits (`c1c8a8c`, `03ceb42`).
- github/github-mcp-server, awkoy/notion-mcp-server and nspady/google-calendar-mcp: GitHub,
  Notion and Google Calendar already reach every session through claude.ai connectors. The
  self-hosted servers would need their own tokens, and the calendar one a Google Cloud OAuth
  client.

## Libraries for Jarvis

Nothing to load into Claude. Each one installed and imported in a cloud session on 2 Nov.

| Repo | Install | Version |
| --- | --- | --- |
| modelcontextprotocol/python-sdk | `pip install mcp` | 2.3.0 |
| anthropics/claude-agent-sdk-python | `pip install claude-agent-sdk` | 0.2.176 |
| langchain-ai/langgraph | `pip install langgraph` | 1.2.19 |
| mem0ai/mem0 | `pip install mem0ai` | 2.2.1 |
| pipecat-ai/pipecat | `pip install pipecat-ai` | 1.15.0 |
| letta-ai/letta | `npm i -g @letta-ai/letta-code`. The old repo now points to letta-ai/letta-code | 0.34.38 |

## Needs a Mac

Listed with setup steps on the "When I get my Mac" page in Notion.

- thedotmack/claude-mem: installs into the computer's own Claude Code setup, runs a background
  worker and signs in through the browser. Cloud sessions start on a fresh machine every time.
- MarkusPfundstein/mcp-obsidian: needs the Obsidian desktop app with the Local REST API plugin.
- ankimcp/anki-mcp-server-addon: runs inside Anki desktop. AnkiMobile can't run add-ons.
- abhattacherjee/claude-code-skills: the author says install only through `/plugin`. Copies
  break its paths, and github-board, demo-video and statusline need `gh`, macOS or a terminal.
- mem0's Claude Code memory plugin: a plugin with hooks and a local MCP server.
- Pipecat live voice: needs a microphone, speakers and a process that stays running.
- `letta server`: the self-hosted Letta server. chat.letta.com works in the browser now.
- openclaw/openclaw: an always-on assistant with wide access to the machine. Sandbox only.
