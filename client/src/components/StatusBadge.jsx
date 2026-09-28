import React from 'react';

/**
 * StatusBadge Component
 * @param {Object} props
 * @param {'connected' | 'offline' | 'loading'} props.status
 */
const StatusBadge = ({ status }) => {
  if (status === 'connected') {
    return (
      <span className="badge badge-connected" title="API Backend is online and responsive">
        <span className="badge-dot" />
        Backend Connected
      </span>
    );
  }

  if (status === 'offline') {
    return (
      <span className="badge badge-offline" title="Unable to reach API backend">
        <span className="badge-dot" />
        Backend Offline
      </span>
    );
  }

  return (
    <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>
      <span className="badge-dot" style={{ backgroundColor: '#94a3b8' }} />
      Checking Status...
    </span>
  );
};

export default StatusBadge;
