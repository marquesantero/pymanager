import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, ask } from "@tauri-apps/plugin-dialog";
import { 
  Plus, Folder, Trash2, Terminal, RefreshCcw, Search, 
  Box, ChevronRight, Info, Download, Loader2, Copy, 
  Layers, Globe, Activity, Cpu, Package, X, List, AlertTriangle, CheckCircle2,
  HardDrive, ExternalLink, Code2, Wrench, Upload, SplitSquareHorizontal, Clock, Play, FileText, Save, ArrowUpCircle, ShieldCheck, Settings, BookmarkPlus
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Internal Assets, Config & Services
import { VenvInfo, VenvDetails, OutdatedPackage, Script, ThemeMode, StatusFilter, StudioTabId, Template } from "./types";
import { PYTHON_TEMPLATES } from "./constants/templates";
import { THEME_OPTIONS, STATUS_FILTERS, STUDIO_TABS } from "./constants/ui";
import { dbService } from "./services/db";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function App() {
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState("");
  const [venvCache, setVenvCache] = useState<Record<string, VenvInfo[]>>({});
  const [loading, setLoading] = useState(false);
  const [syncingVenv, setSyncingVenv] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [message, setMessage] = useState("");
  
  // Studio States
  const [selectedVenv, setSelectedVenv] = useState<VenvInfo | null>(null);
  const [venvDetails, setVenvDetails] = useState<VenvDetails | null>(null);
  const [studioTab, setStudioTab] = useState<StudioTabId>("packages");
  const [healthReport, setHealthHealthReport] = useState<string>("");
  const [outdatedPkgs, setOutdatedPkgs] = useState<OutdatedPackage[]>([]);
  const [pyvenvCfg, setPyvenvCfg] = useState("");

  const [newVenvName, setNewVenvName] = useState("");
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(PYTHON_TEMPLATES[0]);
  const [systemPythons, setSystemPythons] = useState<string[]>([]);
  const [selectedPython, setSelectedPython] = useState("");

  const [scripts, setScripts] = useState<Script[]>([]);
  const [envContent, setEnvContent] = useState("");
  const [scriptInput, setScriptInput] = useState({ name: "", command: "" });

  const [cleanupMode, setCleanupMode] = useState(false);

  // --- Initial Data Load ---
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const ws = await dbService.getWorkspaces();
        setWorkspaces(ws);
        if (ws.length > 0) setActiveWorkspace(ws[0]);

        const cache = await dbService.getCachedVenvs();
        setVenvCache(cache);

        const pythons: string[] = await invoke("list_system_pythons");
        setSystemPythons(pythons);
        if (pythons.length > 0) setSelectedPython(pythons[0].split('|')[0]);

        const custom = await dbService.getCustomTemplates();
        setCustomTemplates(custom);
      } catch (err) { console.error(err); }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      if (theme === "system") root.classList.toggle("dark", mediaQuery.matches);
      else root.classList.toggle("dark", theme === "dark");
    };
    applyTheme();
    if (theme === "system") {
      mediaQuery.addEventListener("change", applyTheme);
      return () => mediaQuery.removeEventListener("change", applyTheme);
    }
  }, [theme]);

  // --- Core Operations ---
  const scanWorkspace = async (path: string) => {
    setLoading(true);
    setMessage(`Scanning ${path}...`);
    try {
      const result: VenvInfo[] = await invoke("list_venvs", { basePath: path });
      await dbService.saveVenvCache(path, result);
      setVenvCache(prev => ({ ...prev, [path]: result }));
      setMessage(`Found ${result.length} environments.`);
    } catch (error) { setMessage(`Error: ${error}`); } 
    finally { setLoading(false); }
  };

  const createVenv = async () => {
    if (!newVenvName || !activeWorkspace) return;
    setLoading(true);
    setMessage(`Building ${newVenvName}...`);
    try {
      await invoke("create_venv", { path: activeWorkspace, name: newVenvName, pythonBin: selectedPython });
      const fullPath = `${activeWorkspace}/${newVenvName}`;
      for (const pkg of selectedTemplate.pkgs) { await invoke("install_dependency", { venvPath: fullPath, package: pkg }); }
      setNewVenvName("");
      scanWorkspace(activeWorkspace);
    } catch (err) { setMessage(`Failed: ${err}`); }
    finally { setLoading(false); }
  };

  const openStudio = async (venv: VenvInfo) => {
    setSelectedVenv(venv);
    setLoading(true);
    setStudioTab("packages");
    setHealthHealthReport("");
    setOutdatedPkgs([]);
    try {
      const d: VenvDetails = await invoke("get_venv_details", { path: venv.path });
      setVenvDetails(d);
      const scriptRows = await dbService.getScripts(venv.path);
      setScripts(scriptRows);
      const env: string = await invoke("read_env_file", { venvPath: venv.path });
      setEnvContent(env);
      const cfg: string = await invoke("get_pyvenv_cfg", { venvPath: venv.path });
      setPyvenvCfg(cfg);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const saveAsTemplate = async () => {
    if (!selectedVenv || !venvDetails) return;
    const name = prompt("Enter a name for this template:");
    if (name) {
        try {
            const pkgs = venvDetails.packages.map(p => p.split('==')[0]);
            await dbService.saveCustomTemplate(name, pkgs);
            const custom = await dbService.getCustomTemplates();
            setCustomTemplates(custom);
            setMessage(`Template '${name}' saved!`);
        } catch (err) { setMessage(`Error saving template: ${err}`); }
    }
  };

  const runHealthCheck = async () => {
    if (!selectedVenv) return;
    setLoading(true);
    try {
      const report: string = await invoke("check_venv_health", { venvPath: selectedVenv.path });
      setHealthHealthReport(report);
      const outdated: OutdatedPackage[] = await invoke("list_outdated_packages", { venvPath: selectedVenv.path });
      setOutdatedPkgs(outdated);
    } catch (err) { setMessage(`Error: ${err}`); }
    finally { setLoading(false); }
  };

  const syncSingleVenv = async (path: string) => {
    setSyncingVenv(path);
    try {
      const updated: VenvInfo = await invoke("scan_venv", { path });
      await dbService.updateSingleVenv(path, updated);
      setVenvCache(prev => {
        const workspace = Object.keys(prev).find(ws => prev[ws].some(v => v.path === path));
        if (!workspace) return prev;
        return { ...prev, [workspace]: prev[workspace].map(v => v.path === path ? updated : v) };
      });
    } catch (err) { setMessage(`Sync error: ${err}`); }
    finally { setSyncingVenv(null); }
  };

  const uninstallPkg = async (pkg: string) => {
    if (!selectedVenv) return;
    if (await ask(`Uninstall ${pkg}?`)) {
      try {
        await invoke("uninstall_package", { venvPath: selectedVenv.path, package: pkg.split('==')[0] });
        const d: VenvDetails = await invoke("get_venv_details", { path: selectedVenv.path });
        setVenvDetails(d);
        setMessage(`Uninstalled ${pkg}`);
      } catch (err) { setMessage(`Error: ${err}`); }
    }
  };

  const filteredVenvs = (venvCache[activeWorkspace] || []).filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = { 
    total: (venvCache[activeWorkspace] || []).length, 
    healthy: (venvCache[activeWorkspace] || []).filter(v => v.status === "Healthy").length, 
    broken: (venvCache[activeWorkspace] || []).filter(v => v.status === "Broken").length 
  };

  const allTemplates = [...PYTHON_TEMPLATES, ...customTemplates];

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-50 font-sans overflow-hidden transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900/60 shrink-0 z-10 font-bold select-none">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-500/20"><Package size={20} /></div>
          <h1 className="font-bold text-sm tracking-tight uppercase">PyManager</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto text-[11px]">
          <div className="space-y-2">
            <p className="text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Theme</p>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              {THEME_OPTIONS.map(({ mode, icon: Icon }) => (
                <button key={mode} onClick={() => setTheme(mode)} className={cn("flex-1 flex justify-center py-1.5 rounded-lg transition-all", theme === mode ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-400")}><Icon size={14}/></button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <p className="text-slate-400 dark:text-slate-500 uppercase tracking-widest">Workspaces</p>
              <button onClick={async () => {
                const selected = await open({ directory: true, multiple: false });
                if (selected) {
                  const path = Array.isArray(selected) ? selected[0] : selected;
                  if (!workspaces.includes(path)) { await dbService.addWorkspace(path); setWorkspaces(prev => [...prev, path]); setActiveWorkspace(path); scanWorkspace(path); }
                }
              }} className="text-blue-600 hover:text-blue-700 transition-colors"><Plus size={18}/></button>
            </div>
            <div className="space-y-1.5 pt-2">
              {workspaces.map(ws => (
                <div key={ws} onClick={() => setActiveWorkspace(ws)} className={cn("group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer border transition-all", activeWorkspace === ws ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200 dark:border-blue-800" : "bg-transparent border-transparent text-slate-500 hover:bg-slate-100")}>
                  <div className="flex items-center gap-2 truncate flex-1 mr-2"><Folder size={14} className={activeWorkspace === ws ? "text-blue-600" : "text-slate-400"} /><span className="truncate text-[10px]">{ws.split('/').pop() || ws}</span></div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); scanWorkspace(ws); }} className="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 transition-all shadow-sm"><RefreshCcw size={10}/></button>
                    <button onClick={async (e) => { e.stopPropagation(); if (await ask(`Remove workspace?`)) { await dbService.removeWorkspace(ws); setWorkspaces(workspaces.filter(w => w !== ws)); if (activeWorkspace === ws) setActiveWorkspace(""); } }} className="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 transition-all shadow-sm"><Trash2 size={10}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-950 relative overflow-hidden">
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 bg-white dark:bg-slate-950/50 shrink-0 select-none">
          <div className="flex items-center gap-4">
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-4 text-xs outline-none focus:border-blue-500 w-64 font-bold" placeholder="Search..." />
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest border-l pl-4 border-slate-200 dark:border-slate-800">
                <span>{stats.total} Total</span> <span className="text-green-600">{stats.healthy} OK</span> <span className="text-red-600">{stats.broken} Broken</span>
            </div>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-inner">
            {STATUS_FILTERS.map(s => (<button key={s} onClick={() => setStatusFilter(s)} className={cn("px-3 py-1 rounded-md text-[10px] font-bold transition-all", statusFilter === s ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500")}>{s}</button>))}
          </div>
        </header>

        {/* Create Bar */}
        <div className="px-8 py-3 bg-white dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 shrink-0 select-none">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">New Env</p>
            <input value={newVenvName} onChange={(e) => setNewVenvName(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-1 text-xs w-32 font-bold select-text" placeholder="Name..." />
            <select value={selectedPython} onChange={(e) => setSelectedPython(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 max-w-[150px]">
                {systemPythons.map(p => <option key={p.split('|')[0]} value={p.split('|')[0]}>{p.split('|')[1]} ({p.split('|')[0].split('/').pop()})</option>)}
            </select>
            <select value={selectedTemplate.id} onChange={(e) => setSelectedTemplate(allTemplates.find(t => t.id === e.target.value) || allTemplates[0])} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-400">
                {allTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={createVenv} disabled={loading || !newVenvName} className="bg-blue-600 text-white px-4 py-1 rounded-md text-[10px] font-black uppercase transition-all shadow-sm active:scale-95">{loading ? <Loader2 size={12} className="animate-spin" /> : "Build"}</button>
            {message && <p className="text-[9px] font-black text-blue-500 truncate ml-auto border-l pl-4 border-slate-200 dark:border-slate-800 uppercase tracking-tighter">{message}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start pb-20">
          {filteredVenvs.map((venv) => (
            <div key={venv.path} className={cn("flex flex-col h-fit bg-white dark:bg-slate-900/40 border transition-all rounded-xl p-4 shadow-sm", venv.status === "Broken" ? "border-red-200 bg-red-50/10 shadow-none" : "border-slate-200 dark:border-slate-800 hover:border-blue-400")}>
              <div className="flex justify-between mb-3 select-none">
                <div className={cn("p-2 rounded-lg shadow-sm", venv.status === "Broken" ? "bg-red-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-blue-600")}><Terminal size={16} /></div>
                <div className="flex gap-1">
                  <button onClick={() => syncSingleVenv(venv.path)} className={cn("p-1.5 text-slate-400 hover:text-blue-600 transition-all", syncingVenv === venv.path && "animate-spin text-blue-600")} title="Sync"><RefreshCcw size={14} /></button>
                  <button onClick={() => invoke("open_in_vscode", { path: venv.path })} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-md" title="VS Code"><Code2 size={14} /></button>
                  <button onClick={() => invoke("open_terminal", { path: venv.path })} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-md" title="Terminal"><ExternalLink size={14} /></button>
                  <button onClick={() => openStudio(venv)} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-md" title="Open Studio"><Settings size={14} /></button>
                  <button onClick={async () => { if (await ask(`Delete folder?`)) { await invoke("delete_venv", { path: venv.path }); scanWorkspace(activeWorkspace); } }} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors border border-transparent hover:border-red-100 rounded-md" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
              <h4 className="font-bold text-xs truncate select-text">{venv.name}</h4>
              <p className="text-[10px] text-slate-400 font-mono truncate mt-1 opacity-70 select-text">{venv.path}</p>
              <div className="mt-4 flex justify-between items-center text-[9px] font-bold uppercase text-slate-500 select-none">
                <span className={venv.status === "Healthy" ? "text-green-600" : "text-red-600"}>{venv.status}</span>
                <span className="text-blue-600 font-mono">{venv.version.split(" ")[1] || venv.version}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Python Dev Studio - FULL SCREEN OVERLAY */}
        {selectedVenv && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-12 transition-all">
            <div className="bg-white dark:bg-slate-900 w-full h-full rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/20 select-none">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg"><Terminal size={32}/></div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight select-text">{selectedVenv.name}</h2>
                        <p className="text-xs font-mono text-slate-400 select-text">{selectedVenv.path}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={saveAsTemplate} className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-800 text-xs font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"><BookmarkPlus size={16}/> Save as Template</button>
                    <button onClick={() => setSelectedVenv(null)} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm"><X size={24}/></button>
                </div>
              </div>

              <div className="flex px-8 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 select-none">
                {STUDIO_TABS.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setStudioTab(id)} className={cn("flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all", studioTab === id ? "border-blue-600 text-blue-600 bg-blue-50/10" : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200")}>
                        <Icon size={16}/> {label}
                    </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-10 bg-slate-50 dark:bg-slate-950/10 scrollbar-thin">
                {studioTab === "packages" && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <div className="grid grid-cols-2 gap-6 select-none">
                            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex items-center justify-between">
                                <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Disk Allocation</p><p className="text-3xl font-black text-blue-600">{venvDetails?.size_mb.toFixed(1)} MB</p></div>
                                <HardDrive size={32} className="text-slate-200 dark:text-slate-700"/>
                            </div>
                            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex items-center justify-between">
                                <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Active Libraries</p><p className="text-3xl font-black text-blue-600">{venvDetails?.packages.length}</p></div>
                                <Layers size={32} className="text-slate-200 dark:text-slate-700"/>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between select-none">
                                <h4 className="font-black text-sm uppercase tracking-widest">Library Manifest</h4>
                                <button onClick={async () => { try { setMessage(await invoke("export_requirements", { venvPath: selectedVenv.path })); } catch (e) { setMessage(`Error: ${e}`); } }} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-2"><Upload size={14}/> Export requirements.txt</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {venvDetails?.packages.map((pkg, i) => (
                                    <div key={i} className="flex justify-between items-center p-4 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl transition-all hover:border-blue-500/30">
                                        <div className="flex flex-col select-text">
                                            <span className="font-black text-slate-800 dark:text-slate-200">{pkg.split('==')[0]}</span>
                                            <span className="text-[10px] font-mono text-slate-400">{pkg.split('==')[1] || "stable"}</span>
                                        </div>
                                        <div className="flex gap-1 select-none">
                                            <button onClick={() => invoke("update_package", { venvPath: selectedVenv.path, package: pkg.split('==')[0] }).then(() => openStudio(selectedVenv))} className="p-2 text-slate-400 hover:text-green-600 transition-colors"><ArrowUpCircle size={16}/></button>
                                            <button onClick={async () => { if(await ask(`Uninstall ${pkg}?`)) invoke("uninstall_package", { venvPath: selectedVenv.path, package: pkg.split('==')[0] }).then(() => openStudio(selectedVenv)); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {studioTab === "automation" && (
                    <div className="max-w-3xl mx-auto space-y-10 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="space-y-4">
                            <h4 className="font-black text-sm uppercase tracking-widest">Add Automation Script</h4>
                            <div className="bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 rounded-[2rem] space-y-4 shadow-sm">
                                <input value={scriptInput.name} onChange={e => setScriptInput({...scriptInput, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold" placeholder="Script Name (ex: Sync Database)"/>
                                <textarea value={scriptInput.command} onChange={e => setScriptInput({...scriptInput, command: e.target.value})} className="w-full h-32 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl font-mono text-sm" placeholder="import my_app; my_app.init_db()"/>
                                <button onClick={async () => { if (!db || !scriptInput.name) return; await dbService.addScript(selectedVenv.path, scriptInput.name, scriptInput.command); setScriptInput({ name: "", command: "" }); openStudio(selectedVenv); }} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all">Save Script</button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h4 className="font-black text-sm uppercase tracking-widest">Saved Automations</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {scripts.map(s => (
                                    <button key={s.id} onClick={() => invoke("run_venv_script", { venvPath: selectedVenv.path, command: s.command }).then(out => setMessage(`Output: ${out.substring(0, 100)}`))} className="flex items-center justify-between p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl group transition-all hover:border-blue-500 shadow-sm active:scale-[0.98]">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-blue-600"><Play size={18}/></div>
                                            <span className="font-bold text-sm">{s.name}</span>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-all"/>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {studioTab === "config" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in duration-300">
                        <div className="space-y-4">
                            <h4 className="font-black text-sm uppercase tracking-widest flex items-center gap-2"><FileText size={16}/> Env Editor (.env)</h4>
                            <textarea value={envContent} onChange={e => setEnvContent(e.target.value)} className="w-full h-[400px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-[2rem] font-mono text-sm outline-none focus:border-blue-500 shadow-inner" placeholder="DB_HOST=localhost..."/>
                            <button onClick={() => invoke("save_env_file", { venvPath: selectedVenv.path, content: envContent }).then(() => setMessage("Updated!"))} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all">Save Environment Config</button>
                        </div>
                        <div className="space-y-4">
                            <h4 className="font-black text-sm uppercase tracking-widest flex items-center gap-2"><Settings size={16}/> System Config (pyvenv.cfg)</h4>
                            <pre className="w-full h-[400px] bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-[2rem] font-mono text-xs overflow-auto text-slate-500">{pyvenvCfg}</pre>
                        </div>
                    </div>
                )}

                {studioTab === "diagnostics" && (
                    <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in-95 duration-300">
                        <button onClick={runHealthCheck} className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2rem] text-slate-400 hover:text-blue-600 hover:border-blue-600 transition-all group">
                            <div className="flex flex-col items-center gap-2">
                                <ShieldCheck size={48} className="group-hover:scale-110 transition-transform"/>
                                <span className="font-black uppercase tracking-[0.2em]">Run Full Integrity Check</span>
                            </div>
                        </button>
                        {healthReport && (
                            <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm">
                                <h5 className="font-black text-sm uppercase tracking-widest mb-6 flex items-center gap-2"><Activity size={16} className="text-blue-600"/> pip check results</h5>
                                <div className={cn("p-4 rounded-xl font-mono text-xs mb-8", healthReport.includes("No conflicts") ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600")}>{healthReport}</div>
                                <h5 className="font-black text-sm uppercase tracking-widest mb-6 flex items-center gap-2"><ArrowUpCircle size={16} className="text-blue-600"/> Outdated Packages ({outdatedPkgs.length})</h5>
                                <div className="space-y-2">
                                    {outdatedPkgs.map(p => (
                                        <div key={p.name} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs">
                                            <span className="font-bold">{p.name}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-400">{p.version}</span>
                                                <ChevronRight size={12}/><span className="text-green-600 font-bold">{p.latest_version}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
