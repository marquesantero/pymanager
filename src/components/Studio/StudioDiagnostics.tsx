import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShieldAlert, AlertCircle, CheckCircle2, Loader2, RefreshCcw, ExternalLink, ShieldCheck } from "lucide-react";
import { VenvInfo, OutdatedPackage } from "../../types";
import { packageService } from "../../services/packageManager";

interface StudioDiagnosticsProps {
  venv: VenvInfo;
}

export const StudioDiagnostics: React.FC<StudioDiagnosticsProps> = ({ venv }) => {
  const [health, setHealth] = useState<string>("");
  const [outdatedPkgs, setOutdatedPkgs] = useState<OutdatedPackage[]>([]);
  const [securityReport, setSecurityReport] = useState<any>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);

  const runFullDiagnostics = async () => {
    setLoadingHealth(true);
    try {
      setHealth(await invoke("check_venv_health", { venvPath: venv.path }));
      setOutdatedPkgs(await invoke("list_outdated_packages", { venvPath: venv.path }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHealth(false);
    }
  };

  const runSecurityAudit = async () => {
    setLoadingSecurity(true);
    setSecurityError(null);
    try {
      const report = await packageService.auditSecurity(venv.path);
      setSecurityReport(report);
    } catch (err: any) {
      setSecurityError(err.toString());
    } finally {
      setLoadingSecurity(false);
    }
  };

  useEffect(() => {
    runFullDiagnostics();
  }, [venv]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-slate-900 dark:text-slate-100">
      {/* Section 1: Health & Updates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-500"/> Consistency Check
            </h3>
            <button onClick={runFullDiagnostics} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
              <RefreshCcw size={14} className={loadingHealth ? "animate-spin" : ""}/>
            </button>
          </div>
          <pre className="text-[10px] font-mono p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-auto max-h-32">
            {health || "Running check..."}
          </pre>
        </div>

        <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm">
          <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-6">
            <AlertCircle size={16} className="text-orange-500"/> Outdated Packages
          </h3>
          <div className="space-y-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
            {outdatedPkgs.map(pkg => (
              <div key={pkg.name} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black">{pkg.name}</span>
                <span className="text-[9px] font-mono text-slate-400">{pkg.version} → <span className="text-blue-500">{pkg.latest_version}</span></span>
              </div>
            ))}
            {outdatedPkgs.length === 0 && <p className="text-center text-[10px] text-slate-400 italic py-4">All packages are up to date.</p>}
          </div>
        </div>
      </div>

      {/* Section 2: Security Audit */}
      <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[3rem] shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert size={20} className="text-blue-600"/> Security Vulnerability Audit
            </h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Deep inspection via PyPA Advisory Database</p>
          </div>
          <button 
            onClick={runSecurityAudit}
            disabled={loadingSecurity}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
          >
            {loadingSecurity ? <Loader2 size={14} className="animate-spin"/> : <ShieldAlert size={14}/>}
            {loadingSecurity ? "Auditing..." : "Run Security Scan"}
          </button>
        </div>

        {securityError ? (
          <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-[2rem] text-center">
            <p className="text-xs text-red-600 font-bold mb-4">{securityError}</p>
            <code className="text-[10px] font-mono text-blue-600 dark:text-blue-400 block p-3 bg-white dark:bg-slate-950 rounded-xl border border-red-100 dark:border-red-900/20">
              pip install pip-audit
            </code>
          </div>
        ) : securityReport ? (
          <div className="space-y-4">
            {securityReport.dependencies?.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {securityReport.dependencies.map((dep: any, i: number) => (
                  dep.vulnerabilities?.map((vuln: any, j: number) => (
                    <div key={`${i}-${j}`} className="flex flex-col p-5 bg-red-50/50 dark:bg-red-900/5 border border-red-100 dark:border-red-900/20 rounded-[2rem] transition-all hover:bg-red-50 dark:hover:bg-red-900/10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-red-600 text-white text-[9px] font-black rounded-full uppercase">High Risk</span>
                          <span className="font-black text-xs text-slate-800 dark:text-slate-200">{dep.name}=={dep.version}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{vuln.id}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{vuln.description || "No detailed description provided."}</p>
                      <div className="flex items-center justify-between border-t border-red-100 dark:border-red-900/20 pt-3 mt-1">
                        <span className="text-[9px] font-bold text-red-500 uppercase">Fixed in: {vuln.fix_versions?.join(", ") || "N/A"}</span>
                        <a href={`https://github.com/advisories/${vuln.id}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                          View Advisory <ExternalLink size={10}/>
                        </a>
                      </div>
                    </div>
                  ))
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-4 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 rounded-[3rem]">
                <ShieldCheck size={48} className="text-green-500 opacity-50"/>
                <p className="font-black text-green-600 uppercase tracking-widest text-xs">No vulnerabilities found</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem]">
            <ShieldAlert size={32} className="opacity-20 mb-4"/>
            <p className="text-[10px] font-bold uppercase tracking-widest">Click the button above to start the audit</p>
          </div>
        )}
      </div>
    </div>
  );
};
