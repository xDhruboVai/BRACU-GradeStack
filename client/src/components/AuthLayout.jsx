import React, { useEffect, useState } from 'react';
import LogoMark from './LogoMark';
import '../styles/auth.css';

export default function AuthLayout({ title, subtitle, children }) {
  const bgUrl = process.env.REACT_APP_AUTH_BG_URL;
  const rotateMs = Number(process.env.REACT_APP_HERO_ROTATE_MS || 6000);
  const fadeMs = Number(process.env.REACT_APP_HERO_FADE_MS || 900);

  const messages = [
    { title: 'Master your grades', copy: 'Play Hollow Knight' },
    { title: 'Boost your GPA, not just your FPS', copy: 'Queue up study combos and nail those critical hits.' },
    { title: 'Grades + Games = GG', copy: 'Min-max your semester like a skill tree for S-tier outcomes.' },
    { title: 'Checkpoint: Midterms', copy: 'Save progress early, avoid boss-level procrastination later.' },
    { title: 'No RNG, just GPA', copy: 'Plan with data, not dice rolls; precision beats luck.' },
    { title: 'Homework crit chance +20%', copy: 'Bhai please nijer assignment nije kor.' },
    { title: 'Curves belong on racetracks', copy: 'Beat the curve with prep and smart routing, not panic.' },
    { title: 'Final boss: Finals', copy: 'We’ll buff you with insights and perfectly timed cooldowns.' },
    { title: 'Speedrun your semester (responsibly)', copy: 'Route courses, optimize credits, skip the filler side quests.' },
    { title: 'Skill tree: Scholar', copy: 'Unlock better habits, stack credits, and level up your GPA.' }
  ];

  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * messages.length));
  const [prevIndex, setPrevIndex] = useState(msgIndex);
  const [showPrev, setShowPrev] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((i) => {
        setPrevIndex(i);
        setShowPrev(true);
        const next = (i + 1) % messages.length;
        // hide previous after fade completes
        setTimeout(() => setShowPrev(false), fadeMs);
        return next;
      });
    }, rotateMs);
    return () => clearInterval(id);
  }, [rotateMs, fadeMs, messages.length]);

  const current = messages[msgIndex];
  const previous = messages[prevIndex];
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
        <section className="hero" aria-live="polite">
          <div className="hero-stack" style={{ ['--heroFadeMs']: `${fadeMs}ms` }}>
            {showPrev && (
              <div className="hero-layer hero-out">
                <h2 className="hero-title">{previous.title}</h2>
                <p className="hero-copy">{previous.copy}</p>
              </div>
            )}
            <div key={msgIndex} className="hero-layer hero-in">
              <h2 className="hero-title">{current.title}</h2>
              <p className="hero-copy">{current.copy}</p>
            </div>
          </div>
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
