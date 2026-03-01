# PyManager 🐍

A professional, high-level, multi-platform Python Virtual Environment Manager built with **Tauri v2**, **Rust**, **React 19**, and **Tailwind CSS v4**.

PyManager solves the common "venv hell" by providing a centralized dashboard to scan, health-check, and optimize your Python development environments across multiple workspaces.

## ✨ Key Features

- **🚀 Multi-Workspace Scanning:** Recursively discover `.venv` and custom environments across multiple project directories.
- **🔬 Python Dev Studio:** A dedicated management interface for each environment.
- **📊 Package Size Explorer:** Visualize the disk impact of each installed library in MB.
- **🐳 Docker Generator:** One-click generation of optimized `Dockerfile` and `docker-compose.yml` for your specific environment version and packages.
- **🛠️ Automation Runner:** Save and execute Python automation scripts directly within the environment context.
- **🩹 Health Diagnostics:** Integrated `pip check` and outdated package detection.
- **📝 Config Editor:** Side-by-side `.env` editor and `pyvenv.cfg` viewer.
- **📦 Custom Templates:** Save any existing environment as a template to bootstrap new projects instantly.
- **💾 SQLite Persistence:** Your workspaces, environment cache, and scripts are stored locally using SQLite.

## 🛠️ Tech Stack

- **Framework:** [Tauri v2](https://tauri.app/) (Desktop bridge)
- **Backend:** [Rust](https://www.rust-lang.org/) (File system performance & system commands)
- **Frontend:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) (Modern Flat Design)
- **Database:** [SQLite](https://www.sqlite.org/) via `tauri-plugin-sql`
- **Icons:** [Lucide React](https://lucide.dev/)

## 🚀 Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (1.85.1+)
- [Node.js](https://nodejs.org/) (v20+)
- System Dependencies (for Linux/Tauri build)

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

## 🏗️ Build

To build the production application:
```bash
npm run tauri build
```

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
Created by [Marques Antero](https://github.com/marquesantero)
