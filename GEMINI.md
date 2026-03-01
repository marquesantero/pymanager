# 🐍 PyManager - Documentation (v2.1 Refactor)

PyManager has reached a new level of architectural maturity. This documentation covers the latest refactoring towards best engineering practices and specialized diagnostic tools.

## 🏗️ Architectural Evolution (Clean Architecture)

### Service Layer Implementation
- **Data Abstraction (`src/services/db.ts`):** All SQL queries have been removed from the UI components. The application now uses a dedicated `DatabaseService` class to handle persistence, improving maintainability and testability.
- **Type Safety:** Centralized interfaces in `src/types/index.ts` ensure consistent data structures across JS and Rust.
- **Constants Separation:** UI configurations and environment templates are moved to `src/constants/` for easy expansion without touching logic.

### UI/UX Refinements
- **Workspace Precision:** Sidebar actions (Sync/Delete) are now discrete circular buttons perfectly aligned to the right of the workspace name.
- **Dev Studio (Overlay):** A full-screen management interface providing deep analysis, package manipulation (Update/Uninstall), and script automation.
- **Improved Contrast:** Theme-aware design with high-legibility cards and persistent actions.

## 🚀 Professional Feature Set

### 1. Python Dev Studio
- **Package Intelligence:** Real-time checking for dependency conflicts (`pip check`) and outdated libraries.
- **Individual Package Management:** Upgrade or Uninstall libraries directly from the Studio interface.
- **Script Runner:** Save and execute Python automation snippets within the specific environment.
- **Config Management:** Direct editing of project-level `.env` files.

### 2. Environment Creation & Maintenance
- **System Python Discovery:** Automatically lists versioned interpreters (3.8 - 3.14) available on the host OS.
- **Advanced Templates:** Pre-defined environments for FastAPI, Django, Data Science, and AI.
- **Hidden Dir Awareness:** Enhanced scanning logic that specifically allows `.venv` folders while ignoring other hidden system directories.

## 📂 Updated Project Structure

```text
├── src/
│   ├── services/       # Database & API abstraction layers
│   ├── types/          # Centralized TS interfaces
│   ├── constants/      # App configurations & Python templates
│   ├── App.tsx         # Pure UI Logic (consuming services)
│   └── index.css       # Tailwind v4 configuration
├── src-tauri/          # Backend Rust Core
└── GEMINI.md           # This documentation
```

## 🔐 Database & Permissions

- **SQLite Engine:** Uses `tauri-plugin-sql` with the standard `?` placeholder syntax for all operations.
- **Versioned Migrations:**
  - v1: Initial schema.
  - v2: Added `last_modified` tracking.
  - v3: Added `scripts` table for automations.

---
*Documentation updated on March 1, 2026.*
