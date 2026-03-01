import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShieldCheck, Activity, ArrowUpCircle, ChevronRight, Loader2 } from "lucide-react";
import { VenvInfo, OutdatedPackage } from "../../types";

interface StudioDiagnosticsProps {
  venv: VenvInfo;
  setMessage: (msg: string) => void;
}

export const StudioDiagnostics: React.FC<StudioDiagnosticsProps> = ({ venv, setMessage }) => {
  const [loading, setLoading] = useState(false);
  const [healthReport, setHealthReport] = useState("");
  const [outdatedPkgs, setOutdatedPkgs] = useState<OutdatedPackage[]>([]);

  const runCheck = async () => {
    setLoading(true);
    try {
      const report: string = await invoke("check_venv_health", { venvPath: venv.path });
      setHealthReport(report);
      const outdated: OutdatedPackage[] = await invoke("list_outdated_packages", { venvPath: venv.path });
      setOutdatedPkgs(outdated);
    } catch (err) { setMessage(`Check failed: ${err}`); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in-95 duration-300">
      <button 
        onClick={runCheck} 
        disabled={loading}
        className="w-full py-10 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2.5rem] text-slate-400 hover:text-blue-600 hover:border-blue-600 transition-all group bg-white/50 dark:bg-slate-900/50 active:scale-[0.98]"
      >
        <div className="flex flex-col items-center gap-4">
          {loading ? <Loader2 size={48} className="animate-spin text-blue-500"/> : <ShieldCheck size={48} className="group-hover:scale-110 transition-transform"/>}
          <span className="font-black uppercase tracking-[0.2em]">{loading ? "Analyzing Environment..." : "Run Full Integrity Check"}</span>
        </div>
      </button>

      {healthReport && (
        <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <h5 className="font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2 text-slate-400">
            <Activity size={14} className="text-blue-600"/> pip check output
          </h5>
          <div className={`p-4 rounded-xl font-mono text-xs mb-8 border ${healthReport.includes("No conflicts") ? "bg-green-500/5 text-green-600 border-green-500/20" : "bg-red-500/5 text-red-600 border-red-500/20"}`}>
            {healthReport}
          </div>

          <h5 className="font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2 text-slate-400">
            <ArrowUpCircle size={14} className="text-blue-600"/> Update Opportunities ({outdatedPkgs.length})
          </h5>
          <div className="space-y-2">
            {outdatedPkgs.map(p => (
              <div key={p.name} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-700 dark:text-slate-300">{p.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-mono">{p.version}</span>
                  <ChevronRight size={12} className="text-slate-300"/>
                  <span className="text-green-600 font-black font-mono">{p.latest_version}</span>
                </div>
              </div>
            ))}
            {outdatedPkgs.length === 0 && <p className="text-center text-[10px] text-slate-400 italic py-4">All packages are up to date.</p>}
          </div>
        </div>
      )}
    </div>
  );
};
