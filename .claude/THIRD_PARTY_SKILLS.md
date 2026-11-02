# Third-party skills

Five open-source skill packs are copied into this repo. Anything under `.claude/skills`,
`.claude/agents` and `.claude/commands` loads in every Claude Code session on this repo,
including cloud sessions started from the web or the mobile app.

| Pack | Upstream (commit, date) | License | Where it lives | How to use it |
| --- | --- | --- | --- | --- |
| Arena | [Jakeschincariol/arena-skill](https://github.com/Jakeschincariol/arena-skill) `df07b8e`, 2026-09-26 | MIT | `.claude/skills/arena/` | `/arena`, `/arena --quick <task>`, `/arena --agents 32 <task>` |
| Karpathy guidelines | [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) `2c60614`, 2026-04-20 | MIT (declared in its manifest) | `.claude/skills/karpathy-guidelines/` | Claude applies it when writing or reviewing code. `/karpathy-guidelines` loads it on demand |
| CLI-Anything | [HKUDS/CLI-Anything](https://github.com/HKUDS/CLI-Anything) `34f5195`, 2026-09-22 | Apache-2.0 | `.claude/skills/cli-anything/`, `.claude/skills/cli-hub-meta-skill/`, 69 `.claude/skills/cli-anything-<app>/` | `/cli-anything <path-or-repo>` builds a CLI. `/cli-anything refine`, `test`, `validate` and `list` do the rest |
| ECC | [affaan-m/ECC](https://github.com/affaan-m/ECC) `b38be6a`, 2026-10-29 (v2.2.3) | MIT | 314 skills in `.claude/skills/`, 71 agents in `.claude/agents/`, 86 commands in `.claude/commands/`, support files in `.claude/ecc/` | `/ecc-guide` gives a tour. `/tdd-workflow`, `/verification-loop` and `/e2e-testing` are good starting points |
| Graphify | [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) `32e5efe`, 2026-11-01 (v0.9.100) | Apache-2.0, with an MIT notice for earlier contributions | `.claude/skills/graphify/` | `/graphify alevel-tracker` maps a folder into a knowledge graph. The first run installs its Python package |

Arena runs a tournament of sub-agents, and that gets expensive. The default of 100 agents
makes 595 sub-agent calls. `--quick` uses 16 agents and makes 91 calls.

Exact lists of the paths each big pack added are in `.claude/ecc/installed-paths.txt` and
`.claude/skills/cli-anything/installed-paths.txt`.

## Why these are plain files and not plugins

CLI-Anything and ECC ship as Claude Code plugins. Cloud sessions don't install plugins that
a repo declares in `.claude/settings.json`. They also skip plugin folders committed under
`.claude/skills/`, because loading those needs a saved workspace-trust record and cloud
sessions never have one. Plain skills, agents and commands always load, so both plugins are
laid out that way here.

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

## Context cost and `.claude/settings.json`

Claude Code puts a list of skill names and descriptions into context on every turn so Claude
knows what it can use. The list has a size cap, and past the cap descriptions get dropped,
starting with the skills used least. Adding about 480 entries at full length would have
pushed the list to roughly four times the cap, and most skills, including the ones synced
from your claude.ai account, would have lost their descriptions.

`.claude/settings.json` keeps the list manageable:

- `skillOverrides` sets 420 entries to `"name-only"`. These are the rest of ECC's skills, ECC's
  commands, the 69 per-app CLI-Anything skills and `graphify`. Claude still sees every name and can use
  any of them, and `/name` works as usual.
- These keep full descriptions: `arena`, `karpathy-guidelines`, `cli-anything`,
  `cli-hub-meta-skill`, and the 50 skills in ECC's own "minimal" profile (its 52 workflow
  skills minus `configure-ecc` and `skill-host-compat`).
- `skillListingBudgetFraction` is 0.08, which leaves room for the whole list without
  truncation. The entries added here come to about 27,000 characters, roughly 7,000 tokens
  per turn, on top of the skills you already had. ECC's 71 agents add about 4,000 tokens to
  the agent list.

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

## Updating or removing a pack

Arena, Karpathy and CLI-Hub are plain folders. To update one, replace the folder with the
upstream copy.

For CLI-Anything and ECC, delete everything in the pack's `installed-paths.txt`, clone the
upstream repo, and lay it out again the same way. Re-apply the renames above and check for new
name clashes with built-in commands. Then regenerate the `skillOverrides` entries.

To remove a pack, delete its folders. For ECC and CLI-Anything, delete every path listed in its
`installed-paths.txt` and remove that pack's entries from `skillOverrides`.
