import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  BackgroundVariant,
  NodeChange,
  EdgeChange,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useProjectStore } from '../../stores/projectStore';
import VideoNode from './VideoNode';
import { ConnectionDialog } from './ConnectionDialog';
import { PreviewDialog } from './PreviewDialog';
import { ProjectNode, ProjectEdge } from '../../types/project';

const nodeTypes: NodeTypes = {
  video: VideoNode as unknown as NodeTypes[string],
};

function FlowEditorInner() {
  const {
    project,
    addEdge: addProjectEdge,
    removeEdge,
    removeNode,
    setNodes: setProjectNodes,
    setEdges: setProjectEdges,
  } = useProjectStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [previewNode, setPreviewNode] = useState<ProjectNode | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, project.nodes as unknown as Node[]);
      setProjectNodes(updated as unknown as ProjectNode[]);
    },
    [project.nodes, setProjectNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const updated = applyEdgeChanges(changes, project.edges as unknown as Edge[]);
      setProjectEdges(updated as unknown as ProjectEdge[]);
    },
    [project.edges, setProjectEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setPendingConnection(connection);
      setDialogOpen(true);
    },
    []
  );

  const handleDialogConfirm = (label: string) => {
    if (!pendingConnection) return;

    const newEdge: ProjectEdge = {
      id: `edge_${Date.now()}`,
      source: pendingConnection.source!,
      target: pendingConnection.target!,
      sourceHandle: pendingConnection.sourceHandle || undefined,
      targetHandle: pendingConnection.targetHandle || undefined,
      data: { label },
      type: 'default',
      animated: true,
    };

    addProjectEdge(newEdge);
    setDialogOpen(false);
    setPendingConnection(null);
  };

  const handleDialogCancel = () => {
    setDialogOpen(false);
    setPendingConnection(null);
  };

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setPreviewNode(node as unknown as ProjectNode);
  }, []);

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((edge) => removeEdge(edge.id));
    },
    [removeEdge]
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      deletedNodes.forEach((node) => removeNode(node.id));
    },
    [removeNode]
  );

  const { snapshotHistory } = useProjectStore();

  const onNodeDragStop = useCallback(() => {
    snapshotHistory();
  }, [snapshotHistory]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={project.nodes as unknown as Node[]}
        edges={project.edges as unknown as Edge[]}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgesDelete={onEdgesDelete}
        onNodesDelete={onNodesDelete}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        deleteKeyCode={['Delete', 'Backspace']}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#444" />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor="#4a9eff"
          style={{ background: '#1e1e1e', border: '1px solid #444' }}
        />
      </ReactFlow>

      <ConnectionDialog
        isOpen={dialogOpen}
        onConfirm={handleDialogConfirm}
        onCancel={handleDialogCancel}
      />

      <PreviewDialog
        isOpen={!!previewNode}
        videoPath={previewNode?.data.videoPath || null}
        videoName={previewNode?.data.videoName || 'Preview'}
        onClose={() => setPreviewNode(null)}
      />
    </div>
  );
}

export function FlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowEditorInner />
    </ReactFlowProvider>
  );
}
