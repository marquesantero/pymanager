import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Trash2, Plus, X, AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { VenvInfo } from "../types";
import { dbService } from "../services/db";

interface HygieneOverlayProps {
  onClose: () => void;
  workspaces: string[];
  onRefresh: () => Promise<void> | void;
  setMessage: (msg: string) => void;
}

interface AuditReport {
  broken_links: string[];
  untracked_venvs: VenvInfo[];
}

export const HygieneOverlay: React.FC<HygieneOverlayProps> = ({ onClose, workspaces, onRefresh, setMessage }) => {
  const [report, setReport] = useState<AuditReport>({ broken_links: [], untracked_venvs: [] });
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const runAudit = async () => {
    setLoading(true);
    try {
      const allCached = await dbService.getCachedVenvs();
      const registeredPaths = Object.values(allCached).flat().map(v => v.path);
      const res: AuditReport = await invoke("audit_environments", { 
        workspacePaths: workspaces, 
        registeredPaths 
      });
      if (mountedRef.current) setReport(res);
    } catch (err) {
      console.error(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, [workspaces]);

  const prune = async (path: string) => {
    await dbService.removeVenvByPath(path);
    await runAudit();
    await onRefresh();
    setMessage("Dead link pruned from database.");
  };

  const adopt = async (venv: VenvInfo) => {
    // Find the longest matching workspace path to ensure it goes to the correct sub-workspace
    const matchingWorkspaces = workspaces
      .filter(w => venv.path.startsWith(w))
      .sort((a, b) => b.length - a.length);
    
    const targetWs = matchingWorkspaces[0] || workspaces[0];
    
    await dbService.addSingleVenv(targetWs, venv);
    await runAudit();
    await onRefresh();
    setMessage(`Adopted ${venv.name} into workspace: ${targetWs.split('/').pop()}`);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[60] flex items-center justify-center p-12 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[80vh] rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-600 text-white rounded-2xl shadow-lg shadow-green-500/20"><Sparkles size={24}/></div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">Global Hygiene</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Sync database with physical disk state</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all text-slate-400 hover:text-slate-900 dark:hover:text-white"><X size={24}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-10">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 size={48} className="animate-spin text-blue-600"/>
              <p className="font-black uppercase tracking-widest text-xs">Auditing Workspaces...</p>
            </div>
          ) : (
            <>
              {/* Broken Links Section */}
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-500">
                  <AlertTriangle size={16}/> Ghost Entries ({report.broken_links.length})
                </h3>
                <div className="space-y-2">
                  {report.broken_links.map(path => (
                    <div key={path} className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl">
                      <div className="flex flex-col truncate mr-4">
                        <span className="text-[10px] font-mono text-slate-500 truncate">{path}</span>
                        <span className="text-[9px] font-bold text-red-400 uppercase italic">Entry exists in DB but folder is missing on disk</span>
                      </div>
                      <button onClick={() => prune(path)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-red-700 transition-all shadow-md active:scale-95"><Trash2 size={12}/> Prune</button>
                    </div>
                  ))}
                  {report.broken_links.length === 0 && <p className="text-[10px] text-slate-400 italic px-4">No broken links found. Database is healthy.</p>}
                </div>
              </div>

              {/* Untracked Venvs Section */}
              <div className="space-y-4 pt-4">
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-500">
                  <Plus size={16}/> Untracked Environments ({report.untracked_venvs.length})
                </h3>
                <div className="space-y-2">
                  {report.untracked_venvs.map(venv => (
                    <div key={venv.path} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl">
                      <div className="flex flex-col truncate mr-4">
                        <span className="font-black text-xs text-slate-800 dark:text-slate-200">{venv.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 truncate">{venv.path}</span>
                      </div>
                      <button onClick={() => adopt(venv)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all shadow-md active:scale-95"><Plus size={12}/> Adopt</button>
                    </div>
                  ))}
                  {report.untracked_venvs.length === 0 && <p className="text-[10px] text-slate-400 italic px-4">No orphan environments found in your workspaces.</p>}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">The orchestrator ensures 100% synchronization between your database and filesystem.</p>
        </div>
      </div>
    </div>
  );
};
