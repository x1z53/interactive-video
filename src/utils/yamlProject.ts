import { Project } from '../types/project';

const VIDEOS_DIR = 'videos';

export interface YamlNode {
  id: number;
  title: string;
  file: string;
  outputs: number[];
}

export interface YamlProject {
  nodes: YamlNode[];
}

export function buildYamlProject(project: Project): { orderedNodes: Project['nodes']; yamlProject: YamlProject } {
  const orderedNodes = [...project.nodes];
  if (project.startNodeId) {
    const startIndex = orderedNodes.findIndex((n) => n.id === project.startNodeId);
    if (startIndex > 0) {
      const [startNode] = orderedNodes.splice(startIndex, 1);
      orderedNodes.unshift(startNode);
    }
  }

  const idMap = new Map<string, number>();
  orderedNodes.forEach((node, index) => {
    idMap.set(node.id, index + 1);
  });

  const outputsByNode = new Map<string, string[]>();
  for (const edge of project.edges) {
    if (!idMap.has(edge.source) || !idMap.has(edge.target)) {
      continue;
    }
    if (!outputsByNode.has(edge.source)) {
      outputsByNode.set(edge.source, []);
    }
    outputsByNode.get(edge.source)!.push(edge.target);
  }

  const nodes: YamlNode[] = orderedNodes.map((node) => {
    const numericId = idMap.get(node.id)!;
    const videoName = node.data.videoName || node.data.videoPath.split(/[\\/]/).pop() || `video_${numericId}`;
    const title = node.data.label || node.data.videoName || `Node ${numericId}`;

    const outputs = (outputsByNode.get(node.id) || [])
      .map((targetOldId) => idMap.get(targetOldId)!)
      .filter((targetId): targetId is number => targetId !== undefined);

    return {
      id: numericId,
      title,
      file: `${VIDEOS_DIR}/${videoName}`,
      outputs,
    };
  });

  return { orderedNodes, yamlProject: { nodes } };
}

export function renderYamlProject(yamlProject: YamlProject): string {
  const lines: string[] = ['nodes:'];

  for (const node of yamlProject.nodes) {
    lines.push(`  - id: ${node.id}`);
    lines.push(`    title: ${yamlString(node.title)}`);
    lines.push(`    file: ${yamlString(node.file)}`);

    if (node.outputs.length > 0) {
      lines.push('    outputs:');
      for (const targetId of node.outputs) {
        lines.push(`      - ${targetId}`);
      }
    }
  }

  return lines.join('\n') + '\n';
}

function yamlString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}
