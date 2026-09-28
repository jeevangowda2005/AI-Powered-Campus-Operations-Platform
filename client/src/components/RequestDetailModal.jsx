import React, { useState, useEffect, useRef } from 'react';
import { 
  updateRequestStatusApi, 
  assignRequestApi,
  getSimilarRequestsApi,
  generateResolutionApi,
  classifyRequestApi,
  suggestPriorityApi,
  getRequestByIdApi
} from '../services/api';
import { 
  X, 
  AlertCircle, 
  Shield, 
  Sparkles, 
  Copy, 
  Brain,
  Wand2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { getSocket } from '../services/socket';

const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

// ── AI Processing Status badge ──────────────────────────────────────────────
const AiStatusBadge = ({ status }) => {
  const cfg = {
    PENDING:    { icon: <Clock size={12} />,        label: 'AI Analysis: Pending',    bg: '#fef9c3', color: '#854d0e', border: '#fef08a' },
    PROCESSING: { icon: <Loader2 size={12} className="spin" />, label: 'AI Analysis: Processing…', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    COMPLETED:  { icon: <CheckCircle2 size={12} />, label: 'AI Analysis: Completed',  bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
    FAILED:     { icon: <XCircle size={12} />,      label: 'AI Analysis: Failed',     bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
  }[status] ?? { icon: null, label: `AI: ${status}`, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };

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

// ── Main Modal ───────────────────────────────────────────────────────────────
const RequestDetailModal = ({ request: initialRequest, isOpen, onClose, currentUser, onUpdated, departments = [] }) => {
  if (!isOpen || !initialRequest) return null;

  const [request, setRequest] = useState(initialRequest);
  const [status, setStatus]   = useState(initialRequest.status);
  const [departmentId, setDepartmentId]     = useState(initialRequest.departmentId || '');
  const [assignedStaffId, setAssignedStaffId] = useState(initialRequest.assignedStaffId || '');
  const [error, setError]     = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // AI on-demand state
  const [similarRequests, setSimilarRequests]       = useState([]);
  const [resolutionSuggestion, setResolutionSuggestion] = useState(null);
  const [aiLoading, setAiLoading]                   = useState(false);
  const [aiCategoryResult, setAiCategoryResult]     = useState(initialRequest.aiCategory || null);
  const [aiPriorityResult, setAiPriorityResult]     = useState(initialRequest.aiPriority || null);
  const [aiReasonResult, setAiReasonResult]         = useState(initialRequest.aiPriorityReason || null);
  const [aiProcessingStatus, setAiProcessingStatus] = useState(initialRequest.aiProcessingStatus || 'PENDING');

  const canManageStatus     = currentUser?.role === 'STAFF' || currentUser?.role === 'ADMIN';
  const canManageAssignment = currentUser?.role === 'STAFF' || currentUser?.role === 'ADMIN';

  // ── Real-Time Socket.IO listeners & State Sync ──────────────────────────────
  useEffect(() => {
    if (!isOpen || !initialRequest) return;

    setRequest(initialRequest);
    setStatus(initialRequest.status);
    setDepartmentId(initialRequest.departmentId || '');
    setAssignedStaffId(initialRequest.assignedStaffId || '');
    setAiCategoryResult(initialRequest.aiCategory || null);
    setAiPriorityResult(initialRequest.aiPriority || null);
    setAiReasonResult(initialRequest.aiPriorityReason || null);
    setAiProcessingStatus(initialRequest.aiProcessingStatus || 'PENDING');
    setError('');
    setMessage('');

    fetchSimilarRequests();

    const socket = getSocket();
    if (!socket) return;

    const handleAiUpdate = (evt) => {
      if (evt.requestId === initialRequest.id && evt.data) {
        const { aiProcessingStatus, aiCategory, aiPriority, aiPriorityReason } = evt.data;
        if (aiProcessingStatus) setAiProcessingStatus(aiProcessingStatus);
        if (aiCategory)         setAiCategoryResult(aiCategory);
        if (aiPriority)         setAiPriorityResult(aiPriority);
        if (aiPriorityReason)   setAiReasonResult(aiPriorityReason);

        if (aiProcessingStatus === 'COMPLETED' || aiProcessingStatus === 'FAILED') {
          setRequest((prev) => ({ ...prev, ...evt.data }));
          onUpdated?.({ ...initialRequest, ...evt.data });
        }
      }
    };

    const handleStatusUpdate = (evt) => {
      if (evt.requestId === initialRequest.id && evt.data) {
        setRequest(evt.data);
        setStatus(evt.data.status);
        onUpdated?.(evt.data);
      }
    };

    socket.on('request.ai.updated', handleAiUpdate);
    socket.on('request.status.updated', handleStatusUpdate);

    return () => {
      socket.off('request.ai.updated', handleAiUpdate);
      socket.off('request.status.updated', handleStatusUpdate);
    };
  }, [isOpen, initialRequest?.id]);

  const fetchSimilarRequests = async () => {
    try {
      const res = await getSimilarRequestsApi(request.id);
      if (res.success && res.data?.similarRequests) {
        setSimilarRequests(res.data.similarRequests);
      }
    } catch (err) {
      console.warn('Failed to load similar requests:', err);
    }
  };

  const handleAnalyzeAi = async () => {
    setAiLoading(true);
    setError('');
    try {
      const [classRes, prioRes, resRes] = await Promise.all([
        classifyRequestApi(request.id),
        suggestPriorityApi(request.id),
        canManageStatus ? generateResolutionApi(request.id) : Promise.resolve({ success: false }),
      ]);
      if (classRes.success && classRes.data?.aiCategory)  setAiCategoryResult(classRes.data.aiCategory);
      if (prioRes.success && prioRes.data?.aiPriority)    { setAiPriorityResult(prioRes.data.aiPriority); setAiReasonResult(prioRes.data.reason); }
      if (resRes.success  && resRes.data?.suggestion)     setResolutionSuggestion(resRes.data.suggestion);
    } catch (err) {
      setError('AI analysis service temporarily unavailable.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    setError(''); setMessage(''); setLoading(true);
    try {
      const res = await updateRequestStatusApi(request.id, status);
      if (res.success && res.data?.request) {
        setRequest(res.data.request);
        setStatus(res.data.request.status);
        setMessage(`Status updated to ${res.data.request.status}`);
        onUpdated?.(res.data.request);
      } else {
        setError(res.message || 'Status update failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating status.');
    } finally { setLoading(false); }
  };

  const handleAssignUpdate = async () => {
    setError(''); setMessage(''); setLoading(true);
    try {
      const assignPayload = {};
      if (departmentId   !== request.departmentId)   assignPayload.departmentId   = departmentId   || null;
      if (assignedStaffId !== request.assignedStaffId) assignPayload.assignedStaffId = assignedStaffId || null;
      const res = await assignRequestApi(request.id, assignPayload);
      if (res.success) { setMessage('Assignment updated successfully.'); onUpdated(res.data.request); }
      else setError(res.message || 'Assignment update failed.');
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating assignment.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div className="auth-card" style={{ maxWidth: '680px', width: '100%', position: 'relative', borderRadius: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
          <X size={20} />
        </button>

        {/* Header Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span className="badge" style={{ backgroundColor: '#2563eb', color: '#fff' }}>Final Category: {request.category}</span>
          <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>Final Priority: {request.priority}</span>
          <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}>Status: {request.status}</span>
          {/* Sprint 5: AI processing status badge */}
          <AiStatusBadge status={aiProcessingStatus} />
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{request.title}</h2>
        <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
          Submitted on {new Date(request.createdAt).toLocaleString()} • ID: <code>{request.id}</code>
        </p>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} /><span>{error}</span>
          </div>
        )}
        {message && (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {message}
          </div>
        )}

        {/* AI Suggestion Advisory Panel */}
        <div style={{ padding: '14px', borderRadius: '10px', background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)', border: '1px solid #e9d5ff', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7e22ce', fontWeight: 700, fontSize: '13px' }}>
              <Sparkles size={16} /> AI Intelligence Insights (Advisory Only)
            </div>
            <button onClick={handleAnalyzeAi} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '11px', borderColor: '#c084fc', color: '#7e22ce', background: '#fff' }} disabled={aiLoading}>
              <Wand2 size={12} className={aiLoading ? 'spin' : ''} /> {aiLoading ? 'Analyzing...' : 'Analyze with AI'}
            </button>
          </div>

          {/* Background processing status note */}
          {(aiProcessingStatus === 'PENDING' || aiProcessingStatus === 'PROCESSING') && (
            <div style={{ fontSize: '11px', color: '#6b21a8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Loader2 size={11} className="spin" />
              Background AI job is running. Results will appear automatically when complete.
            </div>
          )}
          {aiProcessingStatus === 'FAILED' && (
            <div style={{ fontSize: '11px', color: '#991b1b', marginBottom: '8px' }}>
              Background AI processing failed. You can trigger a manual analysis above.
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px' }}>
            <div><span style={{ color: '#6b21a8' }}>AI Category Suggestion: </span><strong>{aiCategoryResult || 'None'}</strong></div>
            <div><span style={{ color: '#6b21a8' }}>AI Priority Suggestion: </span><strong>{aiPriorityResult || 'None'}</strong></div>
          </div>
          {aiReasonResult && (
            <p style={{ fontSize: '11px', color: '#7e22ce', marginTop: '4px', fontStyle: 'italic' }}>
              Reason: "{aiReasonResult}"
            </p>
          )}
        </div>

        {/* Similar Requests Warning */}
        {similarRequests.length > 0 && (
          <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fef08a', color: '#854d0e', marginBottom: '20px', fontSize: '12px' }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Copy size={14} /> Similar Requests Detected (Threshold ≥ 80%)
            </div>
            <ul style={{ paddingLeft: '18px', margin: 0 }}>
              {similarRequests.map((sim) => (
                <li key={sim.requestId}>
                  <strong>{sim.title}</strong> — Status: <code>{sim.status}</code> (Similarity: {(sim.similarityScore * 100).toFixed(0)}%)
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Description */}
        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Description</h4>
          <p style={{ fontSize: '14px', color: '#0f172a', whiteSpace: 'pre-wrap' }}>{request.description}</p>
        </div>

        {/* AI Resolution Guidance (STAFF & ADMIN ONLY) */}
        {canManageStatus && resolutionSuggestion && (
          <div style={{ backgroundColor: '#f0fdf4', padding: '16px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #bbf7d0' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#166534', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Brain size={16} /> AI Suggested Resolution Workflow
            </h4>
            <p style={{ fontSize: '13px', color: '#15803d', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
              {resolutionSuggestion}
            </p>
          </div>
        )}

        {/* Operations Management Panel */}
        {canManageStatus && (
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginTop: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={16} style={{ color: '#2563eb' }} /> Operations Management Panel
            </h4>

            <div className="form-group">
              <label className="form-label">Update Status Lifecycle</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ flex: 1 }}>
                  {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
                <button onClick={handleStatusUpdate} className="btn btn-primary" disabled={loading || status === request.status}>
                  Save Status
                </button>
              </div>
            </div>

            {canManageAssignment && departments.length > 0 && (
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Department Assignment</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select className="form-input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} style={{ flex: 1 }}>
                    <option value="">No Department Assigned</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button onClick={handleAssignUpdate} className="btn btn-outline" disabled={loading || departmentId === (request.departmentId || '')}>
                    Assign Dept
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '24px', textAlign: 'right' }}>
          <button onClick={onClose} className="btn btn-outline">Close</button>
        </div>
      </div>
    </div>
  );
};

export default RequestDetailModal;
