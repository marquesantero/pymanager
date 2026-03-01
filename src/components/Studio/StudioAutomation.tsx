import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Play, Plus, ChevronRight } from "lucide-react";
import { VenvInfo, Script } from "../../types";
import { dbService } from "../../services/db";

interface StudioAutomationProps {
  venv: VenvInfo;
  scripts: Script[];
  refreshScripts: () => void;
  setMessage: (msg: string) => void;
}

export const StudioAutomation: React.FC<StudioAutomationProps> = ({ venv, scripts, refreshScripts, setMessage }) => {
  const [scriptInput, setScriptInput] = useState({ name: "", command: "" });

  const addScript = async () => {
    if (!scriptInput.name) return;
    try {
      await dbService.addScript(venv.path, scriptInput.name, scriptInput.command);
      setScriptInput({ name: "", command: "" });
      refreshScripts();
    } catch (err) { setMessage(`Error adding script: ${err}`); }
  };

  const runScript = async (cmd: string) => {
    try {
      const out: string = await invoke("run_venv_script", { venvPath: venv.path, command: cmd });
      setMessage(`Output: ${out.substring(0, 100)}...`);
    } catch (err) { setMessage(`Error: ${err}`); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-in slide-in-from-bottom-4 duration-300">
      <div className="space-y-4">
        <h4 className="font-black text-sm uppercase tracking-widest ml-2">Add Automation Script</h4>
        <div className="bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 rounded-[2rem] space-y-4 shadow-sm">
          <input 
            value={scriptInput.name} 
            onChange={e => setScriptInput({...scriptInput, name: e.target.value})} 
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500" 
            placeholder="Script Label (e.g. Sync Database)"
          />
          <textarea 
            value={scriptInput.command} 
            onChange={e => setScriptInput({...scriptInput, command: e.target.value})} 
            className="w-full h-32 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl font-mono text-sm outline-none focus:border-blue-500" 
            placeholder="import my_app; my_app.init_db()"
          />
          <button onClick={addScript} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Save Script</button>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-black text-sm uppercase tracking-widest ml-2">Saved Automations</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scripts.map(s => (
            <button 
              key={s.id} 
              onClick={() => runScript(s.command)} 
              className="flex items-center justify-between p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl group transition-all hover:border-blue-500 shadow-sm active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Play size={18}/></div>
                <span className="font-bold text-sm">{s.name}</span>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-all"/>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
