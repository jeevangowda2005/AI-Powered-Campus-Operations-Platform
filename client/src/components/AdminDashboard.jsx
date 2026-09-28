import React, { useState, useEffect, useCallback } from 'react';
import Card from './Card';
import RequestDetailModal from './RequestDetailModal';
import { getAdminAnalyticsApi, getDepartmentsApi } from '../services/api';
import { getSocket } from '../services/socket';
import { 
  ShieldCheck, 
  Building, 
  Activity, 
  Eye, 
  Filter, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Brain,
  AlertTriangle,
  Inbox,
  Calendar
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';

const STATUS_COLORS = {
  OPEN: '#f97316',
  ASSIGNED: '#a855f7',
  IN_PROGRESS: '#0284c7',
  RESOLVED: '#10b981',
  CLOSED: '#64748b'
};

const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#64748b'];

const AdminDashboard = ({ currentUser }) => {
  const [analytics, setAnalytics] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [dateRange, setDateRange] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [selectedRequest, setSelectedRequest] = useState(null);

  const fetchAdminAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (dateRange) params.dateRange = dateRange;
      if (dateRange === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (departmentFilter) params.departmentId = departmentFilter;

      const [adminRes, deptRes] = await Promise.all([
        getAdminAnalyticsApi(params),
        getDepartmentsApi(),
      ]);

      if (adminRes.success && adminRes.data) {
        setAnalytics(adminRes.data);
      }
      if (deptRes.success && deptRes.data?.departments) {
        setDepartments(deptRes.data.departments);
      }
    } catch (err) {
      console.error('Failed to fetch admin analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, dateRange, startDate, endDate, statusFilter, categoryFilter, priorityFilter, departmentFilter]);

  useEffect(() => {
    fetchAdminAnalytics();

    const socket = getSocket();
    if (!socket) return;

    const handleEvent = () => {
      fetchAdminAnalytics();
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
  }, [fetchAdminAnalytics]);

  const handleRequestUpdated = () => {
    fetchAdminAnalytics();
  };

  const summary = analytics?.summary || {
    total: 0,
    open: 0,
    assigned: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    highCritical: 0,
  };

  const aiSummary = analytics?.aiSummary || { PENDING: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 };
  const pagination = analytics?.pagination || { page: 1, limit: 10, totalCount: 0, totalPages: 1 };
  const recentRequests = analytics?.recentRequests || [];
  const departmentWorkload = analytics?.departmentWorkload || [];
  const requestTrend = analytics?.requestTrend || [];

  // Transform Status Distribution for Pie Chart
  const statusPieData = Object.entries(analytics?.statusDistribution || {}).map(([name, value]) => ({
    name,
    value,
  })).filter((item) => item.value > 0);

  // Transform Category Distribution for Bar Chart
  const categoryBarData = Object.entries(analytics?.categoryDistribution || {}).map(([name, count]) => ({
    name,
    count,
  }));

  return (
    <div style={{ marginTop: '24px' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>
          Master Operations & System-Wide Analytics Dashboard
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Comprehensive operational metrics, AI processing status, department workloads, and paginated master ticket history.
        </p>
      </div>

      {/* Summary Metrics Grid */}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: '24px' }}>
        <Card title="Total System Requests" value={summary.total} icon={ShieldCheck} colorClass="card-icon-blue" description="All recorded tickets" />
        <Card title="Open" value={summary.open} icon={Activity} colorClass="card-icon-orange" description="Pending triage" />
        <Card title="Assigned" value={summary.assigned} icon={Building} colorClass="card-icon-purple" description="Routed to staff/dept" />
        <Card title="In Progress" value={summary.inProgress} icon={Activity} colorClass="card-icon-blue" description="Active work" />
        <Card title="Resolved" value={summary.resolved} icon={ShieldCheck} colorClass="card-icon-green" description="Completed" />
        <Card title="High / Critical" value={summary.highCritical} icon={AlertTriangle} colorClass="card-icon-red" description="Urgent priority" />
      </div>

      {/* AI Processing Summary Banner Card */}
      <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)', border: '1px solid #cbd5e1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Brain size={18} style={{ color: '#7e22ce' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Background AI Processing Summary</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '10px 14px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#854d0e', fontWeight: 600 }}>PENDING</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#a16207' }}>{aiSummary.PENDING}</div>
          </div>
          <div style={{ padding: '10px 14px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600 }}>PROCESSING</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#2563eb' }}>{aiSummary.PROCESSING}</div>
          </div>
          <div style={{ padding: '10px 14px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>COMPLETED</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#15803d' }}>{aiSummary.COMPLETED}</div>
          </div>
          <div style={{ padding: '10px 14px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600 }}>FAILED</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>{aiSummary.FAILED}</div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Status Distribution Pie Chart */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: '#1e293b' }}>Request Status Distribution</h3>
          {statusPieData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No data available</div>
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {statusPieData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Category Distribution Bar Chart */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: '#1e293b' }}>Category Distribution</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={categoryBarData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {categoryBarData.map((entry, index) => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Workload Bar Chart */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: '#1e293b' }}>Department Workload Comparison</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={departmentWorkload} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="open" name="Open" fill="#f97316" stackId="a" />
                <Bar dataKey="inProgress" name="In Progress" fill="#0284c7" stackId="a" />
                <Bar dataKey="resolved" name="Resolved" fill="#10b981" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Time Series Request Trend Line Chart */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: '#1e293b' }}>Request Trend (Over Time)</h3>
          {requestTrend.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No timeline data</div>
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={requestTrend} margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Tickets" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Department Workload Table */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: '#1e293b' }}>Department Operations Summary</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px' }}>Department</th>
                <th style={{ padding: '10px' }}>Total Tickets</th>
                <th style={{ padding: '10px' }}>Open</th>
                <th style={{ padding: '10px' }}>In Progress</th>
                <th style={{ padding: '10px' }}>Resolved / Closed</th>
                <th style={{ padding: '10px' }}>High / Critical</th>
              </tr>
            </thead>
            <tbody>
              {departmentWorkload.map((dept) => (
                <tr key={dept.id || 'unassigned'} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{dept.name}</td>
                  <td style={{ padding: '10px', fontWeight: 700 }}>{dept.total}</td>
                  <td style={{ padding: '10px', color: '#f97316' }}>{dept.open}</td>
                  <td style={{ padding: '10px', color: '#0284c7' }}>{dept.inProgress}</td>
                  <td style={{ padding: '10px', color: '#10b981' }}>{dept.resolved}</td>
                  <td style={{ padding: '10px', color: '#ef4444' }}>{dept.highCritical}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Master Request List & Filtering */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: '#64748b' }} />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Master Filters & Controls</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Date Range Selector */}
            <select className="form-input" style={{ padding: '6px 10px', fontSize: '12px' }} value={dateRange} onChange={(e) => { setDateRange(e.target.value); setPage(1); }}>
              <option value="">All Time</option>
              <option value="today">Today</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
              <option value="thismonth">This Month</option>
              <option value="custom">Custom Range...</option>
            </select>

            {dateRange === 'custom' && (
              <>
                <input type="date" className="form-input" style={{ padding: '4px 8px', fontSize: '12px' }} value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
                <span style={{ fontSize: '12px', color: '#64748b' }}>to</span>
                <input type="date" className="form-input" style={{ padding: '4px 8px', fontSize: '12px' }} value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
              </>
            )}

            <select className="form-input" style={{ padding: '6px 10px', fontSize: '12px' }} value={departmentFilter} onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}>
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select className="form-input" style={{ padding: '6px 10px', fontSize: '12px' }} value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
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

            <select className="form-input" style={{ padding: '6px 10px', fontSize: '12px' }} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CLOSED">CLOSED</option>
            </select>

            <select className="form-input" style={{ padding: '6px 10px', fontSize: '12px' }} value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
              <option value="">All Priorities</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>

            <button onClick={fetchAdminAnalytics} className="btn btn-outline" style={{ padding: '6px 10px', fontSize: '12px' }}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* Master Request Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading master analytics list...</div>
        ) : recentRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
            <Inbox size={32} style={{ margin: '0 auto 8px auto', display: 'block', color: '#94a3b8' }} />
            <p style={{ fontSize: '14px', fontWeight: 600 }}>No requests found for the selected filters.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px' }}>Title</th>
                    <th style={{ padding: '12px' }}>Category</th>
                    <th style={{ padding: '12px' }}>Priority</th>
                    <th style={{ padding: '12px' }}>Department</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Submitted</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.map((req) => (
                    <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{req.title}</td>
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
                        <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>
                          {req.department?.name || 'Unassigned'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span className="badge" style={{
                          backgroundColor: req.status === 'RESOLVED' || req.status === 'CLOSED' ? '#ecfdf5' : '#eff6ff',
                          color: req.status === 'RESOLVED' || req.status === 'CLOSED' ? '#047857' : '#1d4ed8'
                        }}>
                          {req.status}
                        </span>
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

            {/* Pagination Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.totalCount} total items)
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setPage((p) => Math.max(1, p - 1))} 
                  disabled={pagination.page <= 1} 
                  className="btn btn-outline" 
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button 
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} 
                  disabled={pagination.page >= pagination.totalPages} 
                  className="btn btn-outline" 
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
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

export default AdminDashboard;
