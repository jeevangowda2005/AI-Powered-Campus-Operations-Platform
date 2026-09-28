import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Verifying Session...</div>
          <p style={{ fontSize: '14px' }}>Loading CampusOps workspace</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && (!user || !allowedRoles.includes(user.role))) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', padding: '24px' }}>
        <div className="auth-card" style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ShieldAlert size={28} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Access Forbidden (403)</h2>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
            Your account role (<strong>{user?.role}</strong>) does not have permission to view this section. Allowed roles: <strong>{allowedRoles.join(', ')}</strong>.
          </p>
          <button onClick={() => window.history.back()} className="btn btn-primary" style={{ width: '100%' }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
