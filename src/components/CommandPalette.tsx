import React, { useState, useEffect, useRef } from "react";
import { Search, Command, Terminal, Package, ArrowRight } from "lucide-react";
import { VenvInfo } from "../types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  venvCache: Record<string, VenvInfo[]>;
  onSelectVenv: (venv: VenvInfo) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, venvCache, onSelectVenv }) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Flatten all venvs for searching
  const allVenvs = Object.values(venvCache).flat();
  
  const results = allVenvs.filter(v => 
    v.name.toLowerCase().includes(query.toLowerCase()) || 
    v.path.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8); // Limit to top 8 for UI cleanliness

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, results.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % Math.max(1, results.length));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        onSelectVenv(results[selectedIndex]);
        onClose();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [isOpen, results, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
        <div className="flex items-center px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <Search size={20} className="text-blue-600 mr-4"/>
          <input 
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search environments, paths or packages..."
            className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-800 dark:text-white placeholder:text-slate-400"
          />
          <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-black text-slate-400">ESC</span>
          </div>
        </div>

        <div className="p-4 max-h-[400px] overflow-y-auto scrollbar-thin">
          {results.length > 0 ? (
            <div className="space-y-1">
              <p className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Environments ({results.length})</p>
              {results.map((v, i) => (
                <div 
                  key={v.path}
                  onClick={() => { onSelectVenv(v); onClose(); }}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`
                    flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-all border
                    ${selectedIndex === i 
                      ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 translate-x-1" 
                      : "bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"}
                  `}
                >
                  <div className="flex items-center gap-4 flex-1 truncate">
                    <div className={`p-2 rounded-xl ${selectedIndex === i ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}>
                      <Terminal size={16} className={selectedIndex === i ? "text-white" : "text-blue-600"}/>
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="font-black text-xs">{v.name}</span>
                      <span className={`text-[9px] font-mono truncate opacity-70 ${selectedIndex === i ? "text-blue-100" : ""}`}>
                        {v.path}
                      </span>
                    </div>
                  </div>
                  {selectedIndex === i && (
                    <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                      <span className="text-[9px] font-black uppercase">Open Studio</span>
                      <ArrowRight size={14}/>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-700">
                <Package size={32} className="opacity-20"/>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest">No environments found</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"><Command size={10} className="text-slate-400"/></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Navigation</span>
            </div>
          </div>
          <p className="text-[9px] font-black text-blue-600/50 uppercase tracking-tighter">PyManager Orchestrator Discovery</p>
        </div>
      </div>
    </div>
  );
};
