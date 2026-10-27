import { Project, ExportedProject } from '../types/project';
import { copyFile, mkdir, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { join, basename } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';

const VIDEOS_DIR = 'videos';

export async function exportWindowsPlayer(project: Project, outputDir: string): Promise<void> {
  const videosDir = await join(outputDir, VIDEOS_DIR);
  if (!(await exists(videosDir))) {
    await mkdir(videosDir, { recursive: true });
  }

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

  const exePath = await open({
    filters: [{ name: 'Windows Executable', extensions: ['exe'] }],
    multiple: false,
  });

  let exeName = 'InteractiveFilmEditor.exe';

  if (typeof exePath === 'string') {
    exeName = await basename(exePath);
    const destExe = await join(outputDir, exeName);
    await copyFile(exePath, destExe);
  }

  const runBat = `@echo off
setlocal enabledelayedexpansion
set "DIR=%~dp0"
set "EXE=${exeName}"

if not exist "%DIR%%EXE%" (
    echo Error: %EXE% not found in %DIR%
    echo.
    echo Please download the Windows player executable from the project releases
    echo and place it next to this file as %EXE%.
    pause
    exit /b 1
)

start "" "%DIR%%EXE%" "%DIR%project.json" %*
`;
  await writeTextFile(await join(outputDir, 'run.bat'), runBat);

  const readme = [
    '# Windows Player',
    '',
    'This folder contains a standalone interactive video player for Windows.',
    '',
    '## Files',
    '',
    `- ${exeName} - the player executable (WebView2-based Tauri app).`,
    '- project.json - the interactive video scenario.',
    '- videos/ - video files referenced by the scenario.',
    '- run.bat - launcher script.',
    '',
    '## Running',
    '',
    'Double-click run.bat or run:',
    '',
    `    ${exeName} project.json`,
    '',
    '## Obtaining the executable',
    '',
    `If ${exeName} is missing, build the project on Windows or download a pre-built`,
    'binary from the GitHub Releases page.',
    '',
  ].join('\n');
  await writeTextFile(await join(outputDir, 'README.txt'), readme);
}
