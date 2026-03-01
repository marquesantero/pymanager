import Database from "@tauri-apps/plugin-sql";
import { VenvInfo, Script, Template } from "../types";

class DatabaseService {
  private db: Database | null = null;

  async init() {
    if (!this.db) {
      this.db = await Database.load("sqlite:py-manager.db");
    }
    return this.db;
  }

  // --- Workspaces ---
  async getWorkspaces(): Promise<string[]> {
    const db = await this.init();
    const rows: { path: string }[] = await db.select("SELECT path FROM workspaces");
    return rows.map(r => r.path);
  }

  async addWorkspace(path: string) {
    const db = await this.init();
    await db.execute("INSERT OR IGNORE INTO workspaces (path) VALUES (?)", [path]);
  }

  async removeWorkspace(path: string) {
    const db = await this.init();
    await db.execute("DELETE FROM workspaces WHERE path = ?", [path]);
    await db.execute("DELETE FROM venvs WHERE workspace_path = ?", [path]);
  }

  // --- Venvs Cache ---
  async getCachedVenvs(): Promise<Record<string, VenvInfo[]>> {
    const db = await this.init();
    const rows: any[] = await db.select("SELECT * FROM venvs");
    const cache: Record<string, VenvInfo[]> = {};
    
    rows.forEach(r => {
      if (!cache[r.workspace_path]) cache[r.workspace_path] = [];
      cache[r.workspace_path].push({
        name: r.name,
        path: r.path,
        version: r.version,
        status: r.status,
        issue: r.issue,
        last_modified: r.last_modified
      });
    });
    return cache;
  }

  async saveVenvCache(workspacePath: string, venvs: VenvInfo[]) {
    const db = await this.init();
    await db.execute("DELETE FROM venvs WHERE workspace_path = ?", [workspacePath]);
    for (const v of venvs) {
      await db.execute(
        "INSERT OR IGNORE INTO venvs (workspace_path, name, path, version, status, issue, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [workspacePath, v.name, v.path, v.version, v.status, v.issue || null, v.last_modified]
      );
    }
  }

  async updateSingleVenv(path: string, updated: VenvInfo) {
    const db = await this.init();
    await db.execute(
      "UPDATE venvs SET version = ?, status = ?, issue = ?, last_modified = ? WHERE path = ?",
      [updated.version, updated.status, updated.issue || null, updated.last_modified, path]
    );
  }

  // --- Scripts ---
  async getScripts(venvPath: string): Promise<Script[]> {
    const db = await this.init();
    return await db.select("SELECT * FROM scripts WHERE venv_path = ?", [venvPath]);
  }

  async addScript(venvPath: string, name: string, command: string) {
    const db = await this.init();
    await db.execute("INSERT INTO scripts (venv_path, name, command) VALUES (?, ?, ?)", [venvPath, name, command]);
  }

  // --- Custom Templates ---
  async getCustomTemplates(): Promise<Template[]> {
    const db = await this.init();
    const rows: any[] = await db.select("SELECT * FROM custom_templates");
    return rows.map(r => ({
        id: `custom_${r.id}`,
        name: r.name,
        pkgs: JSON.parse(r.packages)
    }));
  }

  async saveCustomTemplate(name: string, packages: string[]) {
    const db = await this.init();
    await db.execute("INSERT INTO custom_templates (name, packages) VALUES (?, ?)", [name, JSON.stringify(packages)]);
  }
}

export const dbService = new DatabaseService();
