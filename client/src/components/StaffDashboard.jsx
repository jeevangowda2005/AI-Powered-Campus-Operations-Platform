import React, { useState, useEffect, useCallback } from 'react';
import Card from './Card';
import RequestDetailModal from './RequestDetailModal';
import { getStaffAnalyticsApi, getDepartmentsApi } from '../services/api';
import { getSocket } from '../services/socket';
import { 
  ClipboardList, 
  Clock, 
  CheckSquare, 
  Eye, 
  Filter, 
  RefreshCw,
  AlertTriangle,
  Layers,
  Inbox
} from 'lucide-react';

const StaffDashboard = ({ currentUser }) => {
  const [analytics, setAnalytics] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'recent'

  const [selectedRequest, setSelectedRequest] = useState(null);

  const fetchStaffData = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, deptRes] = await Promise.all([
        getStaffAnalyticsApi(),
        getDepartmentsApi(),
      ]);

      if (analyticsRes.success && analyticsRes.data) {
        setAnalytics(analyticsRes.data);
      }
      if (deptRes.success && deptRes.data?.departments) {
        setDepartments(deptRes.data.departments);
      }
    } catch (err) {
      console.error('Failed to fetch staff analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaffData();

    const socket = getSocket();
    if (!socket) return;

    // Change 3: Only refetch if event is relevant to staff member's department or assigned work
    const isRelevantToStaff = (evt) => {
      if (!evt) return false;
      const staffDept = analytics?.department?.id || currentUser.departmentId;
      const evtDept = evt.departmentId || evt.data?.departmentId || evt.data?.department?.id;
      const evtStaff = evt.assignedStaffId || evt.data?.assignedStaffId || evt.data?.assignedStaff?.id;

      if (staffDept && evtDept === staffDept) return true;
      if (evtStaff === currentUser.id) return true;
      // If unassigned request created or updated without department specified, check if staff department matches category or active queue
      if (evt.requestId && analytics?.activeRequests?.some((r) => r.id === evt.requestId)) return true;
      return false;
    };

    const handleEvent = (evt) => {
      if (isRelevantToStaff(evt)) {
        fetchStaffData();
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
  }, [fetchStaffData, currentUser?.id, currentUser?.departmentId]);

  const handleRequestUpdated = () => {
    fetchStaffData();
  };

  const summary = analytics?.summary || {
    total: 0,
    open: 0,
    assigned: 0,
    inProgress: 0,
    resolved: 0,
    highCritical: 0,
  };

  const priorityBreakdown = analytics?.priority || { low: 0, medium: 0, high: 0, critical: 0 };
  const categoryBreakdown = analytics?.category || {};
  const activeRequests = analytics?.activeRequests || [];
  const recentActivity = analytics?.recentActivity || [];

  const displayList = activeTab === 'active' ? activeRequests : recentActivity;

  return (
    <div style={{ marginTop: '24px' }}>
      {/* Header Banner */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>
          Staff Operations & Workload Dashboard
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {analytics?.department ? `Authorized Department: ${analytics.department.name}` : 'Department Work Queue & Operational Management'}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '24px' }}>
        <Card title="Total Department Requests" value={summary.total} icon={ClipboardList} colorClass="card-icon-blue" description="All department tickets" />
        <Card title="Open" value={summary.open} icon={Clock} colorClass="card-icon-orange" description="Awaiting assignment" />
        <Card title="Assigned" value={summary.assigned} icon={Layers} colorClass="card-icon-purple" description="Assigned work orders" />
        <Card title="In Progress" value={summary.inProgress} icon={Clock} colorClass="card-icon-blue" description="Active maintenance" />
        <Card title="Resolved" value={summary.resolved} icon={CheckSquare} colorClass="card-icon-green" description="Completed tasks" />
        <Card title="High / Critical" value={summary.highCritical} icon={AlertTriangle} colorClass="card-icon-red" description="Urgent priority tickets" />
      </div>

      {/* Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Priority Breakdown */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: '#1e293b' }}>Priority Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #94a3b8' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>LOW</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#334155' }}>{priorityBreakdown.low}</div>
            </div>
            <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600 }}>MEDIUM</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e40af' }}>{priorityBreakdown.medium}</div>
            </div>
            <div style={{ padding: '12px', background: '#fff7ed', borderRadius: '8px', borderLeft: '4px solid #f97316' }}>
              <div style={{ fontSize: '11px', color: '#c2410c', fontWeight: 600 }}>HIGH</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#9a3412' }}>{priorityBreakdown.high}</div>
            </div>
            <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600 }}>CRITICAL</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#991b1b' }}>{priorityBreakdown.critical}</div>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: '#1e293b' }}>Category Breakdown</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {Object.entries(categoryBreakdown).map(([cat, count]) => (
              <div key={cat} style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: count > 0 ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${count > 0 ? '#bfdbfe' : '#e2e8f0'}`,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ fontWeight: 600, color: count > 0 ? '#1d4ed8' : '#64748b' }}>{cat}</span>
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '99px',
                  backgroundColor: count > 0 ? '#2563eb' : '#cbd5e1',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 700
                }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Requests List Container */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setActiveTab('active')} 
              className={`btn ${activeTab === 'active' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              Active Requests ({activeRequests.length})
            </button>
            <button 
              onClick={() => setActiveTab('recent')} 
              className={`btn ${activeTab === 'recent' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              Recent Activity ({recentActivity.length})
            </button>
          </div>

          <button onClick={fetchStaffData} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '13px' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading operational queue...</div>
        ) : displayList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
            <Inbox size={32} style={{ margin: '0 auto 8px auto', display: 'block', color: '#94a3b8' }} />
            <p style={{ fontSize: '14px', fontWeight: 600 }}>No active requests for your department.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px' }}>Request Title</th>
                  <th style={{ padding: '12px' }}>Student</th>
                  <th style={{ padding: '12px' }}>Category</th>
                  <th style={{ padding: '12px' }}>Priority</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>Assigned Staff</th>
                  <th style={{ padding: '12px' }}>Created</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayList.map((req) => (
                  <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{req.title}</td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{req.student?.name}</td>
                    <td style={{ padding: '12px' }}>
                      <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>{req.category}</span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className="badge" style={{
                        backgroundColor: req.priority === 'CRITICAL' ? '#fef2f2' : req.priority === 'HIGH' ? '#fff7ed' : '#f8fafc',
                        color: req.priority === 'CRITICAL' ? '#ef4444' : req.priority === 'HIGH' ? '#ea580c' : '#475569'
                      }}>
                        {req.priority}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className="badge" style={{
                        backgroundColor: req.status === 'RESOLVED' || req.status === 'CLOSED' ? '#ecfdf5' : '#fffbeb',
                        color: req.status === 'RESOLVED' || req.status === 'CLOSED' ? '#047857' : '#b45309'
                      }}>
                        {req.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#64748b' }}>
                      {req.assignedStaff?.name || 'Unassigned'}
                    </td>
                    <td style={{ padding: '12px', color: '#64748b' }}>
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button onClick={() => setSelectedRequest(req)} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '12px' }}>
                        <Eye size={14} /> Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RequestDetailModal 
        request={selectedRequest} 
        isOpen={!!selectedRequest} 
        onClose={() => setSelectedRequest(null)} 
        currentUser={currentUser} 
        onUpdated={handleRequestUpdated} 
        departments={departments} 
      />
    </div>
  );
};

export default StaffDashboard;
