import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, ask } from "@tauri-apps/plugin-dialog";
import Database from "@tauri-apps/plugin-sql";
import { 
  Plus, Folder, Trash2, Terminal, RefreshCcw, Search, 
  Box, ChevronRight, Info, Download, Loader2, Copy, 
  Layers, Globe, Activity, Cpu, Package, X, List, AlertTriangle, CheckCircle2,
  Sun, Moon, Monitor, HardDrive, ExternalLink, Code2, Wrench, Upload, SplitSquareHorizontal, Clock, Play, FileText, Save
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VenvInfo {
  name: string;
  path: string;
  version: string;
  status: string;
  issue?: string;
  last_modified: number;
}

interface VenvDetails {
  packages: string[];
  size_mb: number;
}

interface Script {
  id: number;
  name: string;
  command: string;
}

const TEMPLATES = [
  { id: "none", name: "Empty Environment", pkgs: [] },
  { id: "fastapi", name: "Web: FastAPI", pkgs: ["fastapi", "uvicorn[standard]", "sqlalchemy"] },
  { id: "django", name: "Web: Django", pkgs: ["django", "djangorestframework"] },
  { id: "data", name: "Data Science", pkgs: ["numpy", "pandas", "matplotlib"] },
];

function App() {
  const [db, setDb] = useState<Database | null>(null);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState("");
  const [venvCache, setVenvCache] = useState<Record<string, VenvInfo[]>>({});
  const [loading, setLoading] = useState(false);
  const [syncingVenv, setSyncingVenv] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Healthy" | "Broken">("All");
  const [message, setMessage] = useState("");
  const [selectedVenv, setSelectedVenv] = useState<VenvInfo | null>(null);
  const [venvDetails, setVenvDetails] = useState<VenvDetails | null>(null);

  const [newVenvName, setNewVenvName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [envContent, setEnvContent] = useState("");
  const [scriptInput, setScriptInput] = useState({ name: "", command: "" });

  const [cleanupMode, setCleanupMode] = useState(false);
  const [compareModal, setCompareModal] = useState(false);

  useEffect(() => {
    const initDb = async () => {
      try {
        const _db = await Database.load("sqlite:py-manager.db");
        setDb(_db);
        const wsRows: any[] = await _db.select("SELECT path FROM workspaces");
        setWorkspaces(wsRows.map(r => r.path));
        if (wsRows.length > 0) setActiveWorkspace(wsRows[0].path);
        const venvRows: any[] = await _db.select("SELECT * FROM venvs");
        const cache: Record<string, VenvInfo[]> = {};
        venvRows.forEach(r => {
          if (!cache[r.workspace_path]) cache[r.workspace_path] = [];
          cache[r.workspace_path].push({ name: r.name, path: r.path, version: r.version, status: r.status, issue: r.issue, last_modified: r.last_modified });
        });
        setVenvCache(cache);
      } catch (err) { console.error(err); }
    };
    initDb();
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

  const syncSingleVenv = async (path: string) => {
    if (!db) return;
    setSyncingVenv(path);
    try {
      const updated: VenvInfo = await invoke("scan_venv", { path });
      await db.execute("UPDATE venvs SET version = $1, status = $2, issue = $3, last_modified = $4 WHERE path = $5", [updated.version, updated.status, updated.issue || null, updated.last_modified, path]);
      setVenvCache(prev => {
        const workspace = Object.keys(prev).find(ws => prev[ws].some(v => v.path === path));
        if (!workspace) return prev;
        return { ...prev, [workspace]: prev[workspace].map(v => v.path === path ? updated : v) };
      });
      setMessage(`Updated ${updated.name}`);
    } catch (err) { setMessage(`Sync error: ${err}`); }
    finally { setSyncingVenv(null); }
  };

  const scanWorkspace = async (path: string) => {
    if (!db) return;
    setLoading(true);
    try {
      const result: VenvInfo[] = await invoke("list_venvs", { basePath: path });
      await db.execute("DELETE FROM venvs WHERE workspace_path = $1", [path]);
      for (const v of result) {
        await db.execute("INSERT INTO venvs (workspace_path, name, path, version, status, issue, last_modified) VALUES ($1, $2, $3, $4, $5, $6, $7)", [path, v.name, v.path, v.version, v.status, v.issue || null, v.last_modified]);
      }
      setVenvCache(prev => ({ ...prev, [path]: result }));
    } catch (error) { setMessage(`Error: ${error}`); } 
    finally { setLoading(false); }
  };

  const createVenv = async () => {
    if (!newVenvName || !activeWorkspace) return;
    setLoading(true);
    try {
      await invoke("create_venv", { path: activeWorkspace, name: newVenvName });
      const fullPath = `${activeWorkspace}/${newVenvName}`;
      for (const pkg of selectedTemplate.pkgs) {
        await invoke("install_dependency", { venvPath: fullPath, package: pkg });
      }
      setNewVenvName("");
      scanWorkspace(activeWorkspace);
    } catch (err) { setMessage(`Failed: ${err}`); }
    finally { setLoading(false); }
  };

  const loadVenvExtras = async (venv: VenvInfo) => {
    if (!db) return;
    try {
      const scriptRows: Script[] = await db.select("SELECT * FROM scripts WHERE venv_path = $1", [venv.path]);
      setScripts(scriptRows);
      const env: string = await invoke("read_env_file", { venvPath: venv.path });
      setEnvContent(env);
    } catch (err) { console.error(err); }
  };

  const currentVenvs = venvCache[activeWorkspace] || [];
  const isOld = (timestamp: number) => (Math.floor(Date.now() / 1000) - timestamp) > 90 * 24 * 60 * 60;

  const filteredVenvs = currentVenvs.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || v.status === statusFilter;
    const matchesCleanup = cleanupMode ? isOld(v.last_modified) : true;
    return matchesSearch && matchesStatus && matchesCleanup;
  });

  const stats = { total: currentVenvs.length, healthy: currentVenvs.filter(v => v.status === "Healthy").length, broken: currentVenvs.filter(v => v.status === "Broken").length };

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-50 font-sans overflow-hidden transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900/60 shrink-0 z-10 font-bold">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 bg-blue-600 rounded-lg text-white"><Package size={20} /></div>
          <h1 className="font-bold text-sm tracking-tight uppercase">PyManager</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto text-[11px]">
          <div className="space-y-2">
            <p className="text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Theme</p>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              {(["light", "dark", "system"] as const).map(t => (
                <button key={t} onClick={() => setTheme(t)} className={cn("flex-1 flex justify-center py-1.5 rounded-lg transition-all", theme === t ? "bg-white dark:bg-slate-700 text-blue-600" : "text-slate-400")}>
                  {t === "light" && <Sun size={14}/>} {t === "dark" && <Moon size={14}/>} {t === "system" && <Monitor size={14}/>}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2 mb-2">Tools</p>
            <button onClick={() => setCleanupMode(!cleanupMode)} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold border transition-all shadow-sm", cleanupMode ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50")}>
              <Clock size={14} /> Cleanup Mode
            </button>
            <button onClick={() => setCompareModal(true)} className="w-full flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold hover:bg-slate-50 shadow-sm">
              <SplitSquareHorizontal size={14} /> Compare Matrix
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <p className="text-slate-400 dark:text-slate-500 uppercase tracking-widest">Workspaces</p>
              <button onClick={async () => {
                const selected = await open({ directory: true, multiple: false });
                if (selected && db) {
                  const path = Array.isArray(selected) ? selected[0] : selected;
                  await db.execute("INSERT INTO workspaces (path) VALUES ($1)", [path]);
                  setWorkspaces(prev => [...prev, path]); setActiveWorkspace(path); scanWorkspace(path);
                }
              }} className="text-blue-600 hover:text-blue-700"><Plus size={16}/></button>
            </div>
            <div className="space-y-1">
              {workspaces.map(ws => (
                <div key={ws} onClick={() => setActiveWorkspace(ws)} className={cn("group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer border transition-all", activeWorkspace === ws ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200 dark:border-blue-800" : "bg-transparent border-transparent text-slate-500 hover:bg-slate-100")}>
                  <span className="truncate">{ws.split('/').pop() || ws}</span>
                  <button onClick={(e) => { e.stopPropagation(); scanWorkspace(ws); }} className="opacity-0 group-hover:opacity-100"><RefreshCcw size={12}/></button>
                </div>
              ))}
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-950 relative">
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 bg-white dark:bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-4">
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-4 text-xs outline-none focus:border-blue-500 w-64" placeholder="Search..." />
            <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest border-l pl-4 border-slate-200 dark:border-slate-800">
                <span>{stats.total} Total</span> <span className="text-green-600">{stats.healthy} OK</span> <span className="text-red-600">{stats.broken} Broken</span>
            </div>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
            {["All", "Healthy", "Broken"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s as any)} className={cn("px-3 py-1 rounded-md text-[10px] font-bold transition-all", statusFilter === s ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500")}>{s}</button>
            ))}
          </div>
        </header>

        {/* Quick Create Bar */}
        <div className="px-8 py-3 bg-white dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 shrink-0">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">New Env</p>
            <input value={newVenvName} onChange={(e) => setNewVenvName(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-1 text-xs w-48 font-bold" placeholder="Name..." />
            <select value={selectedTemplate.id} onChange={(e) => setSelectedTemplate(TEMPLATES.find(t => t.id === e.target.value) || TEMPLATES[0])} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-400">
                {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={createVenv} disabled={loading || !newVenvName} className="bg-blue-600 text-white px-4 py-1 rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm">
                {loading ? <Loader2 size={12} className="animate-spin" /> : "Build"}
            </button>
            {message && <p className="text-[9px] font-black text-blue-500 truncate ml-auto uppercase tracking-tighter">{message}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start pb-20">
          {filteredVenvs.map((venv) => (
            <div key={venv.path} className={cn("flex flex-col h-fit bg-white dark:bg-slate-900/40 border transition-all rounded-xl p-4 shadow-sm", venv.status === "Broken" ? "border-red-200 bg-red-50/10" : "border-slate-200 dark:border-slate-800 hover:border-blue-400")}>
              <div className="flex justify-between mb-3">
                <div className={cn("p-2 rounded-lg shadow-sm", venv.status === "Broken" ? "bg-red-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-blue-600")}><Terminal size={16} /></div>
                <div className="flex gap-1">
                  <button onClick={() => syncSingleVenv(venv.path)} className={cn("p-1.5 text-slate-400 hover:text-blue-600 transition-all", syncingVenv === venv.path && "animate-spin text-blue-600")} title="Sync"><RefreshCcw size={14} /></button>
                  <button onClick={() => invoke("open_in_vscode", { path: venv.path })} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-md" title="VS Code"><Code2 size={14} /></button>
                  <button onClick={() => invoke("open_terminal", { path: venv.path })} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-md" title="Terminal"><ExternalLink size={14} /></button>
                  <button onClick={async () => { setSelectedVenv(venv); loadVenvExtras(venv); const d: VenvDetails = await invoke("get_venv_details", { path: venv.path }); setVenvDetails(d); }} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-md" title="Details"><List size={14} /></button>
                  <button onClick={async () => { if (await ask(`Delete folder?`)) { await invoke("delete_venv", { path: venv.path }); scanWorkspace(activeWorkspace); } }} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors border border-transparent hover:border-red-100 rounded-md" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
              <h4 className="font-bold text-xs truncate">{venv.name}</h4>
              <p className="text-[10px] text-slate-400 font-mono truncate mt-1 opacity-70">{venv.path}</p>
              <div className="mt-4 flex justify-between items-center text-[9px] font-bold uppercase text-slate-500">
                <span className={venv.status === "Healthy" ? "text-green-600" : "text-red-600"}>{venv.status}</span>
                <span className="text-blue-600 font-mono">{venv.version.split(" ")[1] || venv.version}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Drawer */}
        {selectedVenv && (
          <div className="absolute inset-y-0 right-0 w-[450px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl animate-in slide-in-from-right z-50 flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/20">
              <div>
                <h3 className="font-bold text-sm truncate max-w-[250px]">{selectedVenv.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Environment Analysis</p>
              </div>
              <button onClick={() => setSelectedVenv(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={18} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Venv Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 shadow-inner text-center">
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-1 tracking-tighter">Disk Space</p>
                    <p className="text-sm font-bold text-blue-600">{venvDetails?.size_mb.toFixed(1) || "..."} MB</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 shadow-inner text-center">
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-1 tracking-tighter">Installed Libs</p>
                    <p className="text-sm font-bold text-blue-600">{venvDetails?.packages.length || "..."}</p>
                </div>
              </div>

              {/* Package List - RESTORED */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center justify-between">
                    <span>Packages</span>
                    <button onClick={async () => { try { setMessage(await invoke("export_requirements", { venvPath: selectedVenv.path })); } catch (e) { setMessage(`Error: ${e}`); } }} className="text-[9px] text-blue-500 hover:underline">Export reqs.txt</button>
                </p>
                <div className="max-h-64 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-lg">
                    {venvDetails?.packages.map((pkg, i) => (
                        <div key={i} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-950/50 border-b last:border-0 border-slate-100 dark:border-slate-800 text-[10px] font-mono hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <span className="text-slate-700 dark:text-slate-300 font-semibold">{pkg.split('==')[0]}</span>
                            <span className="text-blue-600 font-bold">{pkg.split('==')[1] || "stable"}</span>
                        </div>
                    ))}
                    {!venvDetails && <div className="p-4 text-center text-slate-400 animate-pulse text-[10px]">Analyzing libraries...</div>}
                </div>
              </div>

              {/* Script Runner */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Play size={12}/> Script Runner</p>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input value={scriptInput.name} onChange={e => setScriptInput({...scriptInput, name: e.target.value})} className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded text-[10px]" placeholder="Label"/>
                    <input value={scriptInput.command} onChange={e => setScriptInput({...scriptInput, command: e.target.value})} className="flex-[2] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded text-[10px]" placeholder="Python code..."/>
                    <button onClick={async () => { if (!db || !selectedVenv || !scriptInput.name) return; await db.execute("INSERT INTO scripts (venv_path, name, command) VALUES ($1, $2, $3)", [selectedVenv.path, scriptInput.name, scriptInput.command]); setScriptInput({ name: "", command: "" }); loadVenvExtras(selectedVenv); }} className="p-2 bg-blue-600 text-white rounded shadow-sm"><Plus size={14}/></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">{scripts.map(s => <button key={s.id} onClick={() => invoke("run_venv_script", { venvPath: selectedVenv.path, command: s.command }).then(out => setMessage(`Output: ${out.substring(0, 50)}...`))} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-[10px] transition-all"><span>{s.name}</span><Play size={10} className="text-blue-500"/></button>)}</div>
                </div>
              </div>

              {/* .env Editor */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText size={12}/> Configuration (.env)</p>
                <textarea value={envContent} onChange={e => setEnvContent(e.target.value)} className="w-full h-40 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded font-mono text-[10px] outline-none focus:border-blue-500" placeholder="KEY=VALUE" />
                <button onClick={() => invoke("save_env_file", { venvPath: selectedVenv.path, content: envContent }).then(() => setMessage("Saved .env!"))} className="w-full py-2 bg-blue-600 text-white rounded text-[10px] font-bold flex items-center justify-center gap-2 shadow-sm"><Save size={14}/> Update .env</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
