# 🐍 PyManager - Documentation (v2.0 Update)

PyManager has evolved from a simple environment lister to a comprehensive **Python Development Studio**. This documentation reflects the current state of the application as of March 1, 2026.

## 🏗️ Architectural Evolution

### Frontend Enhancements
- **Python Dev Studio (Overlay):** A full-screen management interface that provides deep analysis of specific environments without cluttering the main view.
- **Improved UI/UX:** High-contrast theme support, reduced visual noise, and always-visible persistent actions.
- **Tabbed Management:** Categorized interface for Packages, Automation, Configuration, and Diagnostics.

### Backend (Rust) Advancements
- **Advanced Diagnostics:** Integration with `pip check` for dependency conflict detection and `pip list --outdated` for version tracking.
- **System Discovery:** Automatic detection of multiple system Python interpreters (/usr/bin/python3.x).
- **Execution Engine:** Robust script execution and `.env` file manipulation logic.
- **Multi-Terminal Support:** Priority-based fallback system for Linux terminal emulators (Gnome, Konsole, Xfce, etc.).

## 🚀 Professional Feature Set

### 1. Python Dev Studio
- **Package Manager:** Individual uninstallation and upgrading of libraries directly from the UI.
- **Script Runner:** Create, save (in SQLite), and execute Python snippets within the venv context.
- **Config Editor:** Integrated editor for `.env` files and read-only viewer for `pyvenv.cfg`.
- **Diagnostics:** Full integrity check for package health and outdated versions.

### 2. Environment Creation & Maintenance
- **Interpreter Selection:** Choose the base Python version (e.g., 3.10 vs 3.12) during venv creation.
- **Expanded Templates:** Pre-configured environments for FastAPI, Django, Data Science, and AI/LLMs.
- **Auto-Repair:** One-click restoration of broken environments by reinstalling known packages.

### 3. System Utilities
- **Pip Cache Purge:** System-wide cleanup of temporary pip download files.
- **Cleanup Mode:** Visual highlighting of environments not modified in the last 90 days.
- **Workspace Sync:** Individual refresh buttons for workspaces and specific environments.

## 📂 Updated Data Schema (SQLite)

- **`workspaces`**: Persists root paths.
- **`venvs`**: Cache of scanned environments including `status`, `issue`, and `last_modified` (v2 migration).
- **`scripts`**: User-defined Python automation snippets (v3 migration).

## ⚠️ Maintenance Notes

- **Rust Version:** Pinned to **1.85.1** dependencies.
- **Capabilities (Permissions):** Requires `sql:allow-load`, `sql:allow-execute`, `sql:allow-select`, and `fs:default`.
- **Linux Compatibility:** Terminal fallback uses `xdg-open` if no standard emulator is found.

## ⌨️ Common Operations

| Action | Result |
| :--- | :--- |
| **Build** | Creates venv + installs template packages |
| **Repair** | Re-creates venv & restores packages |
| **Purge Cache** | Clears `~/.cache/pip` |
| **Compare** | Diff analysis between two venvs |

---
*Documentation updated on March 1, 2026.*
