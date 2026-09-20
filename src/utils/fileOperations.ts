import { open, save } from '@tauri-apps/plugin-dialog';
import {
  readTextFile,
  writeTextFile,
  mkdir,
  copyFile,
  exists,
} from '@tauri-apps/plugin-fs';
import { join, basename } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { Project, ExportedProject, VIDEO_EXTENSIONS } from '../types/project';

const VIDEOS_DIR = 'videos';

export async function selectVideoFiles(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    filters: [
      {
        name: 'Video Files',
        extensions: VIDEO_EXTENSIONS,
      },
    ],
  });
  return (selected as string[]) || [];
}

export async function selectProjectFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
  });
  return (selected as string) || null;
}

export async function saveProjectDialog(): Promise<string | null> {
  const selected = await save({
    filters: [
      {
        name: 'Interactive Film Project',
        extensions: ['json'],
      },
    ],
  });
  return selected || null;
}

export async function loadProject(projectPath: string): Promise<Project> {
  const content = await readTextFile(projectPath);
  const project: Project = JSON.parse(content);

  // Resolve relative video paths to absolute paths based on project directory
  const projectDir = await getParentDir(projectPath);
  const videosDir = await join(projectDir, VIDEOS_DIR);

  for (const node of project.nodes) {
    if (node.data.videoPath && !isAbsolutePath(node.data.videoPath)) {
      node.data.videoPath = await join(videosDir, node.data.videoPath);
    }
  }

  return project;
}

export async function saveProject(project: Project, projectPath: string): Promise<void> {
  const projectDir = await getParentDir(projectPath);
  const videosDir = await join(projectDir, VIDEOS_DIR);

  // Ensure videos directory exists
  if (!(await exists(videosDir))) {
    await mkdir(videosDir, { recursive: true });
  }

  // Copy any new videos to project folder and update paths
  const exportProject: Project = JSON.parse(JSON.stringify(project));
  for (const node of exportProject.nodes) {
    if (node.data.videoPath && isAbsolutePath(node.data.videoPath)) {
      const videoName = await basename(node.data.videoPath);
      const destPath = await join(videosDir, videoName);
      if (node.data.videoPath !== destPath) {
        await copyFile(node.data.videoPath, destPath);
      }
      node.data.videoPath = videoName;
    }
  }

  await writeTextFile(projectPath, JSON.stringify(exportProject, null, 2));
}

export async function exportTauriPlayer(project: Project, outputDir: string): Promise<void> {
  const videosDir = await join(outputDir, VIDEOS_DIR);
  if (!(await exists(videosDir))) {
    await mkdir(videosDir, { recursive: true });
  }

  // Build exported project
  const exported: ExportedProject = {
    version: project.version,
    name: project.name,
    startNodeId: project.startNodeId,
    nodes: [],
    choices: [],
  };

  for (const node of project.nodes) {
    const srcPath = node.data.videoPath;
    const videoName = await basename(srcPath);
    const destPath = await join(videosDir, videoName);
    await copyFile(srcPath, destPath);

    exported.nodes.push({
      id: node.id,
      video: `${VIDEOS_DIR}/${videoName}`,
    });
  }

  for (const edge of project.edges) {
    exported.choices.push({
      id: edge.id,
      from: edge.source,
      to: edge.target,
      text: edge.data?.label || 'Continue',
    });
  }

  const projectPath = await join(outputDir, 'project.json');
  await writeTextFile(projectPath, JSON.stringify(exported, null, 2));

  // Copy current executable
  const currentExe = await invoke<string>('get_current_exe');
  const exeName = await basename(currentExe);
  const destExe = await join(outputDir, exeName);
  await copyFile(currentExe, destExe);

  // Create launcher script
  const runSh = `#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"

# Find GStreamer plugins for video playback in WebKit WebView
for GST_PATH in /usr/lib64/gstreamer-1.0 /usr/lib/gstreamer-1.0 /usr/lib/x86_64-linux-gnu/gstreamer-1.0 /usr/local/lib/gstreamer-1.0; do
  if [ -d "$GST_PATH" ]; then
    export GST_PLUGIN_PATH="$GST_PATH"
    export GST_PLUGIN_SYSTEM_PATH="$GST_PATH"
    break
  fi
done

# Find GStreamer plugin scanner (needed for AppImage bundles)
for GST_SCANNER in /usr/libexec/gstreamer-1.0/gst-plugin-scanner /usr/lib/gstreamer-1.0/gst-plugin-scanner /usr/local/libexec/gstreamer-1.0/gst-plugin-scanner; do
  if [ -x "$GST_SCANNER" ]; then
    export GST_PLUGIN_SCANNER="$GST_SCANNER"
    break
  fi
done

exec "$DIR/${exeName}" "$DIR/project.json" "$@"
`;
  await writeTextFile(await join(outputDir, 'run.sh'), runSh);

  const runBat = `@echo off\r\nsetlocal\r\nset "DIR=%~dp0"\r\nstart "" "%DIR%${exeName}" "%DIR%project.json" %*\r\n`;
  await writeTextFile(await join(outputDir, 'run.bat'), runBat);
}

function isAbsolutePath(p: string): boolean {
  // Simple check for Windows (C:\) and Unix (/)
  return /^([a-zA-Z]:[\\/]|\/)/.test(p);
}

async function getParentDir(filePath: string): Promise<string> {
  const sep = filePath.includes('\\') ? '\\' : '/';
  const parts = filePath.split(sep);
  parts.pop();
  return parts.join(sep);
}
