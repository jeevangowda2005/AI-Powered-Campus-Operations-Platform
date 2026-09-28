import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  FileText, 
  Building2, 
  Users, 
  LogOut,
  ShieldCheck
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">CO</div>
        <div className="sidebar-brand">
          Campus<span>Ops</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink 
          to="/requests" 
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <FileText size={18} />
          <span>Service Requests</span>
        </NavLink>

        <NavLink 
          to="#" 
          onClick={(e) => e.preventDefault()}
          className="sidebar-link"
          style={{ opacity: 0.6, cursor: 'not-allowed' }}
          title="Sprint 3 Feature"
        >
          <Building2 size={18} />
          <span>Departments</span>
        </NavLink>

        {user && user.role === 'ADMIN' && (
          <NavLink 
            to="#" 
            onClick={(e) => e.preventDefault()}
            className="sidebar-link"
            style={{ opacity: 0.6, cursor: 'not-allowed' }}
            title="Admin Feature"
          >
            <Users size={18} />
            <span>User Management</span>
          </NavLink>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
          <button 
            onClick={logout} 
            className="sidebar-link"
            style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div>Role: <strong>{user?.role || 'Guest'}</strong></div>
        <div style={{ fontSize: '11px', marginTop: '2px', color: '#64748b' }}>CampusOps v1.0 (Sprint 2)</div>
      </div>
    </aside>
  );
};

export default Sidebar;
