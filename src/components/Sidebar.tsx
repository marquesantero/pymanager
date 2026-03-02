import React from "react";
import { Package, Sun, Moon, Monitor, Plus, Folder, RefreshCcw, Trash2, Sparkles, Star } from "lucide-react";
import { THEME_OPTIONS } from "../constants/ui";
import { ThemeMode } from "../types";

interface SidebarProps {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  workspaces: { path: string, is_default: boolean }[];
  activeWorkspace: string;
  setActiveWorkspace: (ws: string) => void;
  addWorkspace: () => void;
  scanWorkspace: (ws: string) => void;
  removeWorkspace: (ws: string) => void;
  openHygiene: () => void;
  setDefaultWorkspace: (ws: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  theme, setTheme, workspaces, activeWorkspace, setActiveWorkspace, addWorkspace, scanWorkspace, removeWorkspace, openHygiene 
}) => {
  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900/60 shrink-0 font-bold select-none text-slate-900 dark:text-white">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg"><Package size={20} /></div>
        <h1 className="text-sm uppercase tracking-tight">PyManager</h1>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto text-[11px]">
        <div className="space-y-2">
          <p className="text-slate-400 uppercase tracking-widest ml-2">Orchestrator</p>
          <button 
            onClick={openHygiene}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 transition-all border border-transparent hover:border-green-200"
          >
            <Sparkles size={14} className="text-green-500"/>
            <span>Global Hygiene</span>
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 uppercase tracking-widest ml-2">Theme</p>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {THEME_OPTIONS.map(({ mode, icon: IconComponent }) => (
              <button key={mode} onClick={() => setTheme(mode)} className={`flex-1 flex justify-center py-1.5 rounded-lg transition-all ${theme === mode ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-400"}`}>
                <IconComponent size={14}/>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between px-2">
            <p className="text-slate-400 uppercase tracking-widest">Workspaces</p>
            <button onClick={addWorkspace} className="text-blue-600 hover:text-blue-700 transition-colors"><Plus size={18}/></button>
          </div>
          <div className="space-y-1.5 pt-2">
            {workspaces.map(ws => (
              <div key={ws.path} onClick={() => setActiveWorkspace(ws.path)} className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer border transition-all ${activeWorkspace === ws.path ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200 dark:border-blue-800" : "bg-transparent border-transparent text-slate-500 hover:bg-slate-100"}`}>
                <div className="flex items-center gap-2 truncate flex-1 mr-2">
                  <Folder size={14} className={activeWorkspace === ws.path ? "text-blue-600" : "text-slate-400"} />
                  <span className="truncate text-[10px]">{ws.path.split('/').pop() || ws.path}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setDefaultWorkspace(ws.path); }} 
                    className={`w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border transition-all shadow-sm ${ws.is_default ? "text-yellow-500 border-yellow-200" : "text-slate-300 border-slate-200 dark:border-slate-700 hover:text-yellow-500"}`}
                    title={ws.is_default ? "Default Workspace" : "Set as Default"}
                  >
                    <Star size={10} fill={ws.is_default ? "currentColor" : "none"}/>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); scanWorkspace(ws.path); }} className="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 transition-all shadow-sm" title="Refresh"><RefreshCcw size={10}/></button>
                  <button onClick={(e) => { e.stopPropagation(); removeWorkspace(ws.path); }} className="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 transition-all shadow-sm" title="Remove"><Trash2 size={10}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
};
