import React, { useEffect, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import StudentDashboard from '../components/StudentDashboard';
import StaffDashboard from '../components/StaffDashboard';
import AdminDashboard from '../components/AdminDashboard';
import { useAuth } from '../context/AuthContext';
import { checkHealth, testRoleApi } from '../services/api';
import { 
  ShieldCheck, 
  Server, 
  RefreshCw
} from 'lucide-react';

const DashboardPage = () => {
  const { user } = useAuth();
  const [backendStatus, setBackendStatus] = useState('loading');
  const [apiMessage, setApiMessage] = useState('');
  const [lastChecked, setLastChecked] = useState(null);

  const [rbacTestResults, setRbacTestResults] = useState({
    student: null,
    staff: null,
    admin: null,
  });

  const fetchHealth = async () => {
    setBackendStatus('loading');
    try {
      const data = await checkHealth();
      if (data && data.success) {
        setBackendStatus('connected');
        setApiMessage(data.message || 'Campus Operations API is running');
      } else {
        setBackendStatus('offline');
        setApiMessage('Unexpected response structure');
      }
    } catch (error) {
      setBackendStatus('offline');
      setApiMessage('Backend server unreachable');
    } finally {
      setLastChecked(new Date().toLocaleTimeString());
    }
  };

  const handleTestRbac = async (roleType) => {
    setRbacTestResults((prev) => ({
      ...prev,
      [roleType]: { status: 'loading', message: 'Testing permission...' },
    }));

    try {
      const res = await testRoleApi(roleType);
      setRbacTestResults((prev) => ({
        ...prev,
        [roleType]: { status: 'success', message: res.message, code: 200 },
      }));
    } catch (error) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.message || 'Access Denied';
      setRbacTestResults((prev) => ({
        ...prev,
        [roleType]: { status: 'denied', message, code: status },
      }));
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <DashboardLayout title="Operations Workspace" backendStatus={backendStatus}>
      {/* Current Logged-in User Profile Banner */}
      <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '18px' }}>
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{user?.name || 'Authenticated User'}</h2>
                <span className="badge" style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>
                  {user?.role}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
                Email: {user?.email} • User ID: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{user?.id}</code>
              </p>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            🔒 Authenticated via JWT Session
          </div>
        </div>
      </div>

      {/* Role-Based Dynamic Section */}
      {user?.role === 'STUDENT' && <StudentDashboard currentUser={user} />}
      {user?.role === 'STAFF' && <StaffDashboard currentUser={user} />}
      {user?.role === 'ADMIN' && <AdminDashboard currentUser={user} />}

      {/* Interactive RBAC Verification Panel */}
      <div className="card" style={{ marginTop: '32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div className="card-icon-wrap card-icon-purple">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
              Live RBAC Permission Test Panel
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Click endpoints below to test backend role middleware verification (`/api/test/*`).
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Student Endpoint Test */}
          <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>GET /api/test/student</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>STUDENT, STAFF, ADMIN</span>
            </div>
            <button 
              onClick={() => handleTestRbac('student')} 
              className="btn btn-outline" 
              style={{ width: '100%', fontSize: '13px', padding: '6px 12px', marginBottom: '10px' }}
            >
              Test Student Endpoint
            </button>
            {rbacTestResults.student && (
              <div style={{ fontSize: '12px', padding: '8px 10px', borderRadius: '6px', background: rbacTestResults.student.status === 'success' ? '#f0fdf4' : '#fef2f2', color: rbacTestResults.student.status === 'success' ? '#166534' : '#991b1b', border: `1px solid ${rbacTestResults.student.status === 'success' ? '#bbf7d0' : '#fecaca'}` }}>
                <strong>{rbacTestResults.student.code}:</strong> {rbacTestResults.student.message}
              </div>
            )}
          </div>

          {/* Staff Endpoint Test */}
          <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>GET /api/test/staff</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>STAFF, ADMIN</span>
            </div>
            <button 
              onClick={() => handleTestRbac('staff')} 
              className="btn btn-outline" 
              style={{ width: '100%', fontSize: '13px', padding: '6px 12px', marginBottom: '10px' }}
            >
              Test Staff Endpoint
            </button>
            {rbacTestResults.staff && (
              <div style={{ fontSize: '12px', padding: '8px 10px', borderRadius: '6px', background: rbacTestResults.staff.status === 'success' ? '#f0fdf4' : '#fef2f2', color: rbacTestResults.staff.status === 'success' ? '#166534' : '#991b1b', border: `1px solid ${rbacTestResults.staff.status === 'success' ? '#bbf7d0' : '#fecaca'}` }}>
                <strong>{rbacTestResults.staff.code}:</strong> {rbacTestResults.staff.message}
              </div>
            )}
          </div>

          {/* Admin Endpoint Test */}
          <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>GET /api/test/admin</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>ADMIN ONLY</span>
            </div>
            <button 
              onClick={() => handleTestRbac('admin')} 
              className="btn btn-outline" 
              style={{ width: '100%', fontSize: '13px', padding: '6px 12px', marginBottom: '10px' }}
            >
              Test Admin Endpoint
            </button>
            {rbacTestResults.admin && (
              <div style={{ fontSize: '12px', padding: '8px 10px', borderRadius: '6px', background: rbacTestResults.admin.status === 'success' ? '#f0fdf4' : '#fef2f2', color: rbacTestResults.admin.status === 'success' ? '#166534' : '#991b1b', border: `1px solid ${rbacTestResults.admin.status === 'success' ? '#bbf7d0' : '#fecaca'}` }}>
                <strong>{rbacTestResults.admin.code}:</strong> {rbacTestResults.admin.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backend API Health Status */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Server size={18} style={{ color: '#2563eb' }} />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Backend Connection Status</span>
          </div>
          <button onClick={fetchHealth} className="btn btn-outline" style={{ fontSize: '12px', padding: '4px 10px' }}>
            <RefreshCw size={12} className={backendStatus === 'loading' ? 'spin' : ''} /> Refresh
          </button>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          API Response: <strong>"{apiMessage}"</strong> {lastChecked && `(Checked at ${lastChecked})`}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
