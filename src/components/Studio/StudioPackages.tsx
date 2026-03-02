import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Package, HardDrive, Layers, Upload, ArrowUpCircle, Trash2, Loader2 } from "lucide-react";
import { VenvInfo, VenvDetails } from "../../types";
import { packageService } from "../../services/packageManager";

interface StudioPackagesProps {
  venv: VenvInfo;
  details: VenvDetails | null;
  refresh: () => void;
  setMessage: (msg: string) => void;
}

export const StudioPackages: React.FC<StudioPackagesProps> = ({ venv, details, refresh, setMessage }) => {
  const [packageSizes, setPackageSizes] = useState<Record<string, number>>({});
  const [loadingSizes, setLoadingSizes] = useState(false);

  useEffect(() => {
    const fetchSizes = async () => {
      setLoadingSizes(true);
      try {
        const sizes: Record<string, number> = await invoke("get_package_sizes", { venvPath: venv.path });
        setPackageSizes(sizes);
      } catch (err) { 
        console.error("Error fetching package sizes:", err); 
      } finally { 
        setLoadingSizes(false); 
      }
    };
    fetchSizes();
  }, [venv, details]);

  const uninstallPkg = async (pkgName: string) => {
    try {
      const confirmed = await window.confirm(`Uninstall ${pkgName}?`);
      if (confirmed) {
        await packageService.uninstall(venv, pkgName);
        setMessage(`Uninstalled ${pkgName}`);
        refresh();
      }
    } catch (err) {
      setMessage(`Error: ${err}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 text-slate-900 dark:text-slate-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Disk Allocation</p>
            <p className="text-3xl font-black text-blue-600">{details?.size_mb?.toFixed(1) || "0.0"} MB</p>
          </div>
          <HardDrive size={32} className="text-slate-200 dark:text-slate-700"/>
        </div>
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Libraries</p>
            <p className="text-3xl font-black text-blue-600">{details?.packages?.length || 0}</p>
          </div>
          <Layers size={32} className="text-slate-200 dark:text-slate-700"/>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between select-none px-2">
          <h4 className="font-black text-sm uppercase tracking-widest">Library Manifest</h4>
          <div className="flex items-center gap-4">
            {loadingSizes && <span className="flex items-center gap-2 text-[10px] font-bold text-blue-500 animate-pulse"><Loader2 size={12} className="animate-spin"/> Analyzing Sizes</span>}
            <button 
              onClick={async () => { try { setMessage(await packageService.exportRequirements(venv.path)); } catch (e) { setMessage(`Error: ${e}`); } }} 
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-2"
            >
              <Upload size={14}/> Export requirements.txt
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
          {details?.packages?.map((pkg, i) => {
            const name = pkg.split('==')[0];
            const version = pkg.split('==')[1] || "stable";
            const size = packageSizes[name.toLowerCase()];

            return (
              <div key={i} className="flex justify-between items-center p-4 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl transition-all hover:border-blue-500/30 group">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-800 dark:text-slate-200">{name}</span>
                    {size !== undefined && <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">{size.toFixed(1)} MB</span>}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{version}</span>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => packageService.update(venv, name).then(() => refresh())} 
                    className="p-2 text-slate-400 hover:text-green-600 transition-colors"
                  >
                    <ArrowUpCircle size={16}/>
                  </button>
                  <button 
                    onClick={() => uninstallPkg(name)} 
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16}/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
