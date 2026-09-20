import { useEffect, useState, useRef, useCallback } from 'react';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { join, dirname } from '@tauri-apps/api/path';
import { ExportedProject } from '../../types/project';

export function Player() {
  const [project, setProject] = useState<ExportedProject | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectDir, setProjectDir] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showChoices, setShowChoices] = useState(false);

  useEffect(() => {
    let projectPath: string | null = null;
    async function load() {
      try {
        projectPath = (await invoke('get_player_project')) as string | null;
        console.log('Player project path:', projectPath);
        if (!projectPath) {
          setError('No project file specified.');
          return;
        }
        const dir = await dirname(projectPath);
        setProjectDir(dir);
        const content = await readTextFile(projectPath);
        console.log('Project content length:', content.length);
        const data: ExportedProject = JSON.parse(content);
        setProject(data);
        setCurrentNodeId(data.startNodeId || data.nodes[0]?.id || null);
      } catch (err) {
        console.error('Failed to load project:', err);
        const details = err instanceof Error ? err.message : String(err);
        setError(`Failed to load project from:\n${projectPath || 'unknown'}\n\nError: ${details}`);
      }
    }
    load();
  }, []);

  const resolveVideoPath = useCallback(
    async (videoPath: string) => {
      if (videoPath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(videoPath)) {
        return videoPath;
      }
      return await join(projectDir, videoPath);
    },
    [projectDir]
  );

  const currentNode = project?.nodes.find((n: { id: string }) => n.id === currentNodeId);
  const choices = project?.choices.filter((c: { from: string }) => c.from === currentNodeId) || [];

  useEffect(() => {
    async function play() {
      if (videoRef.current && currentNode) {
        const videoPath = await resolveVideoPath(currentNode.video);
        console.log('Playing video:', videoPath);
        videoRef.current.src = convertFileSrc(videoPath);
        videoRef.current.play().catch(() => {});
        setShowChoices(false);
      }
    }
    play();
  }, [currentNode, resolveVideoPath]);

  const handleEnded = useCallback(() => {
    setShowChoices(true);
  }, []);

  const handleChoice = useCallback((to: string) => {
    setCurrentNodeId(to);
  }, []);

  if (error) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b', padding: 20 }}>
        {error}
      </div>
    );
  }

  if (!project || !currentNode) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        onEnded={handleEnded}
        controls={false}
        playsInline
        autoPlay
      />

      {showChoices && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 40,
            background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {choices.length === 0 ? (
            <button
              onClick={() => setCurrentNodeId(project.startNodeId || project.nodes[0]?.id)}
              style={{
                padding: '14px 28px',
                fontSize: 18,
                border: '2px solid rgba(255,255,255,0.6)',
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                borderRadius: 8,
                cursor: 'pointer',
                minWidth: 280,
              }}
            >
              Replay
            </button>
          ) : (
            choices.map((choice: { id: string; to: string; text: string }) => (
              <button
                key={choice.id}
                onClick={() => handleChoice(choice.to)}
                style={{
                  padding: '14px 28px',
                  fontSize: 18,
                  border: '2px solid rgba(255,255,255,0.6)',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  borderRadius: 8,
                  cursor: 'pointer',
                  minWidth: 280,
                }}
              >
                {choice.text}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
