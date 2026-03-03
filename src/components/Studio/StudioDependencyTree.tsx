import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronRight, ChevronDown, Package, Layers, Info, Loader2, RefreshCcw } from "lucide-react";
import { VenvInfo } from "../../types";
import { packageService } from "../../services/packageManager";

interface StudioDependencyTreeProps {
  venv: VenvInfo;
}

const TreeItem: React.FC<{ node: any, depth: number }> = React.memo(({ node, depth }) => {
  const [isOpen, setIsOpen] = useState(false); // Lazy expansion
  const [visibleChildren, setVisibleChildren] = useState(80); // Incremental rendering for huge dependency sets
  const hasChildren = node.dependencies && node.dependencies.length > 0;
  
  const name = node.package_name || node.name;
  const version = node.installed_version || node.version;
  const deps = node.dependencies || [];

  useEffect(() => {
    if (isOpen) setVisibleChildren(80);
  }, [isOpen, name]);

  const nodeId = `${name}@${version}`;

  return (
    <div className="ml-4">
      <div 
        className={`flex items-center gap-2 py-1.5 px-2 rounded-xl transition-all ${hasChildren ? "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20" : ""}`}
        onClick={() => hasChildren && setIsOpen(!isOpen)}
      >
        {hasChildren ? (
          isOpen ? <ChevronDown size={14} className="text-blue-500"/> : <ChevronRight size={14} className="text-slate-400"/>
        ) : <div className="w-[14px]"/>}
        
        <Package size={14} className={depth === 0 ? "text-blue-600" : "text-slate-400"}/>
        <span className={`text-xs font-bold ${depth === 0 ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>
          {name}
        </span>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
          {version}
        </span>
      </div>
      
      {/* PERFORMANCE CRITICAL: Only render children if isOpen is true */}
      {isOpen && hasChildren && (
        <div className="border-l-2 border-slate-100 dark:border-slate-800 ml-3.5 mt-1 animate-in slide-in-from-left-2 duration-200">
          {deps.slice(0, visibleChildren).map((dep: any, i: number) => (
            <TreeItem key={`${nodeId}::${dep.package_name || dep.name || "dep"}-${i}`} node={dep} depth={depth + 1} />
          ))}
          {deps.length > visibleChildren && (
            <div className="ml-6 py-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVisibleChildren(prev => prev + 80);
                }}
                className="text-[10px] font-black uppercase tracking-wide text-blue-600 hover:underline"
              >
                Load more ({deps.length - visibleChildren} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export const StudioDependencyTree: React.FC<StudioDependencyTreeProps> = ({ venv }) => {
  const [tree, setTree] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleRoots, setVisibleRoots] = useState(120);
  const [installingTool, setInstallingTool] = useState(false);
  const [openingTerminal, setOpeningTerminal] = useState(false);
  const showMissingToolHelp =
    venv.manager_type === "pip" &&
    /pipdeptree not found|no module named pipdeptree|missing dependency tree tool/i.test(error || "");

  const fetchTree = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await packageService.getDependencyTree(venv, { force });
      setTree(Array.isArray(data) ? data : [data]);
      setVisibleRoots(120);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree(false);
  }, [venv.path, venv.manager_type]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
        <Loader2 size={32} className="animate-spin text-blue-600"/>
        <p className="text-xs font-black uppercase tracking-widest">Building tree hierarchy...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto p-8 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-3xl text-center">
        <Layers size={48} className="mx-auto text-red-400 mb-4 opacity-50"/>
        <h3 className="text-sm font-black text-red-600 uppercase mb-2">Analysis Failed</h3>
        <p className="text-xs text-red-500 mb-6 font-medium">{error}</p>
        {showMissingToolHelp && (
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl text-left border border-red-100 dark:border-red-900/20 shadow-sm">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><Info size={12}/> Missing Tool:</p>
            <code className="text-[10px] font-mono text-blue-600 dark:text-blue-400 block p-2 bg-slate-50 dark:bg-slate-950 rounded-lg">
              pip install pipdeptree
            </code>
            <div className="mt-4 flex gap-2">
              <button
                onClick={async () => {
                  setInstallingTool(true);
                  try {
                    await packageService.install(venv, "pipdeptree");
                    await fetchTree(true);
                  } catch (installErr: any) {
                    setError(installErr?.toString?.() || "Failed to install pipdeptree.");
                  } finally {
                    setInstallingTool(false);
                  }
                }}
                disabled={installingTool || openingTerminal}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase disabled:opacity-50"
              >
                {installingTool ? "Installing..." : "Install Now"}
              </button>
              <button
                onClick={async () => {
                  setOpeningTerminal(true);
                  try {
                    await invoke("open_terminal_with_venv_command", { path: venv.path, command: "pip install pipdeptree" });
                  } catch (openErr: any) {
                    setError(openErr?.toString?.() || "Failed to open terminal with command.");
                  } finally {
                    setOpeningTerminal(false);
                  }
                }}
                disabled={openingTerminal || installingTool}
                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase disabled:opacity-50"
              >
                {openingTerminal ? "Opening..." : "Open Install Command"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-2">
        <h4 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
          <Layers size={18} className="text-blue-600"/> Hierarchical Inspector
        </h4>
        <div className="flex items-center gap-3">
          <p className="text-[9px] font-bold text-slate-400 uppercase">Click arrows to expand dependencies lazily</p>
          <button
            onClick={() => fetchTree(true)}
            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-blue-600 hover:underline"
          >
            <RefreshCcw size={12} />
            Refresh
          </button>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-sm">
        {tree.slice(0, visibleRoots).map((node, i) => (
          <TreeItem key={`${node.package_name || node.name || "root"}-${i}`} node={node} depth={0} />
        ))}
        {tree.length > visibleRoots && (
          <div className="ml-2 mt-4">
            <button
              onClick={() => setVisibleRoots(prev => prev + 120)}
              className="text-[10px] font-black uppercase tracking-wide text-blue-600 hover:underline"
            >
              Load more roots ({tree.length - visibleRoots} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
