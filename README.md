# PyManager Orchestrator 🐍

A professional, high-level Python Virtual Environment Orchestrator built with **Tauri v2**, **Rust**, **React 19**, and **Tailwind CSS v4**.

PyManager has evolved from a simple manager into a complete development lifecycle orchestrator, solving the "venv hell" with visual intelligence and automated hygiene.

---

## ✨ New & Advanced Features

### 🚀 Hybrid Management Engine
- **pip + uv Dual-Core:** Native support for the [uv](https://github.com/astral-sh/uv) manager. Create environments and install templates up to **100x faster**.
- **Auto-Discovery:** Automatically detects if an environment uses `pip` or `uv` and uses the correct motor for all operations.

### 🔍 Global Intelligence & Discovery
- **Command Palette (Ctrl+K):** Instant navigation. Search for environments or paths across all your workspaces from anywhere in the app.
- **Global Hygiene:** A specialized auditor that syncs your database with the physical disk, allowing you to **Prune** dead links and **Adopt** orphan environments.

### 🌳 Dependency Visualizer
- **Interactive Graph:** Visualize your libraries as a visual map using **React Flow**. Understand complex relationships with zoom and pan controls.
- **Lazy-Loaded Tree View:** Explore hierarchical dependencies without performance lag, even in massive environments like Anaconda.

### 🛡️ Security & Health
- **Security Audit:** Integrated scan for known vulnerabilities (CVEs) using the PyPA Advisory Database.
- **Health Diagnostics:** One-click consistency checks (`pip check`) and outdated package detection.

### 🐳 Deployment & Automation
- **Docker Generator:** Optimized `Dockerfile` and `docker-compose.yml` generation based on your environment's Python version and packages.
- **Script Runner:** Save and execute automation snippets directly within the virtual environment context.

---

## 🛠️ Tech Stack

- **Framework:** [Tauri v2](https://tauri.app/)
- **Backend:** [Rust](https://www.rust-lang.org/) (Performance & OS Bridge)
- **Frontend:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Graph Engine:** [React Flow](https://reactflow.dev/)
- **Database:** [SQLite](https://www.sqlite.org/) via `tauri-plugin-sql`
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)

---

## 🚀 Getting Started

### Prerequisites
- [Rust](https://rustup.rs/) (1.85.1+)
- [Node.js](https://nodejs.org/) (v20+)
- [uv](https://github.com/astral-sh/uv) (Optional but highly recommended for speed)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/marquesantero/pymanager.git
   cd pymanager
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run tauri dev
   ```

---

## 🏗️ Build
To build the production-ready application for your OS:
```bash
npm run tauri build
```

---
*Created by [Marques Antero](https://github.com/marquesantero). Python development, orchestrated.*
