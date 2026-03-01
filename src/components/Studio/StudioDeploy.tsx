import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileCode, Copy, Server, Terminal } from "lucide-react";
import { VenvInfo } from "../../types";

interface StudioDeployProps {
  venv: VenvInfo;
  setMessage: (msg: string) => void;
}

export const StudioDeploy: React.FC<StudioDeployProps> = ({ venv, setMessage }) => {
  const [dockerFiles, setDockerFiles] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState("Dockerfile");

  useEffect(() => {
    const generate = async () => {
      try {
        const files: Record<string, string> = await invoke("generate_docker_files", { 
          venvPath: venv.path, 
          pythonVersion: venv.version 
        });
        setDockerFiles(files);
      } catch (err) {
        console.error("Docker generation error:", err);
      }
    };
    generate();
  }, [venv]);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setMessage("Content copied to clipboard!");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 p-6 bg-blue-600 text-white rounded-[2rem] shadow-lg shadow-blue-500/20">
        <div className="p-3 bg-white/20 rounded-2xl"><Server size={32}/></div>
        <div>
          <h3 className="font-black text-xl uppercase tracking-tighter text-white">Docker Deployment</h3>
          <p className="text-xs font-bold opacity-80">One-click containerization for this environment</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-slate-900 dark:text-slate-100">
        <div className="lg:col-span-1 space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Manifests</p>
          {Object.keys(dockerFiles).map(file => (
            <button
              key={file}
              onClick={() => setActiveFile(file)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all border ${
                activeFile === file 
                ? "bg-white dark:bg-slate-800 border-blue-500 text-blue-600 shadow-md" 
                : "bg-transparent border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-300"
              }`}
            >
              <FileCode size={18}/>
              {file}
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeFile} Preview</p>
            <button 
              onClick={() => copyToClipboard(dockerFiles[activeFile] || "")}
              className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:underline"
            >
              <Copy size={14}/> Copy Code
            </button>
          </div>
          <div className="relative group">
            <pre className="w-full h-[400px] bg-slate-900 text-blue-400 p-6 rounded-[2rem] font-mono text-xs overflow-auto border-2 border-slate-800 shadow-inner select-text">
              {dockerFiles[activeFile] || "# Generating files..."}
            </pre>
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-full border border-slate-700 text-[9px] font-bold text-slate-400 group-hover:border-blue-500 transition-all">
              <Terminal size={10}/> DOCKER ENGINE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
