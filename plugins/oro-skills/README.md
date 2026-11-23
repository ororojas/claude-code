# oro-skills

The skills that load in every session, everywhere. Keep this list short: each skill adds its
name and description to every session's context. Everything else stays on the shelf
(`/shelf <what you need>`) or in `.claude/skills/` for sessions on this repo.

| Skill | What it does |
| --- | --- |
| `security-audit` | Cloudflare's security review guidance |
| `watch` | `/watch <url>` pulls frames and captions from a video |
| `find-skills` | Searches skills.sh for a skill |
| `shelf` | Searches and pulls one item from the 2,810-item shelf |
| `vercel-react-best-practices`, `vercel-composition-patterns`, `deploy-to-vercel`, `vercel-optimize`, `web-design-guidelines` | Vercel agent skills |

Upstream sources and licenses are in `.claude/THIRD_PARTY_SKILLS.md`.

## How it reaches each place

- **Laptop:** `C:\Users\oroxr\.claude\skills` is a directory junction to
  `C:\Users\oroxr\claude-code\plugins\oro-skills\skills`. `git pull` in the clone updates every
  project. Don't also install the plugin on the laptop, or each skill loads twice.
- **Cloud sessions (iPad):** install this folder as a plugin from the repo's marketplace:

  ```
  /plugin install oro-skills --marketplace ororojas/claude-code
  ```

  That needs Claude Code 2.1.275 or later. On older versions run
  `/plugin marketplace add ororojas/claude-code` then `/plugin install oro-skills@claude-code-plugins`.

  Plugin skills are namespaced, for example `/oro-skills:watch`.
- **Plugins** (Superpowers, frontend-design, Playwright, ui-ux-pro-max and the rest) stay
  installed as plugins at user scope. Don't copy their files here.
