# Git Safety & Permission Rules

## Critical Constraint: Explicit Permission for Modifying Git Operations

Even when running in **Turbo Mode**, **Auto-Execution Mode**, or with automatic command approvals enabled, Antigravity **MUST NEVER** execute any of the following Git operations without explicit, prior user confirmation in the conversation:

### 1. Restricted Git Commands (Require Explicit Permission)
- **`git commit`**: Creating commits (`git commit`, `git commit -m`, `git commit -am`, etc.)
- **`git push`**: Pushing to remote repositories (`git push`, `git push origin ...`, `git push --force`, etc.)
- **`git pull`**: Pulling/fetching and integrating upstream changes (`git pull`, `git pull --rebase`, etc.)
- **`git merge`**: Merging branches or commits (`git merge <branch>`, etc.)
- **Branch Change / Modification**:
  - Switching branches (`git checkout <branch>`, `git switch <branch>`)
  - Creating, deleting, or renaming branches (`git branch -d`, `git branch -D`, `git branch -m`, `git checkout -b`, `git switch -c`)
- **Other History Alterations**: `git rebase`, `git reset`, `git revert`, `git cherry-pick`, `git stash drop`

### 2. Protocol When a Restricted Command is Needed
Whenever one of the restricted Git commands is deemed necessary:
1. **Stop execution**: Do NOT run the command automatically in the background or terminal.
2. **Explain the intent**: Clearly state to the user:
   - The exact Git command intended to run (e.g., `git checkout -b feature/login`).
   - The reason why this command is being proposed.
3. **Wait for user consent**: Ask the user for explicit approval and wait for their reply before invoking the command.

---

## Unrestricted Operations (Other Permissions Unaffected)

To ensure smooth workflow in Turbo Mode, **all other commands and tools remain unrestricted** and should execute automatically according to standard Turbo Mode permissions:

- **Read-Only Git Commands**:
  - `git status`
  - `git diff`
  - `git log`
  - `git show`
  - `git branch` (listing branches only)
- **File & Code Operations**:
  - Reading, creating, and modifying project code and configuration files.
- **Build & Development Tools**:
  - Package management and running scripts (`npm install`, `npm test`, `npm run build`, `pnpm`, `yarn`, etc.).
  - Compilers, linters, test runners, and diagnostic scripts.
- **Terminal Execution**:
  - Standard development commands run in the terminal sandbox continue operating under their normal Turbo Mode policies.
