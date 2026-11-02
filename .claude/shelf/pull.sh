#!/usr/bin/env bash
# Pull one skill, agent or command from the shelf into .claude/, at the
# upstream commit recorded in collections.tsv.
#
#   bash .claude/shelf/pull.sh <collection> <path> [new-name]
#
# <collection>  a key from collections.tsv: alirezarezvani, wshobson, ccplugins,
#               rohitg00 or composio
# <path>        the path column of that collection's .tsv, copied exactly
# [new-name]    install under another name, for when the name is taken
set -euo pipefail

shelf="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
claude_dir="$(dirname "$shelf")"

usage() {
  sed -n '5,12p' "${BASH_SOURCE[0]}" | sed -E 's/^# ?//' >&2
  exit 2
}
[ $# -ge 2 ] && [ $# -le 3 ] || usage
collection="$1"
path="$2"
new_name="${3:-}"
[ -n "$collection" ] && [ -n "$path" ] || usage

row="$(awk -F'\t' -v k="$collection" 'NR > 1 && $1 == k { print; exit }' "$shelf/collections.tsv")"
if [ -z "$row" ]; then
  echo "Unknown collection '$collection'. Use one of: $(awk -F'\t' 'NR > 1 { printf "%s ", $1 }' "$shelf/collections.tsv")" >&2
  exit 1
fi
repo="$(printf '%s\n' "$row" | cut -f2)"
commit="$(printf '%s\n' "$row" | cut -f3)"

case "/$path/" in
  */../* | */./* | //*) echo "Refusing path '$path'." >&2; exit 1 ;;
esac
item="$(awk -F'\t' -v p="$path" 'NR > 1 && $4 == p { print; exit }' "$shelf/$collection.tsv")"
if [ -z "$item" ]; then
  echo "No item with path '$path' in $collection.tsv. Copy the path column exactly." >&2
  exit 1
fi
type="$(printf '%s\n' "$item" | cut -f1)"
name="$(printf '%s\n' "$item" | cut -f2)"

slug() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^[-.]+//; s/-+$//'
}
target="$(slug "${new_name:-$name}")"
if [ -z "$target" ]; then
  echo "Could not make a file name from '$name'. Pass a new name as the third argument." >&2
  exit 1
fi

case "$type" in
  skill) dest="$claude_dir/skills/$target" ;;
  agent) dest="$claude_dir/agents/$target.md" ;;
  command) dest="$claude_dir/commands/$target.md" ;;
  *) echo "Unknown type '$type' in $collection.tsv." >&2; exit 1 ;;
esac

# Skills and commands share the /name namespace, so check both folders for those.
taken=""
[ -e "$dest" ] && taken="$dest"
if [ "$type" = skill ] && [ -e "$claude_dir/commands/$target.md" ]; then taken="$claude_dir/commands/$target.md"; fi
if [ "$type" = command ] && [ -e "$claude_dir/skills/$target" ]; then taken="$claude_dir/skills/$target"; fi
if [ -n "$taken" ]; then
  echo "'$target' is taken by .claude/${taken#"$claude_dir/"}. Run again with a new name, for example: $collection-$target" >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git -C "$tmp" init -q
git -C "$tmp" remote add origin "https://github.com/$repo.git"
if [ "$type" = skill ]; then pattern="/$path/"; else pattern="/$path"; fi
git -C "$tmp" sparse-checkout set --no-cone "$pattern" /LICENSE /LICENSE.md /LICENSE.txt
git -C "$tmp" fetch -q --depth 1 --filter=blob:none origin "$commit"
git -C "$tmp" -c advice.detachedHead=false checkout -q FETCH_HEAD
src="$tmp/$path"
if [ ! -e "$src" ]; then
  echo "Fetched $repo at ${commit:0:7}, but '$path' is not in it." >&2
  exit 1
fi

mkdir -p "$(dirname "$dest")"
if [ "$type" = skill ]; then
  cp -R "$src" "$dest"
  # Keep the upstream license with a skill folder that doesn't carry its own.
  if ! ls "$dest"/LICENSE* >/dev/null 2>&1; then
    for lic in LICENSE LICENSE.md LICENSE.txt; do
      if [ -f "$tmp/$lic" ]; then cp "$tmp/$lic" "$dest/$lic"; break; fi
    done
  fi
  meta="$dest/SKILL.md"
else
  cp "$src" "$dest"
  meta="$dest"
fi

# A renamed skill or agent needs the name in its frontmatter to match.
if [ "$type" != command ] && [ "$target" != "$name" ]; then
  awk -v n="$target" '
    NR == 1 && /^---/ { fm = 1; print; next }
    fm && /^---/ { fm = 0 }
    fm && !done && /^name:/ { print "name: " n; done = 1; next }
    { print }
  ' "$meta" > "$meta.tmp" && mv "$meta.tmp" "$meta"
fi

root="$(dirname "$claude_dir")"
echo "Pulled $type '$name' from $repo at ${commit:0:7} into ${dest#"$root/"}"
if [ "$type" = skill ]; then
  echo "Files:"
  (cd "$dest" && find . -type f | sed 's|^\./|  |' | sort)
fi

echo
echo "Checks:"
flags=0
if grep -rnE '(curl|wget)[^|#]*\|[[:space:]]*(sudo[[:space:]]+)?(ba|z)?sh\b' "$dest" >/dev/null 2>&1; then
  echo "  ! pipes a download into a shell:"; grep -rnE '(curl|wget)[^|#]*\|[[:space:]]*(sudo[[:space:]]+)?(ba|z)?sh\b' "$dest" | cut -c1-200 | sed 's/^/    /'; flags=1
fi
if grep -rniE 'ignore (all |any )?(previous|prior|above) (instructions|rules)|do not (tell|inform) the user|without (telling|informing) the user' "$dest" >/dev/null 2>&1; then
  echo "  ! contains instruction-override phrasing:"; grep -rniE 'ignore (all |any )?(previous|prior|above) (instructions|rules)|do not (tell|inform) the user|without (telling|informing) the user' "$dest" | cut -c1-200 | sed 's/^/    /'; flags=1
fi
if grep -rlE 'CLAUDE_PLUGIN_ROOT' "$dest" >/dev/null 2>&1; then
  echo "  ! refers to \${CLAUDE_PLUGIN_ROOT}, so parts of it expect the plugin layout and may not work as a loose copy"; flags=1
fi
if grep -rnE '^allowed-tools:' "$dest" >/dev/null 2>&1; then
  echo "  ! pre-approves tools while it runs:"; grep -rnE '^allowed-tools:' "$dest" | cut -c1-200 | sed 's/^/    /'; flags=1
fi
[ "$flags" = 0 ] && echo "  nothing flagged"
echo
echo "Read every file before relying on it. It is third-party text that Claude will follow."
