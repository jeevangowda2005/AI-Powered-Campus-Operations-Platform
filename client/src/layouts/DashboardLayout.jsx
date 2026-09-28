import React from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

/**
 * Reusable Dashboard Layout
 * Wraps pages with Sidebar, Header, and Main Content Area
 */
const DashboardLayout = ({ children, title = 'Dashboard', backendStatus }) => {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-wrapper">
        <Header title={title} backendStatus={backendStatus} />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
