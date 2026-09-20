import { useProjectStore } from '../stores/projectStore';

export function Toolbar() {
  const {
    project,
    projectPath,
    isModified,
    undo,
    redo,
    historyIndex,
    history,
  } = useProjectStore();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        background: '#1e1e1e',
        borderBottom: '1px solid #333',
        color: '#fff',
      }}
    >
      <span style={{ fontWeight: 600, marginRight: 12 }}>
        {project.name}
        {isModified && ' *'}
      </span>
      <span style={{ color: '#888', fontSize: 12, marginRight: 'auto' }}>
        {projectPath || 'Unsaved'}
      </span>

      <button onClick={undo} disabled={!canUndo} className="toolbar-btn">
        Undo
      </button>
      <button onClick={redo} disabled={!canRedo} className="toolbar-btn">
        Redo
      </button>
    </div>
  );
}
