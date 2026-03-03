import React, { useEffect, useState } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Node, 
  Edge, 
  MarkerType,
  useNodesState,
  useEdgesState,
  ConnectionLineType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { VenvInfo } from '../../types';
import { packageService } from '../../services/packageManager';
import { Loader2, Layers, RefreshCcw } from 'lucide-react';

interface StudioDependencyGraphProps {
  venv: VenvInfo;
}

export const StudioDependencyGraph: React.FC<StudioDependencyGraphProps> = ({ venv }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [maxDepth, setMaxDepth] = useState(1); // Default to shallow for performance
  const [fullData, setFullData] = useState<any[]>([]);

  const buildGraph = (data: any[], depth: number) => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const traverse = (item: any, parentId: string | null = null, level = 0, xOffset = 0, path = "root") => {
      if (level > depth) return; // KILL SWITCH for performance

      const name = item.package_name || item.name;
      const version = item.installed_version || item.version;
      const id = `${path}/${name.toLowerCase()}@${String(version || "unknown").toLowerCase()}`;

      newNodes.push({
        id,
        data: { label: (
          <div className="flex flex-col items-center">
            <span className="font-black text-[9px] uppercase truncate w-full text-center">{name}</span>
            <span className="text-[7px] font-mono opacity-60">{version}</span>
          </div>
        )},
        position: { x: xOffset, y: level * 120 },
        style: {
          background: level === 0 ? '#2563eb' : (level === 1 ? '#3b82f6' : '#fff'),
          color: level === 0 || level === 1 ? '#fff' : '#1e293b',
          border: '1.5px solid #2563eb',
          borderRadius: '10px',
          padding: '6px',
          width: 110,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        },
      });

      if (parentId) {
        newEdges.push({
          id: `e-${parentId}-${id}`,
          source: parentId,
          target: id,
          type: ConnectionLineType.SmoothStep,
          animated: level < 2,
          style: { stroke: '#3b82f6', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
        });
      }

      if (item.dependencies && level < depth) {
        item.dependencies.forEach((dep: any, index: number) => {
          traverse(dep, id, level + 1, xOffset + (index - item.dependencies.length/2) * 130, `${id}#${index}`);
        });
      }
    };

    const nodeToItem = (node: any) => node.package || node;
    data.forEach((root, i) => traverse(nodeToItem(root), null, 0, i * 250));
    
    setNodes(newNodes);
    setEdges(newEdges);
  };

  const fetchData = async (force = false) => {
    setLoading(true);
    try {
      const tree = await packageService.getDependencyTree(venv, { force });
      const data = Array.isArray(tree) ? tree : [tree];
      setFullData(data);
      buildGraph(data, maxDepth);
    } catch (err) {
      console.error("Graph Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(false);
  }, [venv.path, venv.manager_type]);

  useEffect(() => {
    if (fullData.length > 0) {
      buildGraph(fullData, maxDepth);
    }
  }, [maxDepth]);

  if (loading) {
    return (
      <div className="h-[500px] flex flex-col items-center justify-center gap-4 text-slate-400">
        <Loader2 size={32} className="animate-spin text-blue-600"/>
        <p className="text-xs font-black uppercase tracking-widest">Processing massive dataset...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-4 bg-white dark:bg-slate-900/50 py-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg"><Layers size={14}/></div>
            <p className="text-[10px] font-black uppercase tracking-widest">Scan Depth Control</p>
            <button
              onClick={() => fetchData(true)}
              className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-blue-600 hover:underline"
            >
              <RefreshCcw size={12} />
              Refresh
            </button>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            {[1, 2, 3].map(d => (
                <button 
                    key={d} 
                    onClick={() => setMaxDepth(d)} 
                    className={`px-4 py-1 rounded-md text-[9px] font-black transition-all ${maxDepth === d ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                    Level {d}
                </button>
            ))}
            <button onClick={() => setMaxDepth(99)} className={`px-4 py-1 rounded-md text-[9px] font-black transition-all ${maxDepth === 99 ? "bg-red-600 text-white" : "text-slate-400"}`}>Full</button>
        </div>
      </div>

      <div className="h-[600px] w-full bg-slate-50 dark:bg-slate-950/20 rounded-[3rem] border border-slate-200 dark:border-slate-800 overflow-hidden relative shadow-inner">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          maxZoom={1.5}
          minZoom={0.1}
          className="bg-transparent"
        >
          <Background color="#94a3b8" gap={20} size={1} />
          <Controls showInteractive={false} className="fill-blue-600" />
        </ReactFlow>

        <div className="absolute bottom-6 left-8 z-10 flex items-center gap-4">
            <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                <span className="text-[9px] font-black uppercase text-slate-500">{nodes.length} nodes active</span>
            </div>
        </div>
      </div>
    </div>
  );
};
