interface PreviewDialogProps {
  isOpen: boolean;
  videoPath: string | null;
  videoName: string;
  onClose: () => void;
}

export function PreviewDialog({ isOpen, videoPath, videoName, onClose }: PreviewDialogProps) {
  if (!isOpen || !videoPath) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1e1e1e',
          borderRadius: 12,
          padding: 20,
          width: '80vw',
          maxWidth: 900,
          border: '1px solid #444',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>{videoName}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 24,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <video
          src={videoPath}
          controls
          autoPlay
          style={{
            width: '100%',
            borderRadius: 8,
            background: '#000',
          }}
        />
      </div>
    </div>
  );
}
