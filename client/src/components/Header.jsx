import React from 'react';
import StatusBadge from './StatusBadge';
import { useAuth } from '../context/AuthContext';
import { LogOut, User } from 'lucide-react';

const Header = ({ title, backendStatus }) => {
  const { user, logout } = useAuth();

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="header">
      <h1 className="header-title">{title}</h1>

      <div className="header-actions">
        <StatusBadge status={backendStatus} />

        {user && (
          <div className="user-profile">
            <div className="user-avatar">{getInitials(user.name)}</div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role" style={{ color: '#2563eb', fontWeight: 600 }}>
                {user.role}
              </span>
            </div>

            <button 
              onClick={logout} 
              className="btn btn-outline" 
              style={{ padding: '6px 10px', marginLeft: '12px' }}
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
