import { create } from 'zustand';
import { Project, ProjectNode, ProjectEdge, VideoNodeData, ChoiceEdgeData } from '../types/project';

const MAX_HISTORY = 50;

export interface ProjectState {
  project: Project;
  history: Project[];
  historyIndex: number;
  projectPath: string | null;
  isModified: boolean;
}

export interface ProjectActions {
  setProject: (project: Project, path: string | null) => void;
  addNode: (videoPath: string, videoName: string, position: { x: number; y: number }) => void;
  updateNode: (id: string, data: Partial<VideoNodeData>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: ProjectEdge) => void;
  updateEdge: (id: string, data: Partial<ChoiceEdgeData>) => void;
  removeEdge: (id: string) => void;
  setStartNode: (id: string | null) => void;
  setNodes: (nodes: ProjectNode[]) => void;
  setEdges: (edges: ProjectEdge[]) => void;
  snapshotHistory: () => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

const createEmptyProject = (): Project => ({
  version: '1.0',
  name: 'Untitled Project',
  startNodeId: null,
  nodes: [],
  edges: [],
});

const cloneProject = (project: Project): Project => JSON.parse(JSON.stringify(project));

export const useProjectStore = create<ProjectState & ProjectActions>((set, get) => ({
  project: createEmptyProject(),
  history: [createEmptyProject()],
  historyIndex: 0,
  projectPath: null,
  isModified: false,

  setProject: (project, path) => {
    const cloned = cloneProject(project);
    set({
      project: cloned,
      history: [cloned],
      historyIndex: 0,
      projectPath: path,
      isModified: false,
    });
  },

  addNode: (videoPath, videoName, position) => {
    const { project } = get();
    const id = `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newNode: ProjectNode = {
      id,
      type: 'video',
      position,
      data: {
        label: videoName,
        videoPath,
        videoName,
      },
    };
    const newProject = cloneProject(project);
    newProject.nodes.push(newNode);
    if (!newProject.startNodeId) {
      newProject.startNodeId = id;
    }
    pushHistory(set, get, newProject);
  },

  updateNode: (id, data) => {
    const { project } = get();
    const newProject = cloneProject(project);
    const node = newProject.nodes.find((n) => n.id === id);
    if (node) {
      node.data = { ...node.data, ...data };
    }
    pushHistory(set, get, newProject);
  },

  removeNode: (id) => {
    const { project } = get();
    const newProject = cloneProject(project);
    newProject.nodes = newProject.nodes.filter((n) => n.id !== id);
    newProject.edges = newProject.edges.filter((e) => e.source !== id && e.target !== id);
    if (newProject.startNodeId === id) {
      newProject.startNodeId = newProject.nodes[0]?.id || null;
    }
    pushHistory(set, get, newProject);
  },

  addEdge: (edge) => {
    const { project } = get();
    const newProject = cloneProject(project);
    newProject.edges.push(edge);
    pushHistory(set, get, newProject);
  },

  updateEdge: (id, data) => {
    const { project } = get();
    const newProject = cloneProject(project);
    const edge = newProject.edges.find((e) => e.id === id);
    if (edge && edge.data) {
      edge.data = { ...edge.data, ...data };
    }
    pushHistory(set, get, newProject);
  },

  removeEdge: (id) => {
    const { project } = get();
    const newProject = cloneProject(project);
    newProject.edges = newProject.edges.filter((e) => e.id !== id);
    pushHistory(set, get, newProject);
  },

  setStartNode: (id) => {
    const { project } = get();
    const newProject = cloneProject(project);
    newProject.startNodeId = id;
    pushHistory(set, get, newProject);
  },

  setNodes: (nodes) => {
    const { project } = get();
    set({
      project: { ...cloneProject(project), nodes },
      isModified: true,
    });
  },

  setEdges: (edges) => {
    const { project } = get();
    set({
      project: { ...cloneProject(project), edges },
      isModified: true,
    });
  },

  snapshotHistory: () => {
    const { project, history, historyIndex } = get();
    const cloned = cloneProject(project);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(cloned);
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }
    set({
      project: cloned,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      isModified: true,
    });
  },

  undo: () => {
    const { historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        historyIndex: newIndex,
        project: cloneProject(get().history[newIndex]),
        isModified: true,
      });
    }
  },

  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        historyIndex: newIndex,
        project: cloneProject(history[newIndex]),
        isModified: true,
      });
    }
  },

  markSaved: () => set({ isModified: false }),
}));

function pushHistory(
  set: (partial: Partial<ProjectState>) => void,
  get: () => ProjectState,
  project: Project
) {
  const { historyIndex, history } = get();
  const newHistory = history.slice(0, historyIndex + 1);
  const cloned = cloneProject(project);
  newHistory.push(cloned);
  if (newHistory.length > MAX_HISTORY) {
    newHistory.shift();
  }
  set({
    project: cloned,
    history: newHistory,
    historyIndex: newHistory.length - 1,
    isModified: true,
  });
}
