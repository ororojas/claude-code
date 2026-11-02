---
name: cli-anything
description: >-
  Build a stateful, agent-ready command-line interface (a "CLI harness") for any
  GUI application from its source code, using the CLI-Anything methodology from
  HKUDS. Use when the user wants software such as GIMP, Blender, LibreOffice or
  an internal tool wrapped in a CLI an agent can drive, or wants an existing
  harness refined, tested, validated or listed.
argument-hint: "[refine|test|validate|list] <software-path-or-repo> [focus]"
---

# CLI-Anything

This is the CLI-Anything Claude Code plugin from https://github.com/HKUDS/CLI-Anything,
installed as a plain project skill so it also loads in cloud sessions. All of the plugin's
files sit next to this one, in `${CLAUDE_SKILL_DIR}`.

What the user typed after `/cli-anything`: `$ARGUMENTS`

## Pick the mode

Look at the first word of the arguments.

| First word | What to do | Instructions to follow |
| --- | --- | --- |
| `refine` | Extend an existing harness | `${CLAUDE_SKILL_DIR}/commands/refine.md` |
| `test` | Run the harness tests and update TEST.md | `${CLAUDE_SKILL_DIR}/commands/test.md` |
| `validate` | Check a harness against the standards | `${CLAUDE_SKILL_DIR}/commands/validate.md` |
| `list` | List installed and generated CLIs | `${CLAUDE_SKILL_DIR}/commands/list.md` |
| anything else | Build a new harness | `${CLAUDE_SKILL_DIR}/commands/cli-anything.md` |

Drop the mode word and pass the rest on as that command's arguments. Upstream these were
five separate commands: `/cli-anything`, `/cli-anything:refine`, `/cli-anything:test`,
`/cli-anything:validate` and `/cli-anything:list`. Read the chosen file in full and follow
it exactly.

## Paths in the command files

The command files were written for the plugin layout. Resolve their relative paths
against `${CLAUDE_SKILL_DIR}`:

- `./HARNESS.md` means `${CLAUDE_SKILL_DIR}/HARNESS.md`. Every command says to read it
  first. Do that.
- `guides/...` and `../guides/...` mean `${CLAUDE_SKILL_DIR}/guides/...`.
- `skill_generator.py`, `repl_skin.py`, `preview_bundle.py`, `templates/` and `scripts/`
  are in `${CLAUDE_SKILL_DIR}` as well.

## Related skills

- `cli-hub-meta-skill` finds and installs ready-made CLIs from the CLI-Hub registry
  (`pip install cli-anything-hub`). Check it before building a harness from scratch,
  because the software may already have one.
- The `cli-anything-<software>` skills (gimp, blender, libreoffice, obsidian, zotero and
  about 65 others) explain how to drive each published CLI once it is installed.
