# Renamed and merged items from claude-plugins-official

Plain files share one namespace, so an item whose name was taken, too generic, or
different between two plugins got its plugin's name as a prefix. Upstream text that
pointed at the old name was updated to the new one.

## Skills

| Plugin | Upstream name | Name here | Why |
| --- | --- | --- | --- |
| math-proof | `siege` | `math-proof-siege` | generic name; plugin form is /math-proof:siege |
| math-proof | `solo` | `math-proof-solo` | generic name; plugin form is /math-proof:solo |

## Agents

| Plugin | Upstream name | Name here | Why |
| --- | --- | --- | --- |
| feature-dev | `code-architect` | `feature-dev-code-architect` | ECC already has this agent name |
| feature-dev | `code-explorer` | `feature-dev-code-explorer` | ECC already has this agent name |
| feature-dev | `code-reviewer` | `feature-dev-code-reviewer` | ECC already has this agent name |
| pr-review-toolkit | `code-reviewer` | `pr-review-toolkit-code-reviewer` | ECC already has this agent name |
| pr-review-toolkit | `code-simplifier` | `pr-review-toolkit-code-simplifier` | ECC already has this agent name |
| pr-review-toolkit | `comment-analyzer` | `pr-review-toolkit-comment-analyzer` | ECC already has this agent name |
| pr-review-toolkit | `pr-test-analyzer` | `pr-review-toolkit-pr-test-analyzer` | ECC already has this agent name |
| pr-review-toolkit | `silent-failure-hunter` | `pr-review-toolkit-silent-failure-hunter` | ECC already has this agent name |
| pr-review-toolkit | `type-design-analyzer` | `pr-review-toolkit-type-design-analyzer` | ECC already has this agent name |

## Commands

| Plugin | Upstream name | Name here | Why |
| --- | --- | --- | --- |
| code-review | `code-review` | `official-code-review` | built-in /code-review |
| feature-dev | `feature-dev` | `official-feature-dev` | ECC already has /feature-dev |
| pr-review-toolkit | `review-pr` | `pr-review-toolkit-review-pr` | ECC already has /review-pr |
