import { Dispatch, MutableRefObject, SetStateAction, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { dbService } from "../services/db";
import { ManagerStatus, Script, StudioTabId, Template, ThemeMode, VenvDetails, VenvInfo } from "../types";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

interface AppInitializationConfig {
  setWorkspaces: StateSetter<{ path: string; is_default: boolean }[]>;
  setActiveWorkspace: StateSetter<string>;
  setVenvCache: StateSetter<Record<string, VenvInfo[]>>;
  setSystemPythons: StateSetter<string[]>;
  setSelectedPython: StateSetter<string>;
  setCustomTemplates: StateSetter<Template[]>;
  setAvailableManagers: StateSetter<{ uv: boolean; poetry: boolean; pdm: boolean }>;
  setSelectedEngine: StateSetter<"pip" | "uv">;
  setIsInitialLoading: StateSetter<boolean>;
}

export function useAppInitialization({
  setWorkspaces,
  setActiveWorkspace,
  setVenvCache,
  setSystemPythons,
  setSelectedPython,
  setCustomTemplates,
  setAvailableManagers,
  setSelectedEngine,
  setIsInitialLoading
}: AppInitializationConfig) {
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const ws = await dbService.getWorkspaces();
        if (cancelled) return;
        setWorkspaces(ws);

        if (ws.length > 0) {
          const def = ws.find((w) => w.is_default) || ws[0];
          if (!cancelled) setActiveWorkspace(def.path);
        }

      } catch (err) {
        console.error("BOOT ERR [workspaces]:", err);
      }

      try {
        const cache = await dbService.getCachedVenvs();
        if (!cancelled) setVenvCache(cache);
      } catch (err) {
        console.error("BOOT ERR [cache]:", err);
      }

      try {
        const py = await invoke<string[]>("list_system_pythons");
        if (!cancelled) {
          setSystemPythons(py);
          if (py.length > 0) setSelectedPython(py[0].split("|")[0]);
        }
      } catch (err) {
        console.error("BOOT ERR [python]:", err);
      }

      try {
        const templates = await dbService.getCustomTemplates();
        if (!cancelled) setCustomTemplates(templates);
      } catch (err) {
        console.error("BOOT ERR [templates]:", err);
      }

      try {
        const mgrs = await invoke<ManagerStatus>("check_managers");
        if (!cancelled && mgrs) {
          setAvailableManagers(mgrs);
          if (mgrs.uv) setSelectedEngine("uv");
        }
      } catch (err) {
        console.error("BOOT ERR [managers]:", err);
      } finally {
        if (!cancelled) setIsInitialLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [
    setWorkspaces,
    setActiveWorkspace,
    setVenvCache,
    setSystemPythons,
    setSelectedPython,
    setCustomTemplates,
    setAvailableManagers,
    setSelectedEngine,
    setIsInitialLoading
  ]);
}

export function useGlobalSearchShortcut(setIsSearchOpen: StateSetter<boolean>) {
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, [setIsSearchOpen]);
}

export function useThemeAndZoom(theme: ThemeMode, zoomLevel: number) {
  useEffect(() => {
    const root = window.document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.classList.toggle("dark", theme === "system" ? media.matches : theme === "dark");
    apply();
    if (theme === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
  }, [theme]);

  useEffect(() => {
    const root = document.getElementById("root-container");
    if (root) {
      const scale = Math.max(0.5, zoomLevel / 100);
      root.style.transformOrigin = "top left";
      root.style.transform = `scale(${scale})`;
      root.style.width = `${100 / scale}%`;
      root.style.height = `${100 / scale}%`;
    }

    return () => {
      const rootEl = document.getElementById("root-container");
      if (!rootEl) return;
      rootEl.style.transform = "";
      rootEl.style.transformOrigin = "";
      rootEl.style.width = "";
      rootEl.style.height = "";
    };
  }, [zoomLevel]);
}

interface WorkspaceOpsConfig {
  setLoading: StateSetter<boolean>;
  setSyncingVenv: StateSetter<string | null>;
  setMessage: (msg: string) => void;
  setVenvCache: StateSetter<Record<string, VenvInfo[]>>;
}

export function useWorkspaceOperations({
  setLoading,
  setSyncingVenv,
  setMessage,
  setVenvCache
}: WorkspaceOpsConfig) {
  const scanInFlightRef = useRef<Map<string, Promise<void>>>(new Map());

  const scanWorkspace = useCallback(async (workspacePath: string) => {
    if (!workspacePath) return;
    const existing = scanInFlightRef.current.get(workspacePath);
    if (existing) return existing;

    const task = (async () => {
    setLoading(true);
    setMessage("Scanning...");

    try {
      const res: VenvInfo[] = await invoke("list_venvs", { basePath: workspacePath });
      await dbService.saveVenvCache(workspacePath, res);
      setVenvCache((prev) => ({ ...prev, [workspacePath]: res }));
      setMessage(`${res.length} envs found.`);
    } catch (err) {
      setMessage(`Error: ${err}`);
    } finally {
      setLoading(false);
      scanInFlightRef.current.delete(workspacePath);
    }
    })();

    scanInFlightRef.current.set(workspacePath, task);
    return task;
  }, [setLoading, setMessage, setVenvCache]);

  const syncSingleVenv = useCallback(async (venvPath: string) => {
    setSyncingVenv(venvPath);
    try {
      const updated: VenvInfo = await invoke("scan_venv", { path: venvPath });
      await dbService.updateSingleVenv(venvPath, updated);
      setVenvCache((prev) => {
        const wsKey = Object.keys(prev).find((ws) => prev[ws].some((v) => v.path === venvPath));
        if (!wsKey) return prev;
        return { ...prev, [wsKey]: prev[wsKey].map((v) => (v.path === venvPath ? updated : v)) };
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSyncingVenv(null);
    }
  }, [setSyncingVenv, setVenvCache]);

  return { scanWorkspace, syncSingleVenv };
}

interface WorkspaceCrudActionsConfig {
  workspaces: { path: string; is_default: boolean }[];
  setWorkspaces: StateSetter<{ path: string; is_default: boolean }[]>;
  setActiveWorkspace: StateSetter<string>;
  setMessage: (msg: string) => void;
  scanWorkspace: (workspacePath: string) => Promise<void>;
}

export function useWorkspaceCrudActions({
  workspaces,
  setWorkspaces,
  setActiveWorkspace,
  setMessage,
  scanWorkspace
}: WorkspaceCrudActionsConfig) {
  const addWorkspace = useCallback(async () => {
    const selected = await open({ directory: true });
    if (!selected) return;
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (workspaces.some((w) => w.path === path)) return;

    await dbService.addWorkspace(path);
    setWorkspaces((prev) => (prev.some((w) => w.path === path) ? prev : [...prev, { path, is_default: false }]));
    setActiveWorkspace(path);
    await scanWorkspace(path);
  }, [workspaces, setWorkspaces, setActiveWorkspace, scanWorkspace]);

  const removeWorkspace = useCallback(async (workspacePath: string) => {
    if (!(await ask(`Remove ${workspacePath}?`))) return;
    await dbService.removeWorkspace(workspacePath);
    setWorkspaces((prev) => prev.filter((w) => w.path !== workspacePath));
    setActiveWorkspace((prev) => (prev === workspacePath ? "" : prev));
  }, [setWorkspaces, setActiveWorkspace]);

  const setDefaultWorkspace = useCallback(async (workspacePath: string) => {
    await dbService.setDefaultWorkspace(workspacePath);
    setWorkspaces((prev) => prev.map((w) => ({ ...w, is_default: w.path === workspacePath })));
    setMessage("Default workspace updated.");
  }, [setWorkspaces, setMessage]);

  return { addWorkspace, removeWorkspace, setDefaultWorkspace };
}

interface VenvCreationConfig {
  activeWorkspace: string;
  newVenvName: string;
  selectedPython: string;
  selectedEngine: "pip" | "uv";
  selectedTemplate: Template;
  setLoading: StateSetter<boolean>;
  setNewVenvName: StateSetter<string>;
  setMessage: (msg: string) => void;
  scanWorkspace: (workspacePath: string) => Promise<void>;
}

interface VenvSetupResult {
  venv_path: string;
  installed: string[];
}

export function useVenvCreation({
  activeWorkspace,
  newVenvName,
  selectedPython,
  selectedEngine,
  selectedTemplate,
  setLoading,
  setNewVenvName,
  setMessage,
  scanWorkspace
}: VenvCreationConfig) {
  return useCallback(async () => {
    if (!newVenvName || !activeWorkspace) return;
    setLoading(true);
    setMessage(`Building ${newVenvName}...`);
    try {
      const result = await invoke<VenvSetupResult>("create_venv_with_template", {
        path: activeWorkspace,
        name: newVenvName,
        pythonBin: selectedPython,
        engine: selectedEngine,
        packages: selectedTemplate.pkgs
      });
      setNewVenvName("");
      await scanWorkspace(activeWorkspace);
      setMessage(`Built ${result.venv_path} (${result.installed.length} packages).`);
    } catch (err) {
      setMessage(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [
    newVenvName,
    activeWorkspace,
    selectedPython,
    selectedEngine,
    selectedTemplate,
    setLoading,
    setNewVenvName,
    setMessage,
    scanWorkspace
  ]);
}

interface StudioLoaderConfig {
  mountedRef: MutableRefObject<boolean>;
  setSelectedVenv: StateSetter<VenvInfo | null>;
  setStudioTab: StateSetter<StudioTabId | "deploy">;
  setVenvDetails: StateSetter<VenvDetails | null>;
  setScripts: StateSetter<Script[]>;
  setEnvContent: StateSetter<string>;
  setPyvenvCfg: StateSetter<string>;
}

interface VenvDeletionConfig {
  activeWorkspace: string;
  scanWorkspace: (workspacePath: string) => Promise<void>;
  setMessage: (msg: string) => void;
}

export function useVenvDeletion({ activeWorkspace, scanWorkspace, setMessage }: VenvDeletionConfig) {
  return useCallback(async (venvPath: string) => {
    if (!(await ask("Delete environment folder?"))) return;
    try {
      await invoke("delete_venv", { path: venvPath });
      await scanWorkspace(activeWorkspace);
    } catch (err) {
      setMessage(`Error: ${err}`);
    }
  }, [activeWorkspace, scanWorkspace, setMessage]);
}

interface SaveTemplateConfig {
  selectedVenv: VenvInfo | null;
  venvDetails: VenvDetails | null;
  setVenvDetails: StateSetter<VenvDetails | null>;
  setCustomTemplates: StateSetter<Template[]>;
  setMessage: (msg: string) => void;
}

export function useSaveTemplate({
  selectedVenv,
  venvDetails,
  setVenvDetails,
  setCustomTemplates,
  setMessage
}: SaveTemplateConfig) {
  return useCallback(async () => {
    const templateName = prompt("Template name:");
    if (!templateName || !selectedVenv) return;
    try {
      const details = venvDetails || await invoke<VenvDetails>("get_venv_details", { path: selectedVenv.path });
      setVenvDetails(details);
      await dbService.saveCustomTemplate(templateName, details.packages.map((p) => p.split("==")[0]));
      setCustomTemplates(await dbService.getCustomTemplates());
      setMessage(`Saved template: ${templateName}`);
    } catch (err) {
      setMessage(`Error: ${err}`);
    }
  }, [selectedVenv, venvDetails, setVenvDetails, setCustomTemplates, setMessage]);
}

export function useStudioLoader({
  mountedRef,
  setSelectedVenv,
  setStudioTab,
  setVenvDetails,
  setScripts,
  setEnvContent,
  setPyvenvCfg
}: StudioLoaderConfig) {
  const studioLoadIdRef = useRef(0);

  return useCallback(async (venv: VenvInfo) => {
    const loadId = studioLoadIdRef.current + 1;
    studioLoadIdRef.current = loadId;

    setSelectedVenv(venv);
    setStudioTab("packages");
    setVenvDetails(null);

    try {
      dbService.getScripts(venv.path).then((items) => {
        if (!mountedRef.current || studioLoadIdRef.current !== loadId) return;
        setScripts(items);
      });

      invoke<string>("read_env_file", { venvPath: venv.path })
        .then((env) => {
          if (!mountedRef.current || studioLoadIdRef.current !== loadId) return;
          setEnvContent(env);
        })
        .catch((err) => console.error("Env load error:", err));

      invoke<string>("get_pyvenv_cfg", { venvPath: venv.path })
        .then((cfg) => {
          if (!mountedRef.current || studioLoadIdRef.current !== loadId) return;
          setPyvenvCfg(cfg);
        })
        .catch((err) => console.error("pyvenv.cfg load error:", err));
    } catch (err) {
      console.error("BG Load Error:", err);
    }
  }, [mountedRef, setSelectedVenv, setStudioTab, setVenvDetails, setScripts, setEnvContent, setPyvenvCfg]);
}
