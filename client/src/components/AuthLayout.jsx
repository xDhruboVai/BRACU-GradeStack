import React from 'react';
import LogoMark from './LogoMark';
import '../styles/auth.css';

export default function AuthLayout({ title, subtitle, children }) {
  const bgUrl = process.env.REACT_APP_AUTH_BG_URL;
  return (
    <div className="auth-wrapper">
      {bgUrl ? <div className="bg-photo" style={{ backgroundImage: `url(${bgUrl})` }} /> : null}
      <div className="bg-aurora" />
      <div className="grid-overlay" />

      <div className="brand">
        <LogoMark size={40} />
        <div className="brand-text">
          <span className="brand-name">GradeStack</span>
          <span className="brand-tag">Analyze. Plan. Excel.</span>
        </div>
      </div>

      <div className="auth-container">
        <section className="hero">
          <h2 className="hero-title">Master your grades</h2>
          <p className="hero-copy">Analyze transcripts, track progress, and plan semesters — all in a sleek dark neon workspace.</p>
        </section>

        <div className="auth-card glass">
          <div className="card-header">
            <LogoMark size={44} />
            <div>
              <h1 className="auth-title">{title}</h1>
              {subtitle && <p className="auth-subtitle">{subtitle}</p>}
            </div>
          </div>

          {children}
        </div>
      </div>

      <footer className="auth-footer">
        <span className="text-muted">© {new Date().getFullYear()} GradeStack</span>
        <div className="footer-links">
          <button type="button" className="link" style={{ background: 'transparent', border: 'none', padding: 0 }}>Privacy</button>
          <button type="button" className="link" style={{ background: 'transparent', border: 'none', padding: 0 }}>Terms</button>
        </div>
      </footer>
    </div>
  );
}
