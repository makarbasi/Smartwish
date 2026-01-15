# Multi-Member Git Development Workflow

A practical guide for team development with branches in the SmartWish project.

---

## 1. Branch Strategy Overview

```
main (production-ready code)
  │
  └── development (integration branch)
        │
        ├── feature/user-auth      (Developer A)
        ├── feature/payment-system (Developer B)
        └── bugfix/login-error     (Developer C)
```

---

## 2. Setting Up for Team Members

Each developer clones the repo and creates their own feature branch:

```bash
# Clone the repository
git clone https://github.com/makarbasi/Smartwish.git
cd Smartwish

# Always start from the latest main/development
git checkout main
git pull origin main

# Create a feature branch
git checkout -b feature/my-new-feature
```

---

## 3. Branch Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| New feature | `feature/description` | `feature/user-profile` |
| Bug fix | `bugfix/description` | `bugfix/login-crash` |
| Hotfix (urgent) | `hotfix/description` | `hotfix/security-patch` |
| Experiment | `experiment/description` | `experiment/new-ui` |

---

## 4. Daily Developer Workflow

### Working on Your Branch

```bash
# Make changes, then stage and commit
git add .
git commit -m "Add user profile page"

# Push your branch to remote (first time)
git push -u origin feature/my-new-feature

# Subsequent pushes
git push
```

### Staying Updated with Main

```bash
# Fetch latest changes
git fetch origin

# Merge main into your branch (recommended)
git merge origin/main

# OR rebase (cleaner history, but more advanced)
git rebase origin/main
```

---

## 5. Merging Code Back (Two Methods)

### Method A: Pull Request (Recommended for Teams)

1. Push your branch to GitHub
2. Go to GitHub → "Pull Requests" → "New Pull Request"
3. Select: `base: main` ← `compare: feature/my-new-feature`
4. Add description, request reviewers
5. After approval, click "Merge"

### Method B: Command Line Merge

```bash
# Switch to main
git checkout main
git pull origin main

# Merge the feature branch
git merge feature/my-new-feature

# Push the updated main
git push origin main

# Delete the feature branch (cleanup)
git branch -d feature/my-new-feature
git push origin --delete feature/my-new-feature
```

---

## 6. Handling Merge Conflicts

When two developers edit the same file:

```bash
# Git will show conflict markers in the file:
<<<<<<< HEAD
your changes
=======
their changes
>>>>>>> feature/other-branch

# Fix manually, then:
git add .
git commit -m "Resolve merge conflict"
```

---

## 7. Practical Example: 3 Developers

```bash
# === DEVELOPER A (working on auth) ===
git checkout main && git pull
git checkout -b feature/auth-system
# ... work, commit, push ...
git push -u origin feature/auth-system
# Create Pull Request on GitHub

# === DEVELOPER B (working on payments) ===
git checkout main && git pull
git checkout -b feature/payment-gateway
# ... work, commit, push ...
git push -u origin feature/payment-gateway
# Create Pull Request on GitHub

# === DEVELOPER C (reviewing & merging) ===
# Reviews PRs on GitHub, approves, merges

# === ALL DEVELOPERS (after merge) ===
git checkout main
git pull origin main
# Now everyone has the latest code
```

---

## 8. Useful Commands Reference

| Command | Purpose |
|---------|---------|
| `git branch` | List local branches |
| `git branch -a` | List all branches (including remote) |
| `git checkout -b name` | Create and switch to new branch |
| `git switch name` | Switch to existing branch |
| `git merge branch-name` | Merge branch into current |
| `git branch -d name` | Delete local branch |
| `git push origin --delete name` | Delete remote branch |
| `git log --oneline --graph` | Visual branch history |
| `git stash` | Temporarily save uncommitted changes |
| `git stash pop` | Restore stashed changes |

---

## 9. Best Practices

1. **Pull before you push** - Always `git pull` before starting work
2. **Small, frequent commits** - Easier to review and revert
3. **Descriptive branch names** - `feature/add-stripe-checkout` not `my-branch`
4. **Never commit to main directly** - Always use feature branches
5. **Delete merged branches** - Keep the repo clean
6. **Use Pull Requests** - Code review catches bugs early

---

## 10. Quick Start Checklist for New Team Members

- [ ] Clone the repository
- [ ] Set up your Git identity:
  ```bash
  git config user.name "Your Name"
  git config user.email "your.email@example.com"
  ```
- [ ] Create a feature branch for your first task
- [ ] Make small commits with clear messages
- [ ] Push your branch and create a Pull Request
- [ ] Request a code review before merging

---

## Need Help?

- [Git Documentation](https://git-scm.com/doc)
- [GitHub Pull Request Guide](https://docs.github.com/en/pull-requests)
- [Atlassian Git Tutorials](https://www.atlassian.com/git/tutorials)

