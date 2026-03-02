import React, { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Package, Layers, Info, Loader2 } from "lucide-react";
import { VenvInfo } from "../../types";
import { packageService } from "../../services/packageManager";

interface StudioDependencyTreeProps {
  venv: VenvInfo;
}

const TreeItem: React.FC<{ node: any, depth: number }> = ({ node, depth }) => {
  const [isOpen, setIsOpen] = useState(depth === 0);
  const hasChildren = node.dependencies && node.dependencies.length > 0;
  
  // Normalize node names based on uv/pipdeptree differences
  const name = node.package_name || node.name;
  const version = node.installed_version || node.version;

  return (
    <div className="ml-4">
      <div 
        className={`flex items-center gap-2 py-1 px-2 rounded-lg transition-colors ${hasChildren ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" : ""}`}
        onClick={() => hasChildren && setIsOpen(!isOpen)}
      >
        {hasChildren ? (
          isOpen ? <ChevronDown size={14} className="text-slate-400"/> : <ChevronRight size={14} className="text-slate-400"/>
        ) : <div className="w-[14px]"/>}
        
        <Package size={14} className={depth === 0 ? "text-blue-600" : "text-slate-400"}/>
        <span className={`text-xs font-bold ${depth === 0 ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>
          {name}
        </span>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
          {version}
        </span>
      </div>
      
      {isOpen && hasChildren && (
        <div className="border-l border-slate-200 dark:border-slate-800 ml-3 mt-1">
          {node.dependencies.map((dep: any, i: number) => (
            <TreeItem key={i} node={dep} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const StudioDependencyTree: React.FC<StudioDependencyTreeProps> = ({ venv }) => {
  const [tree, setTree] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTree = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await packageService.getDependencyTree(venv);
        setTree(Array.isArray(data) ? data : [data]);
      } catch (err: any) {
        setError(err.toString());
      } finally {
        setLoading(false);
      }
    };
    fetchTree();
  }, [venv]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
        <Loader2 size={32} className="animate-spin text-blue-600"/>
        <p className="text-xs font-black uppercase tracking-widest">Building dependency graph...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto p-8 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-3xl text-center">
        <Layers size={48} className="mx-auto text-red-400 mb-4 opacity-50"/>
        <h3 className="text-sm font-black text-red-600 uppercase mb-2">Dependency Tree Unavailable</h3>
        <p className="text-xs text-red-500 mb-6 font-medium">{error}</p>
        {venv.manager_type === "pip" && (
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl text-left border border-red-100 dark:border-red-900/20">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><Info size={12}/> How to fix:</p>
            <code className="text-[10px] font-mono text-blue-600 dark:text-blue-400 block p-2 bg-slate-50 dark:bg-slate-950 rounded-lg">
              pip install pipdeptree
            </code>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-2">
        <h4 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
          <Layers size={18} className="text-blue-600"/> Hierarchical View
        </h4>
        <p className="text-[9px] font-bold text-slate-400 uppercase">Top-level packages and their sub-dependencies</p>
      </div>
      
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-sm">
        {tree.map((node, i) => (
          <TreeItem key={i} node={node} depth={0} />
        ))}
      </div>
    </div>
  );
};
