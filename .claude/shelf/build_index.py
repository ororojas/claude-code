"""Build the shelf catalogs for the big skill collections.

Usage: python3 -I .claude/shelf/build_index.py <clones_dir> .claude/shelf

<clones_dir> holds shallow clones named owner_repo, for example
wshobson_agents. The script rewrites collections.tsv with each clone's
commit, so pull.sh fetches items from the same commit that was indexed.

For each collection it writes <key>.tsv with one row per skill, agent and
command: type, name, description, path. Paths are relative to the upstream
repo root, so .claude/shelf/pull.sh can fetch exactly that item later.
"""
import os
import re
import sys
import json
import unicodedata

COLLECTIONS = [
    # key, folder in repos_dir, owner/repo, license
    ("alirezarezvani", "alirezarezvani_claude-skills", "alirezarezvani/claude-skills", "MIT"),
    ("wshobson", "wshobson_agents", "wshobson/agents", "MIT"),
    ("ccplugins", "ccplugins_awesome-claude-code-plugins", "ccplugins/awesome-claude-code-plugins", "Apache-2.0"),
    ("rohitg00", "rohitg00_awesome-claude-code-toolkit", "rohitg00/awesome-claude-code-toolkit", "Apache-2.0"),
    ("composio", "ComposioHQ_awesome-claude-skills", "ComposioHQ/awesome-claude-skills", "per skill (no root license)"),
]

SKIP_DIRS = {"node_modules", "docs", "tests", "test", "examples", "evals", "templates", "dist", "build", "__pycache__"}
MAX_DESC = 220
# Zero-width, bidi-control and other invisible characters that have no place in a catalog line.
INVISIBLE = re.compile("[​-‏‪-‮⁠-⁤⁦-⁩﻿­]")


def clean(text):
    text = INVISIBLE.sub("", text)
    text = "".join(ch if unicodedata.category(ch)[0] != "C" else " " for ch in text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > MAX_DESC:
        text = text[: MAX_DESC - 1].rstrip() + "…"
    return text


def frontmatter(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            lines = fh.read().splitlines()
    except OSError:
        return {}
    if not lines or lines[0].strip() != "---":
        return {}
    block = []
    for line in lines[1:]:
        if line.strip() == "---":
            break
        block.append(line)
    data = {}
    i = 0
    while i < len(block):
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", block[i])
        if not m:
            i += 1
            continue
        key, val = m.group(1), m.group(2).strip()
        if val in ("|", ">", "|-", ">-", "|+", ">+", ""):
            parts = []
            i += 1
            while i < len(block) and (block[i].startswith((" ", "\t")) or not block[i].strip()):
                parts.append(block[i].strip())
                i += 1
            data[key] = " ".join(p for p in parts if p)
            continue
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        data[key] = val
        i += 1
    return data


def first_paragraph(path):
    """Fallback description: first non-heading prose line after the frontmatter."""
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    except OSError:
        return ""
    text = re.sub(r"^---\n.*?\n---\n", "", text, flags=re.S)
    for line in text.splitlines():
        s = line.strip()
        if s and not s.startswith(("#", "```", "<", "|", "-", "*", ">")):
            return s
    return ""


def walk(root):
    for dirpath, dirnames, filenames in os.walk(root):
        rel = os.path.relpath(dirpath, root)
        parts = [] if rel == "." else rel.split(os.sep)
        # Hidden folders hold mirrors for other tools (.gemini, .codex) or repo tooling.
        dirnames[:] = [d for d in dirnames if not d.startswith(".") and d not in SKIP_DIRS]
        yield dirpath, parts, filenames


def collect(root):
    rows = []
    for dirpath, parts, filenames in walk(root):
        rel_dir = "/".join(parts)
        if "SKILL.md" in filenames:
            fm = frontmatter(os.path.join(dirpath, "SKILL.md"))
            name = fm.get("name") or (parts[-1] if parts else "")
            desc = fm.get("description") or first_paragraph(os.path.join(dirpath, "SKILL.md"))
            rows.append(("skill", name, desc, rel_dir))
        # Agents and commands can sit in category subfolders (agents/<category>/x.md).
        holder = next((p for p in reversed(parts) if p in ("agents", "commands")), "")
        if holder and "SKILL.md" not in filenames and not any(p == "skills" for p in parts):
            for fn in sorted(filenames):
                if not fn.endswith(".md") or fn.lower() in ("readme.md", "index.md", "claude.md", "agents.md"):
                    continue
                full = os.path.join(dirpath, fn)
                fm = frontmatter(full)
                kind = "agent" if holder == "agents" else "command"
                name = fm.get("name") if kind == "agent" and fm.get("name") else fn[:-3]
                desc = fm.get("description") or first_paragraph(full)
                rows.append((kind, name, desc, f"{rel_dir}/{fn}"))
    # Drop exact duplicates (same type, name and description), keeping the first path.
    seen, unique = set(), []
    for kind, name, desc, path in sorted(rows, key=lambda r: (r[0], r[1].lower(), r[3])):
        key = (kind, name.lower(), clean(desc).lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append((kind, clean(name), clean(desc), path))
    return unique


def main():
    repos_dir, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    summary = []
    for key, folder, repo, license_name in COLLECTIONS:
        root = os.path.join(repos_dir, folder)
        head = open(os.path.join(root, ".git", "HEAD")).read().strip()
        commit = head if not head.startswith("ref:") else open(os.path.join(root, ".git", head[5:])).read().strip()
        rows = collect(root)
        with open(os.path.join(out_dir, f"{key}.tsv"), "w", encoding="utf-8") as out:
            out.write("type\tname\tdescription\tpath\n")
            for row in rows:
                out.write("\t".join(field.replace("\t", " ") for field in row) + "\n")
        counts = {t: sum(1 for r in rows if r[0] == t) for t in ("skill", "agent", "command")}
        chars = sum(len(r[1]) + len(r[2]) for r in rows)
        agent_chars = sum(len(r[1]) + len(r[2]) for r in rows if r[0] == "agent")
        summary.append({"key": key, "repo": repo, "commit": commit, "license": license_name, **counts,
                        "listing_chars": chars, "agent_chars": agent_chars})
    with open(os.path.join(out_dir, "collections.tsv"), "w", encoding="utf-8") as out:
        out.write("key\trepo\tcommit\tlicense\tskills\tagents\tcommands\n")
        for s in summary:
            out.write(f"{s['key']}\t{s['repo']}\t{s['commit']}\t{s['license']}\t{s['skill']}\t{s['agent']}\t{s['command']}\n")
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
