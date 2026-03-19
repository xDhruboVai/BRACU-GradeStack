import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoMark from './LogoMark';
import '../styles/auth.css';
import { supabase } from '../supabaseClient';

export default function AuthLayout({ title, subtitle, children, noHero = false }) {
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

  const footerQuotes = [
    'Academic success is forged in fire and coffee.',
    'Plan with data, not panic.',
    'Small consistency beats last-minute heroics.',
    'One smart semester plan can change your whole CGPA.',
    'Discipline now, freedom later.',
    'Progress compounds when you track it.',
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
        
        setTimeout(() => setShowPrev(false), fadeMs);
        return next;
      });
    }, rotateMs);
    return () => clearInterval(id);
  }, [rotateMs, fadeMs, messages.length]);

  const current = messages[msgIndex];
  const previous = messages[prevIndex];
  const currentQuote = footerQuotes[msgIndex % footerQuotes.length];
  const previousQuote = footerQuotes[prevIndex % footerQuotes.length];
  const navigate = useNavigate();

  const onBrandClick = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      navigate(session ? '/dashboard' : '/login');
    } catch (err) {
      navigate('/login');
    }
  };
  return (
    <div className="auth-wrapper">
      {bgUrl ? <div className="bg-photo" style={{ backgroundImage: `url(${bgUrl})` }} /> : null}
      <div className="bg-aurora" />
      <div className="grid-overlay" />

      <div className="brand" onClick={onBrandClick} role="button" aria-label="Go to home" style={{ cursor: 'pointer' }}>
        <LogoMark size={40} />
        <div className="brand-text">
          <span className="brand-name">GradeStack</span>
          <span className="brand-tag">Analyze. Plan. Excel.</span>
        </div>
      </div>

      <div className={noHero ? "auth-container no-hero" : "auth-container"}>
        {!noHero && (
          <section className="hero" aria-live="polite">
            <div className="hero-stack" style={{ '--heroFadeMs': `${fadeMs}ms` }}>
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
        )}

        <div className="auth-card glass" style={{ width: noHero ? '100%' : undefined }}>
          <div className="card-header">
            <div>
              <h1 className="auth-title">{title}</h1>
              {subtitle && <p className="auth-subtitle">{subtitle}</p>}
            </div>
          </div>

          {children}
        </div>
      </div>

      <footer className="auth-footer auth-footer-rich">
        <div className="footer-rich-left">
          <div className="footer-rich-author">Built by Dihan Islam Dhrubo</div>
          <div className="footer-rich-links">
            <a className="footer-rich-link" href="https://github.com/xDhruboVai/BRACU-Gradesheet-Analyzer-CSE-" target="_blank" rel="noreferrer">GitHub Repo</a>
            <a className="footer-rich-link" href="https://www.linkedin.com/in/dihan-islam-dhrubo-79a904249/" target="_blank" rel="noreferrer">LinkedIn</a>
            <a className="footer-rich-link" href="https://www.facebook.com/dihanislam.dhrubo.5/" target="_blank" rel="noreferrer">Facebook</a>
          </div>
          <div className="footer-rich-links">
            <a className="footer-rich-link" href="https://forms.gle/U4yiB45m8vSDAwU3A" target="_blank" rel="noreferrer">Suggest / Report</a>
          </div>
        </div>
        <div className="footer-rich-right" aria-live="polite">
          <div className="footer-quote-stack" style={{ '--heroFadeMs': `${fadeMs}ms` }}>
            {showPrev && (
              <div className="footer-quote-layer hero-out">
                {previousQuote}
              </div>
            )}
            <div key={`footer-quote-${msgIndex}`} className="footer-quote-layer hero-in">
              {currentQuote}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
