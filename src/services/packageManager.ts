import { invoke } from "@tauri-apps/api/core";
import { VenvInfo } from "../types";

class PackageManagerService {
  private dependencyTreeCache = new Map<string, { data: unknown; ts: number }>();
  private dependencyTreeInFlight = new Map<string, Promise<unknown>>();
  private static readonly TREE_CACHE_TTL_MS = 60_000;

  private treeCacheKey(venv: VenvInfo): string {
    return `${venv.path}::${venv.manager_type}::${venv.last_modified}`;
  }

  private invalidateDependencyTreeCacheByPath(venvPath: string) {
    for (const key of this.dependencyTreeCache.keys()) {
      if (key.startsWith(`${venvPath}::`)) {
        this.dependencyTreeCache.delete(key);
      }
    }
    for (const key of this.dependencyTreeInFlight.keys()) {
      if (key.startsWith(`${venvPath}::`)) {
        this.dependencyTreeInFlight.delete(key);
      }
    }
  }

  /**
   * Instala um pacote usando o motor correto do ambiente
   */
  async install(venv: VenvInfo, pkgName: string): Promise<string> {
    const result = await invoke<string>("install_dependency", { 
      venvPath: venv.path, 
      package: pkgName, 
      engine: venv.manager_type 
    });
    this.invalidateDependencyTreeCacheByPath(venv.path);
    return result;
  }

  /**
   * Remove um pacote usando o motor correto do ambiente
   */
  async uninstall(venv: VenvInfo, pkgName: string): Promise<string> {
    const result = await invoke<string>("uninstall_package", { 
      venvPath: venv.path, 
      package: pkgName, 
      engine: venv.manager_type 
    });
    this.invalidateDependencyTreeCacheByPath(venv.path);
    return result;
  }

  /**
   * Atualiza um pacote usando o motor correto do ambiente
   */
  async update(venv: VenvInfo, pkgName: string): Promise<string> {
    const result = await invoke<string>("update_package", { 
      venvPath: venv.path, 
      package: pkgName, 
      engine: venv.manager_type 
    });
    this.invalidateDependencyTreeCacheByPath(venv.path);
    return result;
  }

  /**
   * Obtém a árvore de dependências do ambiente
   */
  async getDependencyTree(venv: VenvInfo, options?: { force?: boolean }): Promise<unknown> {
    const force = options?.force === true;
    const key = this.treeCacheKey(venv);
    const now = Date.now();
    const cached = this.dependencyTreeCache.get(key);

    if (!force && cached && now - cached.ts < PackageManagerService.TREE_CACHE_TTL_MS) {
      return cached.data;
    }

    const inFlight = this.dependencyTreeInFlight.get(key);
    if (!force && inFlight) {
      return inFlight;
    }

    const request = invoke("get_dependency_tree", {
      venvPath: venv.path,
      engine: venv.manager_type
    }).then((data) => {
      this.dependencyTreeCache.set(key, { data, ts: Date.now() });
      this.dependencyTreeInFlight.delete(key);
      return data;
    }).catch((err) => {
      this.dependencyTreeInFlight.delete(key);
      throw err;
    });

    this.dependencyTreeInFlight.set(key, request);
    return request;
  }

  /**
   * Realiza auditoria de segurança (vulnerabilidades)
   */
  async auditSecurity(venvPath: string): Promise<unknown> {
    return await invoke("audit_security", { venvPath });
  }

  /**
   * Exporta os requisitos (sempre gera requirements.txt para compatibilidade)
   */
  async exportRequirements(venvPath: string): Promise<string> {
    return await invoke("export_requirements", { venvPath });
  }
}

export const packageService = new PackageManagerService();
