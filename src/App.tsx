import { useEffect, useCallback, useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

import { FlowEditor } from './components/Editor/FlowEditor';
import { Toolbar } from './components/Toolbar';
import { Player } from './components/Player/Player';
import { useProjectStore } from './stores/projectStore';
import { loadProject, saveProject, selectVideoFiles, selectProjectFolder, exportTauriPlayer } from './utils/fileOperations';
import { exportHtmlPlayer } from './utils/htmlPlayer';
import { Project } from './types/project';
import './App.css';

function App() {
  const [playerMode, setPlayerMode] = useState<boolean | null>(null);

  useEffect(() => {
    invoke('get_player_project').then((path) => {
      setPlayerMode(!!path);
    });
  }, []);

  if (playerMode === null) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        Loading...
      </div>
    );
  }

  if (playerMode) {
    return <Player />;
  }

  return <Editor />;
}

function Editor() {
  const {
    project,
    projectPath,
    addNode,
    setProject,
    markSaved,
    undo,
    redo,
  } = useProjectStore();

  const handleNewProject = useCallback(() => {
    const emptyProject: Project = {
      version: '1.0',
      name: 'Untitled Project',
      startNodeId: null,
      nodes: [],
      edges: [],
    };
    setProject(emptyProject, null);
  }, [setProject]);

  const handleOpenProject = useCallback(async () => {
    const path = await open({
      filters: [{ name: 'Project', extensions: ['json'] }],
      multiple: false,
    });
    if (typeof path === 'string') {
      const loaded = await loadProject(path);
      setProject(loaded, path);
    }
  }, [setProject]);

  const handleSaveProject = useCallback(async () => {
    let path = projectPath;
    if (!path) {
      path = await save({
        filters: [{ name: 'Interactive Film Project', extensions: ['json'] }],
        defaultPath: `${project.name.replace(/\s+/g, '_')}.json`,
      });
    }
    if (path) {
      await saveProject(project, path);
      setProject(project, path);
      markSaved();
    }
  }, [project, projectPath, setProject, markSaved]);

  const handleSaveAsProject = useCallback(async () => {
    const path = await save({
      filters: [{ name: 'Interactive Film Project', extensions: ['json'] }],
      defaultPath: `${project.name.replace(/\s+/g, '_')}.json`,
    });
    if (path) {
      await saveProject(project, path);
      setProject(project, path);
      markSaved();
    }
  }, [project, setProject, markSaved]);

  const handleAddVideo = useCallback(async () => {
    const files = await selectVideoFiles();
    const offset = project.nodes.length * 30;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.split(/[\\/]/).pop() || file;
      addNode(file, name, { x: 100 + offset + i * 250, y: 100 + offset + i * 50 });
    }
  }, [addNode, project.nodes.length]);

  const handleExportHtml = useCallback(async () => {
    const dir = await selectProjectFolder();
    if (dir) {
      await exportHtmlPlayer(project, dir);
      alert(`HTML player exported to:\n${dir}`);
    }
  }, [project]);

  const handleExportApp = useCallback(async () => {
    const dir = await selectProjectFolder();
    if (dir) {
      await exportTauriPlayer(project, dir);
      alert(`Application player exported to:\n${dir}`);
    }
  }, [project]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          handleSaveAsProject();
        } else {
          handleSaveProject();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        handleOpenProject();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNewProject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleSaveProject, handleSaveAsProject, handleOpenProject, handleNewProject]);

  return (
    <div className="app" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          background: '#1e1e1e',
          borderBottom: '1px solid #333',
          color: '#fff',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 16, marginRight: 12 }}>🎬 Interactive Film Editor</span>

        <button onClick={handleNewProject} className="menu-btn">New</button>
        <button onClick={handleOpenProject} className="menu-btn">Open</button>
        <button onClick={handleSaveProject} className="menu-btn">Save</button>
        <button onClick={handleSaveAsProject} className="menu-btn">Save As</button>
        <div style={{ width: 1, height: 20, background: '#444', margin: '0 8px' }} />
        <button onClick={handleAddVideo} className="menu-btn primary">+ Add Video</button>
        <div style={{ width: 1, height: 20, background: '#444', margin: '0 8px' }} />
        <button onClick={handleExportHtml} className="menu-btn">Export HTML</button>
        <button onClick={handleExportApp} className="menu-btn">Export App</button>
      </div>

      <Toolbar />

      <div style={{ flex: 1, overflow: 'hidden', background: '#121212' }}>
        <FlowEditor />
      </div>
    </div>
  );
}

export default App;
