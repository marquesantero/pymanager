# 🐍 PyManager - Documentation

PyManager is a professional, high-level cross-platform Python Virtual Environment Manager built with **Tauri v2**, **Rust**, **React**, **TypeScript**, and **Tailwind CSS v4**.

## 🏗️ Architecture

### Frontend (React + TS + Tailwind v4)
- **Framework:** React 19 with Vite.
- **Styling:** Tailwind CSS v4 using a flat, high-contrast design.
- **State Management:** React Hooks (`useState`, `useEffect`) with a SQLite persistent layer.
- **Icons:** Lucide React.

### Backend (Rust)
- **Tauri v2:** Provides native OS capabilities and bridge between JS and Rust.
- **Database:** SQLite (via `tauri-plugin-sql`) for persisting workspaces, venvs cache, and custom scripts.
- **File System:** `walkdir` for deep recursive scanning and `fs_extra` for disk usage calculations and cloning.
- **Process Execution:** `std::process::Command` for executing Python, pip, and system terminals.

## 🚀 Core Features

1.  **Multi-Workspace Management:** Add multiple root folders. Each is scanned recursively for virtual environments.
2.  **Health Diagnostics:** Automatically identifies "Broken" environments (missing binaries, moved base interpreter, or corrupted files).
3.  **Smart Templates:** Create new venvs with pre-installed packages for FastAPI, Django, Data Science, or GenAI.
4.  **Pro Tools:**
    *   **Script Runner:** Save and execute Python snippets inside specific venvs.
    *   **Env Editor:** Edit `.env` files directly within the project root.
    *   **Environment Comparator:** Compare installed packages between two different venvs.
    *   **Cleanup Mode:** Identifies environments older than 90 days to save disk space.
5.  **Native Integration:**
    *   Open terminal in the venv path (supports Gnome, Konsole, Xfce, etc.).
    *   Open project root in VS Code.
    *   Persistent data in SQLite.

## 🛠️ Tech Stack Dependencies

### Rust (src-tauri/Cargo.toml)
- `tauri = "2.0.0"`
- `tauri-plugin-sql = { version = "2", features = ["sqlite"] }`
- `walkdir = "2.5.0"`
- `fs_extra = "1.3.0"`
- `serde/serde_json` for data serialization.

### Node.js (package.json)
- `@tauri-apps/api`: Bridge to Rust commands.
- `@tauri-apps/plugin-sql`: Database interaction.
- `tailwindcss v4`: Modern CSS engine.
- `lucide-react`: UI Icons.

## 📂 Project Structure

```text
├── src/                # Frontend React code
│   ├── App.tsx         # Main application logic & UI
│   ├── index.css       # Tailwind v4 config & Global styles
│   └── main.tsx        # React entry point
├── src-tauri/          # Backend Rust code
│   ├── src/
│   │   ├── lib.rs      # Command definitions & Database migrations
│   │   └── main.rs     # Tauri entry point
│   ├── capabilities/   # Permissions (SQL, FS, Dialog)
│   └── Cargo.toml      # Rust dependencies
├── package.json        # Frontend dependencies
└── GEMINI.md           # This documentation
```

## 🔐 Permissions (Capabilities)

Crucial for Tauri v2 stability. The following are enabled in `default.json`:
- `sql:default`, `sql:allow-load`, `sql:allow-execute`, `sql:allow-select`
- `fs:default`
- `dialog:default`
- `opener:default`

## ⚠️ Known Constraints & Maintenance

- **Rust Version:** Optimized for Rust **1.85.1** (pinned dependencies in `Cargo.toml`). Do not upgrade crates without checking MSRV.
- **Linux Terminals:** The app tries a prioritized list of terminal emulators. If none are found, it falls back to `xdg-open`.
- **Database migrations:** Version 1 (Initial), Version 2 (last_modified), Version 3 (scripts).

## ⌨️ Development Commands

```bash
# Start development environment
npm run tauri dev

# Build for production
npm run tauri build
```

---
*Documentation generated on March 1, 2026.*
