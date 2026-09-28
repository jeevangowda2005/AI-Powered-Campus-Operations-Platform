import React from 'react';
import { Clock, CheckCircle2, XCircle, Loader2, HelpCircle } from 'lucide-react';

/**
 * Displays an AI processing status badge.
 * @param {{ status: 'PENDING'|'PROCESSING'|'COMPLETED'|'FAILED'|string }} props
 */
const AiStatusBadge = ({ status }) => {
  const cfg = {
    PENDING: { icon: <Clock size={12} />, label: 'AI: Pending', bg: '#fef9c3', color: '#854d0e', border: '#fef08a' },
    PROCESSING: { icon: <Loader2 size={12} className="spin" />, label: 'AI: Processing', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    COMPLETED: { icon: <CheckCircle2 size={12} />, label: 'AI: Ready', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
    FAILED: { icon: <XCircle size={12} />, label: 'AI: Failed', bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
  }[status] || { icon: <HelpCircle size={12} />, label: `AI: ${status || 'N/A'}`, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
      backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.icon}{cfg.label}
    </span>
  );
};

export default AiStatusBadge;
