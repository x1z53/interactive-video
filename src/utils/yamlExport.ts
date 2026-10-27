import { Project } from '../types/project';
import { copyFile, mkdir, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { join, basename } from '@tauri-apps/api/path';
import { buildYamlProject, renderYamlProject } from './yamlProject';

export async function exportYamlPlayer(project: Project, outputDir: string): Promise<void> {
  const videosDir = await join(outputDir, 'videos');
  if (!(await exists(videosDir))) {
    await mkdir(videosDir, { recursive: true });
  }

  const { orderedNodes, yamlProject } = buildYamlProject(project);
  const yamlContent = renderYamlProject(yamlProject);

  for (const node of orderedNodes) {
    const srcPath = node.data.videoPath;
    const videoName = await basename(srcPath);
    const destPath = await join(videosDir, videoName);
    await copyFile(srcPath, destPath);
  }

  const yamlPath = await join(outputDir, 'project.yaml');
  await writeTextFile(yamlPath, yamlContent);
}
