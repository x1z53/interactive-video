import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { VideoNodeData } from '../../types/project';

function VideoNode({ data, selected }: NodeProps) {
  const nodeData = data as VideoNodeData;
  const videoName = nodeData.videoName || nodeData.label || 'Untitled';

  return (
    <div
      className={`video-node ${selected ? 'selected' : ''}`}
      style={{
        width: 220,
        background: '#1e1e1e',
        borderRadius: 10,
        border: selected ? '2px solid #4a9eff' : '1px solid #444',
        color: '#fff',
        overflow: 'hidden',
        boxShadow: selected ? '0 0 12px rgba(74, 158, 255, 0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{ background: '#4ade80', width: 12, height: 12 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ background: '#f87171', width: 12, height: 12 }}
      />

      <div
        style={{
          height: 120,
          background: '#2a2a2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
          color: '#666',
        }}
      >
        🎬
      </div>

      <div style={{ padding: '10px 12px' }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 4,
          }}
          title={videoName}
        >
          {videoName}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#999',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Click to preview
        </div>
      </div>
    </div>
  );
}

export default memo(VideoNode);
