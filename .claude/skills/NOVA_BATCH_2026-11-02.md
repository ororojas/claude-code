# Skills from Nova's 2 Nov batch

Oro sent Nova 21 videos and screenshots on 2 Nov 2026. Nova listed 18 repos from them. Claude checked each one before adding anything.

## Added here

| Skill | Upstream | What it does |
| --- | --- | --- |
| `security-audit` | cloudflare/security-audit-skill @ `c1c8a8c` (MIT) | Security review guidance. Only runs the full six-phase audit when asked for one. |
| `watch` | bradautomates/claude-video @ `03ceb42` (MIT) | `/watch <url>`: downloads a video with yt-dlp, pulls frames and captions so Claude can answer questions about it. Optional `GEMINI_API_KEY` lets Gemini watch the whole video. |

The `watch` plugin's SessionStart hook was left out; it only printed a setup reminder. Setup runs the first time `/watch` is used.

## Not added

- **Not skills, saved for Jarvis:** n8n-io/n8n (workflow automation server), SYSTRAN/faster-whisper (speech to text), thewh1teagle/kokoro-onnx (text to speech).
- **Skipped:** asgeirtj/system_prompts_leaks (a collection of leaked AI system prompts, nothing to install).
- **Couldn't find under the names given (may be misread from the videos):** brown101010/agent-native-landing, OmniAI-Labs/mode, inbox-zero/inbox-zero, anders/peace-gallery-3d, Interstellar-Deus/Search-Toolkit, designfucker/wool-ui, MaffyHacks/skills, thestackdude/claude-cli, miloz-net/open-memory, DashaStack/vibe-cli, owalski/skills, addyo/ponytail.
