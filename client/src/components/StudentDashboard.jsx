import React, { useState, useEffect, useRef, useCallback } from 'react';
import Card from './Card';
import CreateRequestModal from './CreateRequestModal';
import RequestDetailModal from './RequestDetailModal';
import AiStatusBadge from './AiStatusBadge';
import { getMyRequestsApi, getStudentAnalyticsApi } from '../services/api';
import { getSocket } from '../services/socket';
import { Link } from 'react-router-dom';
import {
  FilePlus,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  ListFilter,
  CheckCircle2,
  Inbox,
  ArrowRight,
} from 'lucide-react';

/**
 * StudentDashboard — Dashboard OVERVIEW only.
 * Shows metric cards + most recent 5 requests as a summary.
 * The full request list with filters lives on /requests (ServiceRequestsPage).
 */
const StudentDashboard = ({ currentUser }) => {
  const [analytics, setAnalytics] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Stable ref so socket closure can identify relevant events without
  // requiring recentRequests in the useEffect dependency array.
  const recentRef = useRef([]);
  useEffect(() => {
    recentRef.current = recentRequests;
  }, [recentRequests]);

  const fetchDashboardData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [analyticsRes, requestsRes] = await Promise.all([
        getStudentAnalyticsApi(),
        getMyRequestsApi({}),          // no filters — just fetch all, slice to 5 below
      ]);

      if (analyticsRes.success && analyticsRes.data) {
        setAnalytics(analyticsRes.data);
      }
      if (requestsRes.success && requestsRes.data?.requests) {
        setRecentRequests(requestsRes.data.requests.slice(0, 5));
      }
    } catch (err) {
      console.error('Failed to fetch student dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run once on mount + reconnect socket listeners.
  // NOTE: recentRequests intentionally NOT in this dep array.
  useEffect(() => {
    fetchDashboardData(true);

    const socket = getSocket();
    if (!socket) return;

    const isRelevant = (evt) => {
      if (!evt) return false;
      const evtStudentId = evt.studentId || evt.data?.studentId || evt.data?.student?.id;
      if (evtStudentId && evtStudentId === currentUser.id) return true;
      if (evt.requestId && recentRef.current.some((r) => r.id === evt.requestId)) return true;
      return false;
    };

    const handleEvent = (evt) => {
      if (isRelevant(evt)) fetchDashboardData(false);
    };

    socket.on('request.created', handleEvent);
    socket.on('request.status.updated', handleEvent);
    socket.on('request.assigned', handleEvent);
    socket.on('request.ai.updated', handleEvent);

    return () => {
      socket.off('request.created', handleEvent);
      socket.off('request.status.updated', handleEvent);
      socket.off('request.assigned', handleEvent);
      socket.off('request.ai.updated', handleEvent);
    };
  }, [fetchDashboardData, currentUser.id]);

  const handleRequestCreated = (newReq) => {
    if (newReq) {
      setRecentRequests((prev) => [newReq, ...prev].slice(0, 5));
    }
    fetchDashboardData(false);
  };

  const handleRequestUpdated = () => fetchDashboardData(false);

  const summary = analytics?.summary || {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
  };

  return (
    <div style={{ marginTop: '24px' }}>
      {/* Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>Student Service Desk</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Overview of your campus service requests.
          </p>
        </div>
        <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary" style={{ padding: '10px 20px' }}>
          <FilePlus size={18} /> Create New Request
        </button>
      </div>

      {/* Summary Metric Cards */}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: '24px' }}>
        <Card title="Total Requests" value={summary.total} icon={ListFilter} colorClass="card-icon-blue" description="All submitted tickets" />
        <Card title="Open" value={summary.open} icon={AlertCircle} colorClass="card-icon-orange" description="Awaiting staff pickup" />
        <Card title="In Progress" value={summary.inProgress} icon={Clock} colorClass="card-icon-purple" description="Work in progress" />
        <Card title="Resolved" value={summary.resolved} icon={CheckCircle} colorClass="card-icon-green" description="Completed tickets" />
        <Card title="Closed" value={summary.closed} icon={CheckCircle2} colorClass="card-icon-gray" description="Archived tickets" />
      </div>

      {/* Recent Requests (latest 5 only) */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Recent Requests (latest 5)</span>
          <Link to="/requests" style={{ fontSize: '13px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}>
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>Loading...</div>
        ) : recentRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
            <Inbox size={28} style={{ margin: '0 auto 8px auto', display: 'block', color: '#94a3b8' }} />
            <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>No requests yet.</p>
            <p style={{ fontSize: '12px' }}>Click &ldquo;Create New Request&rdquo; to get started.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 12px' }}>Title</th>
                  <th style={{ padding: '10px 12px' }}>Category</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>AI</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.map((req) => (
                  <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{req.title}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>{req.category}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="badge" style={{
                        backgroundColor: req.status === 'RESOLVED' || req.status === 'CLOSED' ? '#ecfdf5' : req.status === 'IN_PROGRESS' ? '#f0f9ff' : '#fffbeb',
                        color: req.status === 'RESOLVED' || req.status === 'CLOSED' ? '#047857' : req.status === 'IN_PROGRESS' ? '#0284c7' : '#b45309',
                      }}>{req.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}><AiStatusBadge status={req.aiProcessingStatus} /></td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button onClick={() => setSelectedRequest(req)} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '12px' }}>
                        <Eye size={14} /> Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateRequestModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onRequestCreated={handleRequestCreated} />
      <RequestDetailModal request={selectedRequest} isOpen={!!selectedRequest} onClose={() => setSelectedRequest(null)} currentUser={currentUser} onUpdated={handleRequestUpdated} />
    </div>
  );
};

export default StudentDashboard;
