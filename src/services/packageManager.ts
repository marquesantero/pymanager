import { invoke } from "@tauri-apps/api/core";
import { VenvInfo } from "../types";

class PackageManagerService {
  /**
   * Instala um pacote usando o motor correto do ambiente
   */
  async install(venv: VenvInfo, pkgName: string): Promise<string> {
    return await invoke("install_dependency", { 
      venvPath: venv.path, 
      package: pkgName, 
      engine: venv.manager_type 
    });
  }

  /**
   * Remove um pacote usando o motor correto do ambiente
   */
  async uninstall(venv: VenvInfo, pkgName: string): Promise<string> {
    return await invoke("uninstall_package", { 
      venvPath: venv.path, 
      package: pkgName, 
      engine: venv.manager_type 
    });
  }

  /**
   * Atualiza um pacote usando o motor correto do ambiente
   */
  async update(venv: VenvInfo, pkgName: string): Promise<string> {
    return await invoke("update_package", { 
      venvPath: venv.path, 
      package: pkgName, 
      engine: venv.manager_type 
    });
  }

  /**
   * Obtém a árvore de dependências do ambiente
   */
  async getDependencyTree(venv: VenvInfo): Promise<any> {
    return await invoke("get_dependency_tree", { 
      venvPath: venv.path, 
      engine: venv.manager_type 
    });
  }

  /**
   * Realiza auditoria de segurança (vulnerabilidades)
   */
  async auditSecurity(venvPath: string): Promise<any> {
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
