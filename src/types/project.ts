import { Node, Edge } from '@xyflow/react';

export interface VideoNodeData {
  label: string;
  videoPath: string;
  videoName: string;
  [key: string]: unknown;
}

export interface ChoiceEdgeData {
  label: string;
  [key: string]: unknown;
}

export type ProjectNode = Node<VideoNodeData, 'video'>;
export type ProjectEdge = Edge<ChoiceEdgeData>;

export interface Project {
  version: string;
  name: string;
  startNodeId: string | null;
  nodes: ProjectNode[];
  edges: ProjectEdge[];
}

export interface ExportedProject {
  version: string;
  name: string;
  startNodeId: string | null;
  nodes: Array<{
    id: string;
    video: string;
  }>;
  choices: Array<{
    id: string;
    from: string;
    to: string;
    text: string;
  }>;
}

export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'mpg', 'mpeg'];
