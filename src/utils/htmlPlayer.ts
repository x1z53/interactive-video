import { Project, ExportedProject } from '../types/project';
import { copyFile, mkdir, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { join, basename } from '@tauri-apps/api/path';

const VIDEOS_DIR = 'videos';

export async function exportHtmlPlayer(project: Project, outputDir: string): Promise<void> {
  const videosDir = await join(outputDir, VIDEOS_DIR);
  if (!(await exists(videosDir))) {
    await mkdir(videosDir, { recursive: true });
  }

  // Copy videos and build exported project
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

  // Write project.json for reference and embed data into player.js
  await writeTextFile(await join(outputDir, 'project.json'), JSON.stringify(exported, null, 2));
  await writeTextFile(await join(outputDir, 'index.html'), generatePlayerHtml(project.name));
  await writeTextFile(await join(outputDir, 'player.js'), generatePlayerJs(exported));
}

function generatePlayerHtml(title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; background: #000; color: #fff; font-family: sans-serif; overflow: hidden; }
    #app { width: 100%; height: 100%; display: flex; flex-direction: column; }
    #video-container { flex: 1; display: flex; align-items: center; justify-content: center; background: #000; position: relative; }
    video { max-width: 100%; max-height: 100%; width: 100%; height: 100%; object-fit: contain; }
    #choices { position: absolute; bottom: 0; left: 0; right: 0; padding: 32px; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent); display: none; flex-direction: column; align-items: center; gap: 12px; }
    #choices.visible { display: flex; }
    .choice-btn { padding: 14px 28px; font-size: 18px; border: 2px solid rgba(255,255,255,0.6); background: rgba(0,0,0,0.6); color: #fff; border-radius: 8px; cursor: pointer; transition: all 0.2s; min-width: 280px; text-align: center; }
    .choice-btn:hover { background: rgba(255,255,255,0.2); border-color: #fff; }
    #loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    #error { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; color: #ff6b6b; padding: 20px; text-align: center; }
  </style>
</head>
<body>
  <div id="app">
    <div id="video-container">
      <div id="loading">Loading...</div>
      <div id="error"></div>
      <video id="player" playsinline></video>
      <div id="choices"></div>
    </div>
  </div>
  <script src="player.js"></script>
</body>
</html>
`;
}

function generatePlayerJs(project: ExportedProject): string {
  return `const PROJECT = ${JSON.stringify(project)};

function showError(message) {
  document.getElementById('loading').style.display = 'none';
  const error = document.getElementById('error');
  error.textContent = message;
  error.style.display = 'flex';
}

function main() {
  const video = document.getElementById('player');
  const choicesContainer = document.getElementById('choices');
  document.getElementById('loading').style.display = 'none';

  const nodes = new Map(PROJECT.nodes.map(n => [n.id, n]));
  const choicesByNode = new Map();
  for (const choice of PROJECT.choices) {
    if (!choicesByNode.has(choice.from)) choicesByNode.set(choice.from, []);
    choicesByNode.get(choice.from).push(choice);
  }

  function playNode(nodeId) {
    const node = nodes.get(nodeId);
    if (!node) { showError('Node not found: ' + nodeId); return; }
    choicesContainer.classList.remove('visible');
    choicesContainer.innerHTML = '';
    video.src = node.video;
    video.play().catch(() => {});
  }

  function showChoices(nodeId) {
    const choices = choicesByNode.get(nodeId) || [];
    choicesContainer.innerHTML = '';
    if (choices.length === 0) {
      const endBtn = document.createElement('button');
      endBtn.className = 'choice-btn';
      endBtn.textContent = 'Replay';
      endBtn.onclick = () => playNode(PROJECT.startNodeId);
      choicesContainer.appendChild(endBtn);
    } else {
      for (const choice of choices) {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = choice.text;
        btn.onclick = () => playNode(choice.to);
        choicesContainer.appendChild(btn);
      }
    }
    choicesContainer.classList.add('visible');
  }

  video.addEventListener('ended', () => {
    const currentNodeId = PROJECT.nodes.find(n => n.video === video.getAttribute('src'))?.id;
    if (currentNodeId) showChoices(currentNodeId);
  });

  if (PROJECT.startNodeId) playNode(PROJECT.startNodeId);
  else if (PROJECT.nodes.length > 0) playNode(PROJECT.nodes[0].id);
  else showError('No videos in this project.');
}

main();
`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
