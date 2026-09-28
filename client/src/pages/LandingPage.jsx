import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Zap, Sparkles } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="landing-hero">
      <nav className="landing-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="sidebar-logo">CO</div>
          <span style={{ fontSize: '20px', fontWeight: 800 }}>Campus<span style={{ color: '#60a5fa' }}>Ops</span></span>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Link to="/login" className="btn btn-outline" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}>
            Sign In
          </Link>
          <Link to="/register" className="btn btn-primary">
            Get Started
          </Link>
        </div>
      </nav>

      <div className="landing-body">
        <div className="landing-pill">
          <Sparkles size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          Sprint 1 — Foundation Release
        </div>

        <h1 className="landing-headline">
          AI-Powered Campus Operations & Incident Resolution
        </h1>

        <p className="landing-sub">
          Modern enterprise operations platform designed for automated routing, intelligent service requests, and real-time campus facility management.
        </p>

        <div className="landing-ctas">
          <Link to="/dashboard" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '16px' }}>
            Open Operations Dashboard <ArrowRight size={18} />
          </Link>
        </div>
      </div>

      <footer style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        © 2026 Campus Operations Platform — All rights reserved.
      </footer>
    </div>
  );
};

export default LandingPage;
