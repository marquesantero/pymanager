import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText, Settings, Save } from "lucide-react";
import { VenvInfo } from "../../types";

interface StudioConfigProps {
  venv: VenvInfo;
  envContent: string;
  setEnvContent: (val: string) => void;
  pyvenvCfg: string;
  setMessage: (msg: string) => void;
}

export const StudioConfig: React.FC<StudioConfigProps> = ({ venv, envContent, setEnvContent, pyvenvCfg, setMessage }) => {
  const saveEnv = async () => {
    try {
      await invoke("save_env_file", { venvPath: venv.path, content: envContent });
      setMessage("Environment file (.env) saved!");
    } catch (err) { setMessage(`Error: ${err}`); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in duration-300">
      <div className="space-y-4">
        <h4 className="font-black text-sm uppercase tracking-widest flex items-center gap-2 ml-2">
          <FileText size={16} className="text-blue-500"/> Env Editor (.env)
        </h4>
        <textarea 
          value={envContent} 
          onChange={e => setEnvContent(e.target.value)} 
          className="w-full h-[400px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-[2rem] font-mono text-sm outline-none focus:border-blue-500 shadow-inner select-text" 
          placeholder="DB_HOST=localhost..."
        />
        <button onClick={saveEnv} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
          <Save size={18}/> Update Project Env
        </button>
      </div>
      
      <div className="space-y-4">
        <h4 className="font-black text-sm uppercase tracking-widest flex items-center gap-2 ml-2">
          <Settings size={16} className="text-blue-500"/> System Config (pyvenv.cfg)
        </h4>
        <pre className="w-full h-[400px] bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-[2rem] font-mono text-xs overflow-auto text-slate-500 select-text">
          {pyvenvCfg || "# No pyvenv.cfg found"}
        </pre>
        <p className="text-[10px] text-slate-400 italic px-4">Read-only configuration managed by the Python environment.</p>
      </div>
    </div>
  );
};
