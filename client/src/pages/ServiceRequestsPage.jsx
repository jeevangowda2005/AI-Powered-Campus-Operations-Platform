import React, { useState, useEffect, useRef, useCallback } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import CreateRequestModal from '../components/CreateRequestModal';
import RequestDetailModal from '../components/RequestDetailModal';
import AiStatusBadge from '../components/AiStatusBadge';
import { getMyRequestsApi, getStudentAnalyticsApi } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import Card from '../components/Card';
import {
  FilePlus,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Filter,
  RefreshCw,
  ListFilter,
  CheckCircle2,
  Inbox,
} from 'lucide-react';

const ServiceRequestsPage = () => {
  const { user } = useAuth();

  const [requests, setRequests] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const requestsRef = useRef([]);
  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const [analyticsRes, requestsRes] = await Promise.all([
        getStudentAnalyticsApi(),
        getMyRequestsApi(params),
      ]);

      if (analyticsRes.success && analyticsRes.data) setAnalytics(analyticsRes.data);
      if (requestsRes.success && requestsRes.data?.requests) setRequests(requestsRes.data.requests);
    } catch (err) {
      console.error('Failed to fetch service requests:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, priorityFilter]);

  useEffect(() => {
    fetchData(true);

    const socket = getSocket();
    if (!socket) return;

    const isRelevant = (evt) => {
      if (!evt) return false;
      const evtStudentId = evt.studentId || evt.data?.studentId || evt.data?.student?.id;
      if (evtStudentId && user && evtStudentId === user.id) return true;
      if (evt.requestId && requestsRef.current.some((r) => r.id === evt.requestId)) return true;
      return false;
    };

    const handleEvent = (evt) => {
      if (isRelevant(evt)) {
        if (evt.data && evt.data.id) {
          setRequests((prev) => prev.map((r) => r.id === evt.data.id ? { ...r, ...evt.data } : r));
        }
        fetchData(false);
      }
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
  }, [fetchData, user]);

  const handleRequestCreated = (newReq) => {
    if (newReq) setRequests((prev) => [newReq, ...prev.filter((r) => r.id !== newReq.id)]);
    fetchData(false);
  };

  const handleRequestUpdated = () => fetchData(false);

  const summary = analytics?.summary || { total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0 };

  return (
    <DashboardLayout title="Service Requests">
      {/* Summary Metric Cards */}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: '24px' }}>
        <Card title="Total" value={summary.total} icon={ListFilter} colorClass="card-icon-blue" description="All tickets" />
        <Card title="Open" value={summary.open} icon={AlertCircle} colorClass="card-icon-orange" description="Awaiting pickup" />
        <Card title="In Progress" value={summary.inProgress} icon={Clock} colorClass="card-icon-purple" description="Active work" />
        <Card title="Resolved" value={summary.resolved} icon={CheckCircle} colorClass="card-icon-green" description="Completed" />
        <Card title="Closed" value={summary.closed} icon={CheckCircle2} colorClass="card-icon-gray" description="Archived" />
      </div>

      {/* Request Table Card */}
      <div className="card">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: '#64748b' }} />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>My Service Requests</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-input" style={{ padding: '6px 12px', fontSize: '13px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
            <select className="form-input" style={{ padding: '6px 12px', fontSize: '13px' }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              <option value="IT">IT</option>
              <option value="ELECTRICAL">ELECTRICAL</option>
              <option value="PLUMBING">PLUMBING</option>
              <option value="CLEANING">CLEANING</option>
              <option value="SECURITY">SECURITY</option>
              <option value="CLASSROOM">CLASSROOM</option>
              <option value="HOSTEL">HOSTEL</option>
              <option value="TRANSPORT">TRANSPORT</option>
              <option value="OTHER">OTHER</option>
            </select>
            <select className="form-input" style={{ padding: '6px 12px', fontSize: '13px' }} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">All Priorities</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <button onClick={() => fetchData(true)} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '13px' }}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
            <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
              <FilePlus size={15} /> New Request
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading requests...</div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
            <Inbox size={32} style={{ margin: '0 auto 8px auto', display: 'block', color: '#94a3b8' }} />
            <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>No service requests yet.</p>
            <p style={{ fontSize: '12px' }}>Click &ldquo;New Request&rdquo; to submit a maintenance ticket.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px' }}>Request Title</th>
                  <th style={{ padding: '12px' }}>Category</th>
                  <th style={{ padding: '12px' }}>Priority</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>Department</th>
                  <th style={{ padding: '12px' }}>Submitted</th>
                  <th style={{ padding: '12px' }}>AI</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{req.title}</td>
                    <td style={{ padding: '12px' }}>
                      <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>{req.category}</span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className="badge" style={{
                        backgroundColor: req.priority === 'CRITICAL' ? '#fef2f2' : req.priority === 'HIGH' ? '#fff7ed' : '#f8fafc',
                        color: req.priority === 'CRITICAL' ? '#ef4444' : req.priority === 'HIGH' ? '#ea580c' : '#475569',
                      }}>{req.priority}</span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className="badge" style={{
                        backgroundColor: req.status === 'RESOLVED' || req.status === 'CLOSED' ? '#ecfdf5' : req.status === 'IN_PROGRESS' ? '#f0f9ff' : '#fffbeb',
                        color: req.status === 'RESOLVED' || req.status === 'CLOSED' ? '#047857' : req.status === 'IN_PROGRESS' ? '#0284c7' : '#b45309',
                      }}>{req.status}</span>
                    </td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{req.department?.name || 'Unassigned'}</td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{new Date(req.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '12px' }}><AiStatusBadge status={req.aiProcessingStatus} /></td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
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
      <RequestDetailModal request={selectedRequest} isOpen={!!selectedRequest} onClose={() => setSelectedRequest(null)} currentUser={user} onUpdated={handleRequestUpdated} />
    </DashboardLayout>
  );
};

export default ServiceRequestsPage;
