# Renamed and merged items from wshobson/agents

Plain files share one namespace, so an item whose name was taken, too generic, or
different between two plugins got its plugin's name as a prefix. Upstream text that
pointed at the old name was updated to the new one.

## Skills

| Plugin | Upstream name | Name here | Why |
| --- | --- | --- | --- |
| documentation-generation | `architecture-decision-records` | `documentation-generation-architecture-decision-records` | name taken (existing skill) |
| machine-learning-ops | `recsys-pipeline-architect` | `machine-learning-ops-recsys-pipeline-architect` | name taken (existing skill) |

## Agents

| Plugin | Upstream name | Name here | Why |
| --- | --- | --- | --- |
| agent-orchestration | `agent-orchestration-context-manager` | `context-manager` | one copy kept of 2 identical ones |
| api-scaffolding | `api-scaffolding-backend-architect` | `backend-architect` | one copy kept of 6 identical ones |
| api-scaffolding | `api-scaffolding-django-pro` | `django-pro` | one copy kept of 2 identical ones |
| api-scaffolding | `api-scaffolding-fastapi-pro` | `fastapi-pro` | one copy kept of 2 identical ones |
| api-scaffolding | `api-scaffolding-graphql-architect` | `graphql-architect` | one copy kept of 2 identical ones |
| api-testing-observability | `api-testing-observability-api-documenter` | `api-documenter` | one copy kept of 2 identical ones |
| application-performance | `application-performance-frontend-developer` | `frontend-developer` | one copy kept of 4 identical ones |
| application-performance | `application-performance-observability-engineer` | `observability-engineer` | one copy kept of 2 identical ones |
| application-performance | `application-performance-performance-engineer` | `performance-engineer` | most common of 2 differing versions (4 of 5 copies) |
| backend-api-security | `backend-api-security-backend-security-coder` | `backend-security-coder` | one copy kept of 2 identical ones |
| backend-development | `backend-development-tdd-orchestrator` | `tdd-orchestrator` | one copy kept of 2 identical ones |
| cicd-automation | `cicd-automation-cloud-architect` | `cloud-architect` | most common of 2 differing versions (2 of 4 copies) |
| cicd-automation | `cicd-automation-deployment-engineer` | `deployment-engineer` | one copy kept of 4 identical ones |
| cicd-automation | `cicd-automation-devops-troubleshooter` | `devops-troubleshooter` | one copy kept of 3 identical ones |
| cicd-automation | `cicd-automation-kubernetes-architect` | `kubernetes-architect` | one copy kept of 3 identical ones |
| cicd-automation | `cicd-automation-terraform-specialist` | `terraform-specialist` | one copy kept of 3 identical ones |
| cloud-infrastructure | `cloud-infrastructure-network-engineer` | `network-engineer` | one copy kept of 2 identical ones |
| code-documentation | `code-documentation-docs-architect` | `docs-architect` | one copy kept of 2 identical ones |
| code-documentation | `code-documentation-tutorial-engineer` | `tutorial-engineer` | one copy kept of 2 identical ones |
| code-refactoring | `code-refactoring-legacy-modernizer` | `legacy-modernizer` | most common of 2 differing versions (2 of 3 copies) |
| codebase-cleanup | `codebase-cleanup-test-automator` | `test-automator` | most common of 3 differing versions (4 of 6 copies) |
| comprehensive-review | `comprehensive-review-architect-review` | `architect-review` | one copy kept of 2 identical ones |
| comprehensive-review | `comprehensive-review-security-auditor` | `security-auditor` | most common of 2 differing versions (4 of 5 copies) |
| database-cloud-optimization | `database-cloud-optimization-database-architect` | `database-architect` | most common of 2 differing versions (1 of 2 copies) |
| database-cloud-optimization | `database-cloud-optimization-database-optimizer` | `database-optimizer` | one copy kept of 3 identical ones |
| debugging-toolkit | `debugging-toolkit-debugger` | `debugger` | most common of 2 differing versions (4 of 5 copies) |
| debugging-toolkit | `debugging-toolkit-dx-optimizer` | `dx-optimizer` | one copy kept of 2 identical ones |
| distributed-debugging | `distributed-debugging-error-detective` | `error-detective` | most common of 2 differing versions (3 of 4 copies) |
| frontend-mobile-development | `frontend-mobile-development-mobile-developer` | `mobile-developer` | one copy kept of 2 identical ones |
| ship-mate | `architect` | `ship-mate-architect` | name taken (existing agent) |

## Commands

| Plugin | Upstream name | Name here | Why |
| --- | --- | --- | --- |
| accessibility-compliance | `accessibility-audit` | `accessibility-compliance-accessibility-audit` | differs between plugins |
| code-refactoring | `refactor-clean` | `code-refactoring-refactor-clean` | name taken (existing command) |
| conductor | `implement` | `conductor-implement` | generic name |
| conductor | `manage` | `conductor-manage` | generic name |
| conductor | `new-track` | `conductor-new-track` | generic name |
| conductor | `revert` | `conductor-revert` | generic name |
| conductor | `setup` | `conductor-setup` | differs between plugins |
| conductor | `status` | `conductor-status` | name taken (built-in) |
| debugging-toolkit | `smart-debug` | `debugging-toolkit-smart-debug` | differs between plugins |
| error-diagnostics | `smart-debug` | `error-diagnostics-smart-debug` | differs between plugins |
| git-pr-workflows | `git-workflow` | `git-pr-workflows-git-workflow` | name taken (existing skill) |
| git-pr-workflows | `onboard` | `git-pr-workflows-onboard` | generic name |
| meigen-ai-design | `find` | `meigen-ai-design-find` | generic name |
| meigen-ai-design | `gen` | `meigen-ai-design-gen` | generic name |
| plugin-eval | `certify` | `plugin-eval-certify` | generic name |
| plugin-eval | `compare` | `plugin-eval-compare` | generic name |
| plugin-eval | `eval` | `plugin-eval-eval` | generic name |
| protect-mcp | `audit-chain` | `protect-mcp-audit-chain` | generic name |
| protect-mcp | `verify-receipt` | `protect-mcp-verify-receipt` | generic name |
| review-agent-governance | `approve-review` | `review-agent-governance-approve-review` | generic name |
| review-agent-governance | `list-pending` | `review-agent-governance-list-pending` | generic name |
| ship-mate | `setup` | `ship-mate-setup` | differs between plugins |
| ship-mate | `ship` | `ship-mate-ship` | generic name |
| team-collaboration | `issue` | `team-collaboration-issue` | generic name |
| ui-design | `accessibility-audit` | `ui-design-accessibility-audit` | differs between plugins |

## Copies not installed separately

These were byte-for-byte the same as an item that is installed (apart from the agent name line), so references to them now point at the installed one.

| Item | Same as |
| --- | --- |
| agent backend-api-security-backend-architect (backend-api-security) | `backend-architect` |
| agent backend-development-backend-architect (backend-development) | `backend-architect` |
| agent backend-development-graphql-architect (backend-development) | `graphql-architect` |
| agent cloud-infrastructure-cloud-architect (cloud-infrastructure) | `cloud-architect` |
| agent cloud-infrastructure-deployment-engineer (cloud-infrastructure) | `deployment-engineer` |
| agent cloud-infrastructure-kubernetes-architect (cloud-infrastructure) | `kubernetes-architect` |
| agent cloud-infrastructure-terraform-specialist (cloud-infrastructure) | `terraform-specialist` |
| agent code-refactoring-code-reviewer (code-refactoring) | `code-documentation-code-reviewer` |
| agent codebase-cleanup-code-reviewer (codebase-cleanup) | `code-documentation-code-reviewer` |
| agent comprehensive-review-code-reviewer (comprehensive-review) | `code-documentation-code-reviewer` |
| agent context-management-context-manager (context-management) | `context-manager` |
| agent data-engineering-backend-architect (data-engineering) | `backend-architect` |
| agent data-validation-suite-backend-security-coder (data-validation-suite) | `backend-security-coder` |
| agent database-cloud-optimization-backend-architect (database-cloud-optimization) | `backend-architect` |
| agent database-migrations-database-optimizer (database-migrations) | `database-optimizer` |
| agent dependency-management-legacy-modernizer (dependency-management) | `legacy-modernizer` |
| agent deployment-strategies-deployment-engineer (deployment-strategies) | `deployment-engineer` |
| agent deployment-strategies-terraform-specialist (deployment-strategies) | `terraform-specialist` |
| agent deployment-validation-cloud-architect (deployment-validation) | `database-cloud-optimization-cloud-architect` |
| agent distributed-debugging-devops-troubleshooter (distributed-debugging) | `devops-troubleshooter` |
| agent documentation-generation-api-documenter (documentation-generation) | `api-documenter` |
| agent documentation-generation-docs-architect (documentation-generation) | `docs-architect` |
| agent documentation-generation-tutorial-engineer (documentation-generation) | `tutorial-engineer` |
| agent error-debugging-debugger (error-debugging) | `debugger` |
| agent error-debugging-error-detective (error-debugging) | `error-detective` |
| agent error-diagnostics-debugger (error-diagnostics) | `debugger` |
| agent error-diagnostics-error-detective (error-diagnostics) | `error-detective` |
| agent framework-migration-architect-review (framework-migration) | `architect-review` |
| agent frontend-mobile-development-frontend-developer (frontend-mobile-development) | `frontend-developer` |
| agent frontend-mobile-security-frontend-developer (frontend-mobile-security) | `frontend-developer` |
| agent full-stack-orchestration-deployment-engineer (full-stack-orchestration) | `deployment-engineer` |
| agent full-stack-orchestration-performance-engineer (full-stack-orchestration) | `performance-engineer` |
| agent full-stack-orchestration-security-auditor (full-stack-orchestration) | `security-auditor` |
| agent full-stack-orchestration-test-automator (full-stack-orchestration) | `test-automator` |
| agent git-pr-workflows-code-reviewer (git-pr-workflows) | `code-documentation-code-reviewer` |
| agent incident-response-devops-troubleshooter (incident-response) | `devops-troubleshooter` |
| agent kubernetes-operations-kubernetes-architect (kubernetes-operations) | `kubernetes-architect` |
| agent multi-platform-apps-backend-architect (multi-platform-apps) | `backend-architect` |
| agent multi-platform-apps-frontend-developer (multi-platform-apps) | `frontend-developer` |
| agent multi-platform-apps-mobile-developer (multi-platform-apps) | `mobile-developer` |
| agent observability-monitoring-database-optimizer (observability-monitoring) | `database-optimizer` |
| agent observability-monitoring-network-engineer (observability-monitoring) | `network-engineer` |
| agent observability-monitoring-observability-engineer (observability-monitoring) | `observability-engineer` |
| agent observability-monitoring-performance-engineer (observability-monitoring) | `performance-engineer` |
| agent performance-testing-review-performance-engineer (performance-testing-review) | `performance-engineer` |
| agent performance-testing-review-test-automator (performance-testing-review) | `test-automator` |
| agent python-development-django-pro (python-development) | `django-pro` |
| agent python-development-fastapi-pro (python-development) | `fastapi-pro` |
| agent security-compliance-security-auditor (security-compliance) | `security-auditor` |
| agent security-scanning-security-auditor (security-scanning) | `security-auditor` |
| agent tdd-workflows-code-reviewer (tdd-workflows) | `code-documentation-code-reviewer` |
| agent tdd-workflows-tdd-orchestrator (tdd-workflows) | `tdd-orchestrator` |
| agent team-collaboration-dx-optimizer (team-collaboration) | `dx-optimizer` |
| agent unit-testing-debugger (unit-testing) | `debugger` |
| agent unit-testing-test-automator (unit-testing) | `test-automator` |
| command context-restore (context-management) | `/context-restore` |
| command deps-audit (dependency-management) | `/deps-audit` |
| command doc-generate (documentation-generation) | `/doc-generate` |
| command error-analysis (error-diagnostics) | `/error-analysis` |
| command error-trace (error-diagnostics) | `/error-trace` |
| command multi-agent-review (performance-testing-review) | `/multi-agent-review` |
| command pr-enhance (git-pr-workflows) | `/pr-enhance` |
| command refactor-clean (codebase-cleanup) | `/code-refactoring-refactor-clean` |
| command tech-debt (codebase-cleanup) | `/tech-debt` |
