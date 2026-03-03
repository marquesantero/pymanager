import Database from "@tauri-apps/plugin-sql";
import { VenvInfo, Script, Template } from "../types";

class DatabaseService {
  private db: Database | null = null;
  private initPromise: Promise<Database> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  private async withRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message ?? err).toLowerCase();
        if (!msg.includes("database is locked") && !msg.includes("database locked")) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 120 * (i + 1)));
      }
    }
    throw lastError;
  }

  private async runWrite<T>(op: (db: Database) => Promise<T>): Promise<T> {
    const task = this.writeQueue.then(async () => {
      const db = await this.init();
      return this.withRetry(() => op(db));
    });
    this.writeQueue = task.then(() => undefined, () => undefined);
    return task;
  }

  async init() {
    if (this.db) return this.db;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const db = await Database.load("sqlite:py-manager.db");
        await db.execute("PRAGMA journal_mode = WAL");
        await db.execute("PRAGMA busy_timeout = 10000");
        await db.execute("PRAGMA synchronous = NORMAL");
        this.db = db;
        return db;
      })().finally(() => {
        this.initPromise = null;
      });
    }
    return this.initPromise;
  }

  // --- Workspaces ---
  async getWorkspaces(): Promise<{ path: string, is_default: boolean }[]> {
    const db = await this.init();
    return await db.select("SELECT path, is_default FROM workspaces");
  }

  async addWorkspace(path: string) {
    await this.runWrite((db) =>
      db.execute("INSERT OR IGNORE INTO workspaces (path, is_default) VALUES (?, 0)", [path])
    );
  }

  async setDefaultWorkspace(path: string) {
    await this.runWrite(async (db) => {
      await db.execute("UPDATE workspaces SET is_default = 0");
      await db.execute("UPDATE workspaces SET is_default = 1 WHERE path = ?", [path]);
    });
  }

  // ... (rest of methods)

  async addSingleVenv(workspacePath: string, v: VenvInfo) {
    await this.runWrite((db) =>
      db.execute(
        "INSERT OR REPLACE INTO venvs (workspace_path, name, path, version, status, issue, last_modified, manager_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [workspacePath, v.name, v.path, v.version, v.status, v.issue || null, v.last_modified, v.manager_type]
      )
    );
  }

  async removeWorkspace(path: string) {
    await this.runWrite(async (db) => {
      await db.execute("DELETE FROM workspaces WHERE path = ?", [path]);
      await db.execute("DELETE FROM venvs WHERE workspace_path = ?", [path]);
    });
  }

  async removeVenvByPath(path: string) {
    await this.runWrite((db) => db.execute("DELETE FROM venvs WHERE path = ?", [path]));
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
        last_modified: r.last_modified,
        manager_type: r.manager_type
      });
    });
    return cache;
  }

  async saveVenvCache(workspacePath: string, venvs: VenvInfo[]) {
    await this.runWrite(async (db) => {
      await db.execute("DELETE FROM venvs WHERE workspace_path = ?", [workspacePath]);
      for (const v of venvs) {
        await db.execute(
          "INSERT OR REPLACE INTO venvs (workspace_path, name, path, version, status, issue, last_modified, manager_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [workspacePath, v.name, v.path, v.version, v.status, v.issue || null, v.last_modified, v.manager_type]
        );
      }
    });
  }

  async updateSingleVenv(path: string, updated: VenvInfo) {
    await this.runWrite((db) =>
      db.execute(
        "UPDATE venvs SET version = ?, status = ?, issue = ?, last_modified = ?, manager_type = ? WHERE path = ?",
        [updated.version, updated.status, updated.issue || null, updated.last_modified, updated.manager_type, path]
      )
    );
  }

  // --- Scripts ---
  async getScripts(venvPath: string): Promise<Script[]> {
    const db = await this.init();
    return await db.select("SELECT * FROM scripts WHERE venv_path = ?", [venvPath]);
  }

  async addScript(venvPath: string, name: string, command: string) {
    await this.runWrite((db) =>
      db.execute("INSERT INTO scripts (venv_path, name, command) VALUES (?, ?, ?)", [venvPath, name, command])
    );
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
    await this.runWrite((db) =>
      db.execute("INSERT INTO custom_templates (name, packages) VALUES (?, ?)", [name, JSON.stringify(packages)])
    );
  }
}

export const dbService = new DatabaseService();
