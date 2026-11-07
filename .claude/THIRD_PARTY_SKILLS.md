# Third-party skills

Fifteen open-source skill packs are copied into this repo. Anything under `.claude/skills`,
`.claude/agents` and `.claude/commands` loads in every Claude Code session on this repo,
including cloud sessions started from the web or the mobile app. The two skills from Nova's
2 Nov batch are listed separately in `.claude/skills/NOVA_BATCH_2026-11-02.md`.

| Pack | Upstream (commit, date) | License | Where it lives | How to use it |
| --- | --- | --- | --- | --- |
| Arena | [Jakeschincariol/arena-skill](https://github.com/Jakeschincariol/arena-skill) `df07b8e`, 2026-09-26 | MIT | `.claude/skills/arena/` | `/arena`, `/arena --quick <task>`, `/arena --agents 32 <task>` |
| Karpathy guidelines | [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) `2c60614`, 2026-04-20 | MIT (declared in its manifest) | `.claude/skills/karpathy-guidelines/` | Claude applies it when writing or reviewing code. `/karpathy-guidelines` loads it on demand |
| CLI-Anything | [HKUDS/CLI-Anything](https://github.com/HKUDS/CLI-Anything) `34f5195`, 2026-09-22 | Apache-2.0 | `.claude/skills/cli-anything/`, `.claude/skills/cli-hub-meta-skill/`, 69 `.claude/skills/cli-anything-<app>/` | `/cli-anything <path-or-repo>` builds a CLI. `/cli-anything refine`, `test`, `validate` and `list` do the rest |
| ECC | [affaan-m/ECC](https://github.com/affaan-m/ECC) `b38be6a`, 2026-10-29 (v2.2.3) | MIT | 314 skills in `.claude/skills/`, 71 agents in `.claude/agents/`, 86 commands in `.claude/commands/`, support files in `.claude/ecc/` | `/ecc-guide` gives a tour. `/tdd-workflow`, `/verification-loop` and `/e2e-testing` are good starting points |
| Graphify | [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) `32e5efe`, 2026-11-01 (v0.9.100) | Apache-2.0, with an MIT notice for earlier contributions | `.claude/skills/graphify/` | `/graphify alevel-tracker` maps a folder into a knowledge graph. The first run installs its Python package |
| Cloudflare security audit | [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) `c1c8a8c`, 2026-09-14 | MIT | `.claude/skills/security-audit/` | Claude uses it for security questions. The full six-phase audit runs only when you ask for one |
| Watch | [bradautomates/claude-video](https://github.com/bradautomates/claude-video) `03ceb42`, 2026-09-25 | MIT | `.claude/skills/watch/` | `/watch <url>` |
| Vercel agent skills | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `1a2c79d`, 2026-10-27 | MIT (declared in its README and skill frontmatter) | 9 folders in `.claude/skills/`: `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-view-transitions`, `vercel-react-native-skills`, `web-design-guidelines`, `writing-guidelines`, `deploy-to-vercel`, `vercel-cli-with-tokens`, `vercel-optimize` | Claude applies the React ones when writing React or Next.js. `/deploy-to-vercel`, `/vercel-optimize` and `/web-design-guidelines` run on request |
| Superpowers | [obra/superpowers](https://github.com/obra/superpowers) `2ce8aa1`, 2026-10-21 (v7.0.1) | MIT | 15 skills in `.claude/skills/`, its startup hook script in `.claude/superpowers/` | Claude picks them up from their descriptions. `/brainstorming` before building something, `/systematic-debugging` for a bug, `/writing-plans` then `/subagent-driven-development` for a bigger change |
| Claude plugins (official) | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) `a7ba5b9`, 2026-10-30 | Apache-2.0, plus each plugin's own license in `.claude/claude-plugins-official/licenses/` | 23 skills, 17 agents and 10 commands from 19 of its 40 plugins | `/frontend-design`, `/claude-md-improver`, `/pr-review-toolkit-review-pr`, `/official-feature-dev`, `/skill-creator` |
| wshobson/agents | [wshobson/agents](https://github.com/wshobson/agents) `7e2fb55`, 2026-10-30 (catalog v1.7.1) | MIT. Its `conductor` and `superself` plugins say Apache-2.0 | 185 skills, 147 agents and 96 commands, support files in `.claude/wshobson/` | Ask for an agent by name, such as `backend-architect` or `kubernetes-architect`. `/full-review`, `/tdd-cycle`, `/python-scaffold`, `/avoid-ai-writing` |
| Find Skills | [vercel-labs/skills](https://github.com/vercel-labs/skills) `92a9a34`, 2026-10-29 | MIT | `.claude/skills/find-skills/` | Ask "is there a skill for X?" It searches skills.sh with `npx skills find` |
| claude-mem workflow skills | [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) `26ccf4d`, 2026-11-02 (v15.8.3) | Apache-2.0 | 13 skills in `.claude/skills/`, license in `.claude/claude-mem/` | `/handoff` before you end a long session, `/make-plan` then `/do`, `/babysit` on a PR |
| mem0 skills | [mem0ai/mem0](https://github.com/mem0ai/mem0) `753496c`, 2026-10-30 | Apache-2.0 | 6 folders in `.claude/skills/`: `mem0`, `mem0-cli`, `mem0-integrate`, `mem0-oss-to-platform`, `mem0-test-integration`, `mem0-vercel-ai-sdk` | For building long-term memory into apps such as Jarvis. `/mem0-integrate` adds mem0 to a repo |
| Shelf | Five big collections, listed under [The shelf](#the-shelf) | Per collection | `.claude/shelf/` and `.claude/skills/shelf/` | `/shelf <what you need>` finds an item and pulls it in |

Arena runs a tournament of sub-agents, and that gets expensive. The default of 100 agents
makes 595 sub-agent calls. `--quick` uses 16 agents and makes 91 calls.

Exact lists of the paths each big pack added are in `.claude/ecc/installed-paths.txt` and
`.claude/skills/cli-anything/installed-paths.txt`. `.claude/superpowers/`,
`.claude/claude-plugins-official/`, `.claude/wshobson/`, `.claude/claude-mem/` and
`.claude/mem0/` each have an `installed-paths.txt` as well.

## Why these are plain files and not plugins

CLI-Anything and ECC ship as Claude Code plugins. Cloud sessions don't install plugins that
a repo declares in `.claude/settings.json`. They also skip plugin folders committed under
`.claude/skills/`, because loading those needs a saved workspace-trust record and cloud
sessions never have one. Plain skills, agents and commands always load, so both plugins are
laid out that way here. Superpowers, the official catalog, wshobson/agents and claude-mem are
plugins too, and got the same treatment.

## What differs from upstream

Files are copied unchanged except for the points below.

CLI-Anything

- Its five plugin commands (`/cli-anything`, `/cli-anything:refine`, `:test`, `:validate`,
  `:list`) are now a single `/cli-anything` skill. The `SKILL.md` in
  `.claude/skills/cli-anything/` was written for this repo. It routes the first word of the
  arguments to the original command files in `.claude/skills/cli-anything/commands/` and
  tells Claude where `HARNESS.md` and the guides now live.
- The plugin manifest and the upstream `skills/README.md` were not copied.

ECC

- Five names would have clashed with Claude Code's built-in commands, so they carry an `ecc-`
  prefix. The skills are `ecc-deep-research` and `ecc-security-review`. The commands are
  `ecc-code-review`, `ecc-plan` and `ecc-checkpoint`. ECC's own text still uses the
  original names.
- Twelve commands were left out because a skill with the same name already provides that
  `/name`: ecc-guide, issue-review, marketing-campaign, orch-add-feature, orch-build-mvp,
  orch-change-feature, orch-fix-defect, orch-refine-code, plan-canvas, security-scan,
  skill-host-compat, token-card.
- Hooks are not wired up. ECC registers 28 hooks that run Node scripts on nearly every tool
  call and at the end of every turn, and a few of those scripts need npm packages that are not
  installed. That would change how every session in this repo behaves, including work on
  unrelated projects. The hook config and scripts are kept in `.claude/ecc/hooks/` and
  `.claude/ecc/scripts/`. To try them, ask Claude to add the entries from
  `.claude/ecc/hooks/hooks.json` to `.claude/settings.json` with `CLAUDE_PLUGIN_ROOT` set to
  `.claude/ecc`, and run `npm ci` in `.claude/ecc` first.
- Rules are not active. ECC's rule packs are in `.claude/ecc/rules/`. A pack copied into
  `.claude/rules/` loads into every session, so add only the ones you want, such as `common`
  plus your language.
- ECC files that mention `${CLAUDE_PLUGIN_ROOT}` assume the plugin layout. Here `scripts/`,
  `hooks/`, `rules/`, `manifests/` and the other support folders are under `.claude/ecc/`, and
  skills are under `.claude/skills/`.
- `configure-ecc` and `skill-host-compat` manage ECC's marketplace plugin install. That is
  not how ECC is installed here, so they will not update this copy.
- ECC's optional MCP server config (chrome-devtools) was not copied.

## Graphify

Graphify turns a folder of code and documents into a knowledge graph that Claude can query
instead of searching file by file. `/graphify <folder>` writes `graph.html`, `GRAPH_REPORT.md`
and `graph.json` into a `graphify-out/` folder.

What was copied: `skill.md` as `SKILL.md`, and the `references/` folder next to it. That is
what `graphify install --platform claude --project` would write. Two extras from the real
installer were left out:

- The "always on" setup (`graphify claude install`). It adds a section to `CLAUDE.md` and
  registers hooks that run `graphify hook-guard` before every Bash, Grep, Read and Glob call.
  Those are the four tools Claude uses most, and a fresh cloud session doesn't have the
  `graphify` command until the skill has installed it.
- The `.graphify_version` stamp. The CLI only checks it if the file exists, and it would warn
  whenever the PyPI release differs from this copy.

How it behaves:

- Nothing installs until you run the skill. The first `/graphify` run installs the `graphifyy`
  package from PyPI with `uv` or `pip`. Note the double y: other `graphify*` packages are not
  the same project.
- Code is parsed locally with tree-sitter, so a code-only folder costs no model tokens. Docs,
  PDFs and images are read by the model, which is slow and uses a lot of tokens on a big
  folder. Point it at `alevel-tracker` and not `.`, because the repo root now holds well over a
  thousand skill and documentation files.
- Output lands in `graphify-out/` inside the folder you scan, and it will show up in
  `git status`. Add it to `.gitignore` unless you want to commit it.
- Its description is hidden from Claude with `"name-only"` in `.claude/settings.json`. As
  written, the description tells Claude to use it for any question about a codebase, which
  would have it building graphs unprompted. Typing `/graphify` works as normal.
- The skill ends each run with a line asking you to sponsor the author on GitHub.

To update it, replace `SKILL.md` and `references/` with `graphify/skill.md` and
`graphify/skills/claude/references/` from a newer upstream copy. The Apache-2.0 license, the
MIT license and the NOTICE file are included in the folder.

## Vercel agent skills

These are copied unchanged, with a few things to know:

- Vercel's folders are named after each skill's `name` field, which is also what `npx skills add`
  does. So `react-best-practices` became `vercel-react-best-practices`. The packaged `.zip` copies
  and the build tooling under `packages/` were left out.
- Vercel ships no LICENSE file. Its README and four of the skills declare MIT.
- `web-design-guidelines` and `writing-guidelines` fetch their rules from GitHub every time they
  run, so what they check can change after this copy was made.
- `deploy-to-vercel` deploys previews unless you ask for production, and asks before any git
  push. `vercel-cli-with-tokens` and `vercel-optimize` need the Vercel CLI and a `VERCEL_TOKEN`.
  `vercel-optimize` shells out only to `vercel` and `rg`.

## Superpowers

All 15 skills were copied. The only change: Superpowers skills point at each other with the
plugin prefix, as in `superpowers:writing-plans`. Here they have no prefix, so those
references now read `writing-plans`.

The plugin also ships a startup hook. At the start of every session it pastes the
`using-superpowers` skill into the conversation, and that skill tells Claude to check for a
matching skill before every reply, clarifying questions included. The hook is what makes
Superpowers strict. Its script is in `.claude/superpowers/session-start`, but it has been
left off (see "Decided on `.claude/settings.json`" below) — the same call already made for
ECC's and Graphify's own session-wide hooks in this repo. Until you turn it on, the skills
still load normally, and Claude uses them when a description matches the task. Nothing forces
it to.

If you turn the hook on, expect more skill calls, even on short questions. `brainstorming`
asks questions one at a time before any code gets written. Say "skip brainstorming" when you
just want a quick change.

The optional visual brainstorming page runs a small web server on 127.0.0.1 and loads its
logo from primeradiant.com, the author's site. The hook script differs from upstream in one
word: it calls the skill `using-superpowers` instead of `superpowers:using-superpowers`.

## Claude plugins (official catalog)

Copied from 19 of its 40 plugins: agent-sdk-dev, claude-code-setup, claude-md-management,
code-review, commit-commands (`/commit` and `/clean_gone`), cwc-makers, feature-dev,
frontend-design, math-olympiad, math-proof, mcp-server-dev, mcp-tunnels, playground,
plugin-dev, pr-review-toolkit, project-artifact, receipts, session-report and skill-creator.

Some names were already in use, so these items were renamed:

- `/code-review` is built into Claude Code, so the plugin's version is
  `/official-code-review`. The built-in one is the newer of the two.
- ECC already has `/feature-dev` and `/review-pr`. The official ones are
  `/official-feature-dev` and `/pr-review-toolkit-review-pr`. Their agents carry the plugin
  name too (`feature-dev-code-explorer`, `pr-review-toolkit-silent-failure-hunter` and so
  on), and both commands now call those agents instead of ECC's agents of the same name.
- math-proof's `solo` and `siege` skills are `/math-proof-solo` and `/math-proof-siege`.

The full list is in `.claude/claude-plugins-official/RENAMES.md`. One more change:
project-artifact keeps its per-project config in `~/.claude/plugins/data/project-artifact/`.
Upstream uses `${CLAUDE_PLUGIN_DATA}`, which only exists for installed plugins. A cloud
session wipes that folder with the container, which is also what would happen to the plugin.
`skill-creator` is a different version from the `anthropic-skills:skill-creator` synced from
your claude.ai account. Both are available.

Not copied:

- The 12 language-server plugins (pyright, typescript, gopls, rust-analyzer, clangd and so
  on). They only register a language server in the plugin manifest, so there are no files to
  copy. On your own computer, run `/plugin install pyright-lsp@claude-plugins-official` for
  the ones you want.
- hookify. ECC already has a port under the same names (`/hookify`, `/hookify-configure`,
  `/hookify-list`, `/hookify-help` and the `hookify-rules` skill), and hookify rules do
  nothing unless its hooks are running.
- claude-security, code-modernization and ralph-loop. They rely on their plugin folder,
  hooks, workflow scripts or an interface module, so they only work as installed plugins.
- security-guidance, explanatory-output-style and learning-output-style, which are hooks
  with no skills in them.
- The standalone code-simplifier plugin. Its agent matches pr-review-toolkit's except for
  the description.
- `/commit-push-pr`, which the repo already had. The two differ by one line.
- example-plugin, a template.
- The 14 external plugins, among them GitHub, Playwright, Linear, Context7, Discord, Telegram
  and iMessage. They are MCP server configs or chat bridges rather than skills. GitHub and
  Playwright are covered under "MCP servers" below.

## wshobson/agents

All 185 skills, all of the commands and every agent from its 92 plugins, merged into one
folder.

The catalog ships many agents more than once, one copy per plugin that uses it.
`backend-architect` appears in six plugins, each copy under its own name such as
`api-scaffolding-backend-architect`. Where the copies were identical, one is installed under
the plain name and every command that used another copy's name now uses that one. That took
202 agent files down to 147. Nine agents (`code-reviewer`, `debugger`, `security-auditor`,
`test-automator` and a few others) come in two or three versions that really differ. The
most common version gets the plain name when it is free, and the rest keep their upstream
names.

Commands follow the same idea. Identical copies became one file. A command keeps its upstream
name unless that name was already taken, differs between two plugins, or is too generic to
stand alone. Then it gets its plugin's name in front, for example `/conductor-setup`,
`/plugin-eval-eval` and `/debugging-toolkit-smart-debug`. ECC already had skills called
`architecture-decision-records` and `recsys-pipeline-architect`, so wshobson's versions are
`documentation-generation-architecture-decision-records` and
`machine-learning-ops-recsys-pipeline-architect`. Every rename and merge is listed in
`.claude/wshobson/RENAMES.md`. Where upstream docs say `/plugin:command`, look for that
command here under its own name or as `/plugin-command`.

Files that commands point at live in `.claude/wshobson/<plugin>/`: Conductor's style-guide
templates, plugin-eval's Python package, ship-mate's story template, and the hook scripts of
protect-mcp and review-agent-governance. Mentions of `${CLAUDE_PLUGIN_ROOT}` in those plugins
were changed to point there. The protect-mcp and review-agent-governance hooks are not
switched on. Their setup skills, `/protect-mcp-setup` and `/review-agent-setup`, walk through
adding them if you want signed audit trails or approval gates.

## Find Skills and the `npx skills` installer

vercel-labs/skills is mostly a command-line installer that runs through `npx skills`, so
there is nothing to install for it. Its one user-facing skill, `find-skills`, is copied. Ask
"is there a skill for X?" and Claude searches with `npx skills find`.

The skill suggests `npx skills add <owner/repo@skill> -g -y`. In a cloud session `-g`
installs into the container's home folder, which goes away when the session ends. Use
`npx skills add <owner/repo> --skill <name> -a claude-code` instead. That puts the skill in
this repo's `.claude/skills/`, and committing it keeps it.

## Memory: claude-mem and mem0

Neither memory engine is installed. Both need their plugin running in the background, and
both keep or send a record of what happens in every session.

- claude-mem records each tool call through hooks and a local worker on port 37777, and
  stores the result in `~/.claude-mem`. A cloud session deletes that folder along with the
  container, so it can't carry memory from one cloud session to the next. The only way
  around that is its paid cloud sync (cmem.ai), which uploads your sessions to that service.
- mem0's Claude Code plugin captures your prompts and Claude's replies through hooks and
  sends them to the Mem0 Platform. That memory does survive between cloud sessions, but it
  needs a Mem0 API key, and the text of every session goes to Mem0.

On your own computer, install them the usual way:

```
/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem@thedotmack
```

```
claude plugin marketplace add mem0ai/mem0
claude plugin install mem0@mem0-plugins --scope user --config api_key="$MEM0_API_KEY"
```

For cloud sessions, the mem0 plugin could be wired into this repo, with the API key saved as
an environment secret. That sends your session text to Mem0, so it is left for you to decide.

What was copied is the part that works on its own:

- 13 claude-mem skills that don't need the worker: `handoff`, `make-plan`, `do`, `build`,
  `babysit`, `childhood`, `design-is`, `learn-codebase`, `oh-my-issues`, `pathfinder`,
  `standup`, `what-the` and `wowerpoint`. In the cloud, `/handoff` is the useful one. It
  writes a `HANDOFF.md` for the next session, and committing that file is a plain kind of
  memory that does carry over. `wowerpoint` needs the `notebooklm` CLI and a Google sign-in.
- The other 17 were left out. They need the worker or its search tools (`mem-search`,
  `timeline-report`, `smart-explore` and others), or they exist to maintain claude-mem
  itself (`version-bump`, `release`, `build-and-release`).
- mem0's 6 skills for building mem0 into an app: `mem0`, `mem0-cli`, `mem0-integrate`,
  `mem0-oss-to-platform`, `mem0-test-integration` and `mem0-vercel-ai-sdk`.
  `mem0-oss-to-platform` quotes mem0's data migration one-liner (`curl ... | bash`) with a
  note not to run it unprompted. That was the only thing the first scan of these flagged.

## MCP servers

Playwright is set up in `.mcp.json`. It starts through `.claude/mcp/playwright.sh`, which
pins `@playwright/mcp` at 0.0.84. In a cloud container the script uses the Chromium that comes
installed there, headless, without Chromium's sandbox and with an in-memory profile. It was
tested in this container: it opened https://example.com through the session's proxy and read
the page back. On your own computer it starts with Playwright's defaults, which means Chrome
in a visible window. Snapshots and screenshots go to `.playwright-mcp/`, which is in
`.gitignore`. ECC's `gan-evaluator` agent expects these `playwright` tools. Playwright's
maintainers now point coding agents at
[microsoft/playwright-cli](https://github.com/microsoft/playwright-cli), a CLI with its own
skill that uses fewer tokens. It wasn't on the list, so it isn't installed.

GitHub is not added. Cloud sessions already get GitHub's MCP tools from the environment,
limited to the repos the session can reach. Another `github` server in `.mcp.json` would
duplicate those tools and would need a personal access token. On your own computer, add it
once for your user account:

```
claude mcp add --transport http github https://api.githubcopilot.com/mcp/ -H "Authorization: Bearer <your token>"
```

Or run `/plugin install github@claude-plugins-official` with `GITHUB_PERSONAL_ACCESS_TOKEN`
set. The github-mcp-server repo has no skills of its own. playwright-mcp has one,
`playwright-triage`, but it only runs inside that repo's own issue-triage workflow, so it was
left out.

## The shelf

Five of the collections are too big to load. Between them they hold 2,810 items: 1,562 skills,
600 agents and 648 commands. Loaded in full they would add about 460,000 characters, roughly
115,000 tokens, to every turn, even with each description cut to 220 characters. 58 of the
names clash with skills, agents or commands already here, and 65 names appear in more than one
collection.

So they're indexed instead of copied:

| Key | Collection | Commit | License | Skills | Agents | Commands |
| --- | --- | --- | --- | ---: | ---: | ---: |
| `alirezarezvani` | [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | `9ef0c3c` | MIT | 389 | 128 | 161 |
| `wshobson` | [wshobson/agents](https://github.com/wshobson/agents) | `7e2fb55` | MIT | 185 | 202 | 95 |
| `ccplugins` | [ccplugins/awesome-claude-code-plugins](https://github.com/ccplugins/awesome-claude-code-plugins) | `5bd4f16` | Apache-2.0 | 84 | 132 | 129 |
| `rohitg00` | [rohitg00/awesome-claude-code-toolkit](https://github.com/rohitg00/awesome-claude-code-toolkit) | `ebdf1d5` | Apache-2.0 | 40 | 138 | 262 |
| `composio` | [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) | `be2a406` | Per skill, no root license | 864 | 0 | 1 |

Note: `wshobson/agents` is indexed here under its old, pre-11/2 scope *and* fully copied in as
its own pack above. The copy (185 skills, 147 agents, 96 commands from its 92 plugins) is what
actually loads; this `wshobson` shelf row is left over from before that copy was added and
points at the same upstream repo. It isn't worth pulling individual items through
`.claude/shelf/pull.sh wshobson ...` any more — anything in it is already installed, under the
name `.claude/wshobson/RENAMES.md` gives it.

- `.claude/shelf/<key>.tsv` has one row per item: type, name, description and path.
- `bash .claude/shelf/pull.sh <key> <path> [new-name]` fetches that one item at the pinned
  commit into `.claude/skills/`, `.claude/agents/` or `.claude/commands/`. It refuses names
  that are taken, copies the upstream license into a skill folder that lacks one, and flags
  shell pipes, override phrasing, plugin-only paths and pre-approved tools.
- The `shelf` skill tells Claude how to search and pull, so asking for something that isn't
  loaded is enough.
- The index skips hidden folders (mirrors for other tools, such as `.gemini/`) and `docs/`,
  `tests/`, `examples/` and `templates/`. Exact duplicates are dropped. rohitg00's hooks, rules
  and MCP configs aren't indexed.
- 832 of the `composio` skills automate one app each through Composio's Rube MCP connector, so
  they need a Composio account.
- To refresh the shelf, shallow-clone the five repos into one folder as `owner_repo` and run
  `python3 -I .claude/shelf/build_index.py <that folder> .claude/shelf`. The new commits land in
  `collections.tsv`.

## Decided on `.claude/settings.json`

Two changes needed your go-ahead before Claude could make them, since auto mode stops Claude
from editing its own settings and hooks on its own initiative. Both are now decided:

1. **Made.** `skillOverrides` is set to `"name-only"` for 327 of the 349 skills and commands
   added on 2 Nov. Without this, those entries would add about 86,000 characters of
   descriptions to the skill list Claude reads every turn, taking the repo's part of the list
   from about 27,000 to about 114,000 characters — well past the budget on a 200,000-token
   window, which would have Claude Code trimming descriptions across the board, starting with
   the skills you use least, your claude.ai skills included. With the overrides applied, the
   repo's part comes to about 40,000 characters instead. 22 of the 349 keep their full
   descriptions: 14 of Superpowers' 15 skills (all but `diagnosing-superpowers`), `find-skills`,
   `frontend-design`, `claude-md-improver`, `claude-automation-recommender`, `playground`,
   `session-report`, `avoid-ai-writing` and `handoff`. `skillListingBudgetFraction` went from
   0.08 to 0.1 alongside it, so the whole list, synced skills included, still fits on a
   200,000-token window with room left.
2. **Left off.** The Superpowers startup hook (`SessionStart` → `.claude/superpowers/session-start`)
   was not wired in. ECC's 28 hooks and Graphify's "always on" hooks were left unwired in this
   repo for the same reason: a hook that fires on every tool call or every session start changes
   how Claude behaves on unrelated work too, not just in this repo's own skill-heavy sessions. If
   you want it on, add a `SessionStart` entry to `.claude/settings.json` that runs
   `.claude/superpowers/session-start` — see "Superpowers" above for what changes once you do.

Agents have no equivalent setting. The 164 new agents add about 51,000 characters, roughly
13,000 tokens, to the agent list Claude sees every turn. If that is too much, delete the agent
files you won't use. `.claude/wshobson/RENAMES.md` and each pack's `installed-paths.txt` show
where every file came from.

## Context cost and `.claude/settings.json`

Claude Code puts a list of skill names and descriptions into context on every turn so Claude
knows what it can use. The list has a size cap, and past the cap descriptions get dropped,
starting with the skills used least.

`.claude/settings.json` keeps the list manageable, in two layers:

- From the first build: `skillOverrides` sets 429 entries to `"name-only"` — the rest of ECC's
  skills, ECC's commands, the 69 per-app CLI-Anything skills, `graphify`, five of the mem0
  skills, and `vercel-cli-with-tokens`, `vercel-react-native-skills`,
  `vercel-react-view-transitions` and `writing-guidelines`. These keep full descriptions:
  `arena`, `karpathy-guidelines`, `cli-anything`, `cli-hub-meta-skill`, and the 50 skills in
  ECC's own "minimal" profile (its 52 workflow skills minus `configure-ecc` and
  `skill-host-compat`).
- From the 2 Nov packs: 327 more entries set to `"name-only"`, as described above.
- `skillOverrides` now has 751 entries in total. `skillListingBudgetFraction` is 0.1, which
  leaves room for the whole list without truncation: roughly 7,000 tokens per turn from the
  first build's entries, plus roughly 13,000 tokens from the 2 Nov packs' overrides and new
  agents combined, on top of the skills you already had.

To give a skill its description back, change its value to `"on"` or delete its line. To hide
one from Claude but keep `/name`, use `"user-invocable-only"`. `"off"` hides it from both.

## Things to know

- Skills are instructions Claude follows. Before committing, every file was scanned for
  hidden Unicode, pipe-to-shell installs, exfiltration endpoints and prompt-injection phrasing.
  The only hits were defensive mentions and AdGuard's official installer in the AdGuard Home
  skill.
- Two ECC entries pre-approve unrestricted Bash while they run: the `/skill-create` command and
  the `inherit-legacy-style` skill.
- `cli-hub-meta-skill` points Claude at a live catalog hosted by the CLI-Hub maintainers. That
  content can change after this copy was made.
- Most `cli-anything-<app>` skills need the matching `pip install cli-anything-<app>` package,
  and often the desktop app itself, before they do anything.
- The six packs added on 2 Nov (1,073 files) went through the same scan. No hidden Unicode
  turned up. The URL hits were localhost examples, and the injection-style phrases were all
  warnings against that kind of text.
- Seven of the new entries pre-approve unrestricted Bash while they run: `/create-plugin`,
  `/create-docker-mcp-tunnel`, `/pr-review-toolkit-review-pr`, `/business-case`,
  `/financial-projections`, `/market-opportunity` and the `standup` skill.
- `receipts` and `session-report` read your transcripts in `~/.claude/projects`. In a cloud
  session that only covers the current container.

## Updating or removing a pack

Arena, Karpathy, CLI-Hub, the Cloudflare audit, Watch, the Vercel skills, Find Skills and the
mem0 skills are plain folders. To update one, replace the folder with the upstream copy.

To remove the shelf, delete `.claude/shelf/` and `.claude/skills/shelf/`.

For CLI-Anything and ECC, delete everything in the pack's `installed-paths.txt`, clone the
upstream repo, and lay it out again the same way. Re-apply the renames above and check for new
name clashes with built-in commands. Then regenerate the `skillOverrides` entries.

To remove a pack, delete its folders. For ECC and CLI-Anything, delete every path listed in its
`installed-paths.txt` and remove that pack's entries from `skillOverrides`.

The packs added on 2 Nov work the same way. Each one's `installed-paths.txt` lists every
skill folder, agent file, command file and support folder it added. To update one, clone the
upstream repo again, lay it out the same way, and re-apply the renames in its `RENAMES.md`
(Superpowers, find-skills, claude-mem and mem0 have no renames). To remove one, delete the
paths in its `installed-paths.txt` and any of its names in `skillOverrides`. For Superpowers,
also remove its `SessionStart` hook if you turned it on. Playwright is the `playwright` entry
in `.mcp.json` plus `.claude/mcp/playwright.sh`.
