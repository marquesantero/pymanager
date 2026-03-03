import { Dispatch, MutableRefObject, SetStateAction, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
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

        const cache = await dbService.getCachedVenvs();
        if (!cancelled) setVenvCache(cache);

        const py = await invoke<string[]>("list_system_pythons");
        if (!cancelled) {
          setSystemPythons(py);
          if (py.length > 0) setSelectedPython(py[0].split("|")[0]);
        }

        const templates = await dbService.getCustomTemplates();
        if (!cancelled) setCustomTemplates(templates);

        const mgrs = await invoke<ManagerStatus>("check_managers");
        if (!cancelled && mgrs) {
          setAvailableManagers(mgrs);
          if (mgrs.uv) setSelectedEngine("uv");
        }
      } catch (err) {
        console.error("BOOT ERR:", err);
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
      root.style.zoom = `${zoomLevel}%`;
    }
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
  const scanWorkspace = useCallback(async (workspacePath: string) => {
    if (!workspacePath) return;
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
    }
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

interface StudioLoaderConfig {
  mountedRef: MutableRefObject<boolean>;
  setSelectedVenv: StateSetter<VenvInfo | null>;
  setStudioTab: StateSetter<StudioTabId | "deploy">;
  setVenvDetails: StateSetter<VenvDetails | null>;
  setScripts: StateSetter<Script[]>;
  setEnvContent: StateSetter<string>;
  setPyvenvCfg: StateSetter<string>;
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
