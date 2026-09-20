import { useState, useEffect } from 'react';

interface ConnectionDialogProps {
  isOpen: boolean;
  initialLabel?: string;
  onConfirm: (label: string) => void;
  onCancel: () => void;
}

export function ConnectionDialog({ isOpen, initialLabel = '', onConfirm, onCancel }: ConnectionDialogProps) {
  const [label, setLabel] = useState(initialLabel);

  useEffect(() => {
    if (isOpen) {
      setLabel(initialLabel);
    }
  }, [isOpen, initialLabel]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#1e1e1e',
          borderRadius: 12,
          padding: 24,
          width: 400,
          maxWidth: '90vw',
          border: '1px solid #444',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', color: '#fff', fontSize: 18 }}>
          Choice Text
        </h3>
        <p style={{ margin: '0 0 16px', color: '#aaa', fontSize: 13 }}>
          Enter the text that will be shown to the viewer as a story choice.
        </p>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Enter the door"
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 6,
            border: '1px solid #444',
            background: '#2a2a2a',
            color: '#fff',
            fontSize: 14,
            boxSizing: 'border-box',
            marginBottom: 20,
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm(label);
            if (e.key === 'Escape') onCancel();
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #444',
              background: 'transparent',
              color: '#ccc',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(label)}
            disabled={!label.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#4a9eff',
              color: '#fff',
              cursor: label.trim() ? 'pointer' : 'not-allowed',
              fontSize: 14,
              opacity: label.trim() ? 1 : 0.5,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
