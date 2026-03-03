import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, ask } from "@tauri-apps/plugin-dialog";
import { Terminal, RefreshCcw, Box, Loader2, Package, X, Code2, BookmarkPlus, Globe, Settings, ExternalLink, Trash2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { VenvInfo, VenvDetails, Script, ThemeMode, StatusFilter, StudioTabId, Template } from "./types";
import { PYTHON_TEMPLATES } from "./constants/templates";
import { STATUS_FILTERS, STUDIO_TABS } from "./constants/ui";
import { dbService } from "./services/db";
import {
  useAppInitialization,
  useGlobalSearchShortcut,
  useStudioLoader,
  useThemeAndZoom,
  useWorkspaceOperations
} from "./hooks/useAppController";
import { useToastMessages } from "./hooks/useToastMessages";

import { Sidebar } from "./components/Sidebar";
import { HygieneOverlay } from "./components/HygieneOverlay";
import { CommandPalette } from "./components/CommandPalette";
import { StudioPackages } from "./components/Studio/StudioPackages";
import { StudioAutomation } from "./components/Studio/StudioAutomation";
import { StudioConfig } from "./components/Studio/StudioConfig";
import { StudioDiagnostics } from "./components/Studio/StudioDiagnostics";
import { StudioDeploy } from "./components/Studio/StudioDeploy";

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export default function App() {
  const [workspaces, setWorkspaces] = useState<{ path: string, is_default: boolean }[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState("");
  const [venvCache, setVenvCache] = useState<Record<string, VenvInfo[]>>({});
  const [loading, setLoading] = useState(false);
  const [syncingVenv, setSyncingVenv] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [selectedVenv, setSelectedVenv] = useState<VenvInfo | null>(null);
  const [venvDetails, setVenvDetails] = useState<VenvDetails | null>(null);
  const [studioTab, setStudioTab] = useState<StudioTabId | "deploy">("packages");
  const [pyvenvCfg, setPyvenvCfg] = useState("");
  const [scripts, setScripts] = useState<Script[]>([]);
  const [envContent, setEnvContent] = useState("");
  const [newVenvName, setNewVenvName] = useState("");
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(PYTHON_TEMPLATES[0]);
  const [systemPythons, setSystemPythons] = useState<string[]>([]);
  const [selectedPython, setSelectedPython] = useState("");
  const [availableManagers, setAvailableManagers] = useState({ uv: false, poetry: false, pdm: false });
  const [selectedEngine, setSelectedEngine] = useState<"pip" | "uv">("pip");
  const [isHygieneOpen, setIsHygieneOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { statusText, toasts, pushMessage: setMessage, mountedRef } = useToastMessages();
  useGlobalSearchShortcut(setIsSearchOpen);
  useThemeAndZoom(theme, zoomLevel);
  useAppInitialization({
    setWorkspaces,
    setActiveWorkspace,
    setVenvCache,
    setSystemPythons,
    setSelectedPython,
    setCustomTemplates,
    setAvailableManagers,
    setSelectedEngine,
    setIsInitialLoading
  });
  const { scanWorkspace, syncSingleVenv } = useWorkspaceOperations({
    setLoading,
    setSyncingVenv,
    setMessage,
    setVenvCache
  });
  const openStudio = useStudioLoader({
    mountedRef,
    setSelectedVenv,
    setStudioTab,
    setVenvDetails,
    setScripts,
    setEnvContent,
    setPyvenvCfg
  });

  const filteredVenvs = (venvCache[activeWorkspace] || []).filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) && (statusFilter === "All" || v.status === statusFilter)
  );

  const stats = {
    total: (venvCache[activeWorkspace] || []).length,
    healthy: (venvCache[activeWorkspace] || []).filter(v => v.status === "Healthy").length,
    broken: (venvCache[activeWorkspace] || []).filter(v => v.status === "Broken").length
  };

  if (isInitialLoading) {
    return (
      <div className="h-screen w-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center transition-colors duration-500">
        <div className="relative">
          <div className="p-6 bg-blue-600 rounded-[2rem] text-white shadow-2xl shadow-blue-500/40 animate-bounce">
            <Package size={48} />
          </div>
          <div className="absolute inset-0 bg-blue-400 rounded-[2rem] animate-ping opacity-20"></div>
        </div>
        <div className="mt-10 flex flex-col items-center gap-2">
          <h2 className="text-xl font-black uppercase tracking-[0.3em] text-slate-800 dark:text-white animate-pulse">PyManager</h2>
          <div className="flex items-center gap-3">
            <div className="w-12 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="w-full h-full bg-blue-600 origin-left animate-[loading_1.5s_ease-in-out_infinite]"></div>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Initializing Engine</span>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes loading {
            0% { transform: scaleX(0); }
            50% { transform: scaleX(1); }
            100% { transform: scaleX(0); transform-origin: right; }
          }
        `}} />
      </div>
    );
  }

  return (
    <div id="root-container" className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-50 font-sans overflow-hidden transition-colors duration-200 origin-top-left">
      <Sidebar
        theme={theme} setTheme={setTheme} workspaces={workspaces} activeWorkspace={activeWorkspace}
        setActiveWorkspace={setActiveWorkspace} scanWorkspace={scanWorkspace}
        openHygiene={() => setIsHygieneOpen(true)}
        addWorkspace={async () => {
          const s = await open({ directory: true });
          if (s) {
            const p = Array.isArray(s) ? s[0] : s;
            if (workspaces.some(w => w.path === p)) return;
            await dbService.addWorkspace(p);
            setWorkspaces(prev => (
              prev.some(w => w.path === p) ? prev : [...prev, { path: p, is_default: false }]
            ));
            setActiveWorkspace(p);
            scanWorkspace(p);
          }
        }}
        removeWorkspace={async (wsPath) => {
          if (await ask(`Remove ${wsPath}?`)) {
            await dbService.removeWorkspace(wsPath);
            setWorkspaces(prev => prev.filter(w => w.path !== wsPath));
            setActiveWorkspace(prev => prev === wsPath ? "" : prev);
          }
        }}
        setDefaultWorkspace={async (wsPath) => {
          await dbService.setDefaultWorkspace(wsPath);
          setWorkspaces(prev => prev.map(w => ({ ...w, is_default: w.path === wsPath })));
          setMessage("Default workspace updated.");
        }}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 bg-white dark:bg-slate-950/50 shrink-0 select-none">
          <div className="flex items-center gap-4">
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-4 text-xs w-64 outline-none focus:border-blue-500" placeholder="Search..." />
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-0.5">
              <button onClick={() => setZoomLevel(prev => Math.max(70, prev - 5))} className="px-2 py-1 text-[10px] font-black hover:text-blue-600 transition-colors" title="Decrease Font Size">A-</button>
              <div className="w-px h-3 bg-slate-300 dark:bg-slate-700 mx-1"></div>
              <button onClick={() => setZoomLevel(prev => Math.min(150, prev + 5))} className="px-2 py-1 text-[10px] font-black hover:text-blue-600 transition-colors" title="Increase Font Size">A+</button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
            <span>{stats.total} Total</span> <span className="text-green-600">{stats.healthy} OK</span> <span className="text-red-600">{stats.broken} Broken</span>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
            {STATUS_FILTERS.map(s => (<button key={s} onClick={() => setStatusFilter(s)} className={cn("px-3 py-1 rounded-md text-[10px] font-bold transition-all", statusFilter === s ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500")}>{s}</button>))}
          </div>
        </header>

        <div className="px-8 py-3 bg-white dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2 shrink-0 select-none font-bold">
          <div className="flex items-center gap-3">
            <p className="text-[9px] font-black uppercase text-slate-400">New Env</p>
            <input value={newVenvName} onChange={(e) => setNewVenvName(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-1 text-xs w-64 outline-none focus:border-blue-500" placeholder="Name..." />

            <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-inner">
              <button onClick={() => setSelectedEngine("pip")} className={cn("px-2 py-0.5 rounded-md text-[9px] font-black transition-all", selectedEngine === "pip" ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-400")}>PIP</button>
              {availableManagers.uv && (
                <button onClick={() => setSelectedEngine("uv")} className={cn("px-2 py-0.5 rounded-md text-[9px] font-black transition-all", selectedEngine === "uv" ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-400")}>UV</button>
              )}
            </div>

            <select value={selectedPython} onChange={(e) => setSelectedPython(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1 text-xs text-blue-600">{systemPythons.map(p => <option key={p.split('|')[0]} value={p.split('|')[0]}>{p.split('|')[1]}</option>)}</select>
            <select value={selectedTemplate.id} onChange={(e) => setSelectedTemplate([...PYTHON_TEMPLATES, ...customTemplates].find(t => t.id === e.target.value) || PYTHON_TEMPLATES[0])} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1 text-xs">{[...PYTHON_TEMPLATES, ...customTemplates].map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <button onClick={async () => {
              if (!newVenvName || !activeWorkspace) return;
              setLoading(true);
              try {
                await invoke("create_venv", { path: activeWorkspace, name: newVenvName, pythonBin: selectedPython, engine: selectedEngine });
                for (const pkg of selectedTemplate.pkgs) {
                  await invoke("install_dependency", { venvPath: `${activeWorkspace}/${newVenvName}`, package: pkg, engine: selectedEngine });
                }
                setNewVenvName("");
                scanWorkspace(activeWorkspace);
              } catch (e) {
                setMessage(`Error: ${e}`);
              } finally {
                setLoading(false);
              }
            }} disabled={loading || !newVenvName} className="bg-blue-600 text-white px-4 py-1 rounded-md text-[10px] font-black uppercase shadow-sm active:scale-95 transition-all">{loading ? <Loader2 size={10} className="animate-spin" /> : "Build"}</button>
            {statusText && <p className="text-[9px] font-black text-blue-500 truncate ml-auto uppercase">{statusText}</p>}
          </div>
          {selectedPython && <p className="text-[9px] text-slate-400 font-mono ml-[52px] truncate opacity-70">Binary: {selectedPython}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start pb-20">
          {filteredVenvs.map((v) => (
            <div key={v.path} className={cn("flex flex-col h-fit bg-white dark:bg-slate-900/40 border rounded-xl p-4 shadow-sm", v.status === "Broken" ? "border-red-200 bg-red-50/10 shadow-none" : "border-slate-200 dark:border-slate-800 hover:border-blue-400")}>
              <div className="flex justify-between mb-3 select-none">
                <div className={cn("p-2 rounded-lg shadow-sm", v.status === "Broken" ? "bg-red-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-blue-600")}><Terminal size={16} /></div>
                <div className="flex gap-1">
                  <button onClick={() => syncSingleVenv(v.path)} className={cn("p-1.5 text-slate-400 hover:text-blue-600 transition-all", syncingVenv === v.path && "animate-spin text-blue-600")} title="Sync"><RefreshCcw size={14} /></button>
                  <button onClick={() => invoke("open_in_vscode", { path: v.path })} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-md" title="VS Code"><Code2 size={14} /></button>
                  <button onClick={() => invoke("open_terminal", { path: v.path })} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-md" title="Terminal"><ExternalLink size={14} /></button>
                  <button onClick={() => openStudio(v)} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-md" title="Studio"><Settings size={14} /></button>
                  <button onClick={async () => { if (await ask("Delete environment folder?")) { await invoke("delete_venv", { path: v.path }); scanWorkspace(activeWorkspace); } }} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors border border-transparent hover:border-red-100 rounded-md" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
              <h4 className="font-bold text-xs truncate select-text">{v.name}</h4>
              <p className="text-[10px] text-slate-400 font-mono truncate mt-1 opacity-70 select-text">{v.path}</p>
              <div className="mt-4 flex justify-between items-center text-[9px] font-bold uppercase text-slate-500 select-none">
                <span className={v.status === "Healthy" ? "text-green-600" : "text-red-600"}>{v.status}</span>
                <span className="text-blue-600 font-mono">{v.version.split(" ")[1] || v.version}</span>
              </div>
            </div>
          ))}
        </div>

        {selectedVenv && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-12 transition-all">
            <div className="bg-white dark:bg-slate-900 w-full h-full rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/20 select-none">
                <div className="flex items-center gap-6"><div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg"><Box size={32} /></div><div><h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{selectedVenv.name}</h2><div className="flex items-center gap-2"><p className="text-xs font-mono text-slate-400">{selectedVenv.path}</p><span className="text-[9px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-md font-black uppercase tracking-widest">{selectedVenv.manager_type} Engine</span></div></div></div>
                <div className="flex items-center gap-2">
                  <button onClick={async () => {
                    const n = prompt("Template name:");
                    if (!n) return;
                    try {
                      const details = venvDetails || await invoke<VenvDetails>("get_venv_details", { path: selectedVenv.path });
                      setVenvDetails(details);
                      await dbService.saveCustomTemplate(n, details.packages.map(p => p.split("==")[0]));
                      setCustomTemplates(await dbService.getCustomTemplates());
                      setMessage(`Saved template: ${n}`);
                    } catch (e) { setMessage(`Error: ${e}`); }
                  }} className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-800 text-xs font-black uppercase hover:bg-blue-600 hover:text-white transition-all"><BookmarkPlus size={16} /> Save as Template</button>
                  <button onClick={() => setSelectedVenv(null)} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm"><X size={24} /></button>
                </div>
              </div>
              <div className="flex px-8 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 select-none">
                {[...STUDIO_TABS, { id: "deploy" as const, label: "Deploy", icon: Globe }].map(tab => {
                  const TabIcon = tab.icon;
                  return <button key={tab.id} onClick={() => setStudioTab(tab.id)} className={cn("flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all", studioTab === tab.id ? "border-blue-600 text-blue-600 bg-blue-50/10" : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200")}><TabIcon size={16} /> {tab.label}</button>;
                })}
              </div>
              <div className="flex-1 overflow-y-auto p-10 bg-slate-50 dark:bg-slate-950/10 scrollbar-thin">
                {studioTab === "packages" && <StudioPackages venv={selectedVenv} details={venvDetails} refresh={() => openStudio(selectedVenv)} setMessage={setMessage} />}
                {studioTab === "automation" && <StudioAutomation venv={selectedVenv} scripts={scripts} refreshScripts={() => openStudio(selectedVenv)} setMessage={setMessage} />}
                {studioTab === "config" && <StudioConfig venv={selectedVenv} envContent={envContent} setEnvContent={setEnvContent} pyvenvCfg={pyvenvCfg} setMessage={setMessage} />}
                {studioTab === "diagnostics" && <StudioDiagnostics venv={selectedVenv} />}
                {studioTab === "deploy" && <StudioDeploy venv={selectedVenv} setMessage={setMessage} />}
              </div>
            </div>
          </div>
        )}
      </main>

      {isHygieneOpen && (
        <HygieneOverlay
          workspaces={workspaces.map(w => w.path)}
          onClose={() => setIsHygieneOpen(false)}
          onRefresh={async () => {
            setVenvCache(await dbService.getCachedVenvs());
          }}
          setMessage={setMessage}
        />
      )}

      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        venvCache={venvCache}
        onSelectVenv={openStudio}
      />

      <div className="fixed right-5 bottom-5 z-[120] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              "min-w-[260px] max-w-[420px] text-[11px] font-bold px-4 py-3 rounded-xl border shadow-lg",
              t.tone === "error"
                ? "bg-red-50 border-red-200 text-red-700"
                : t.tone === "success"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-slate-50 border-slate-200 text-slate-700"
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
