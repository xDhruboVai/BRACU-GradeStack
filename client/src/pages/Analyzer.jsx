import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { supabase } from '../supabaseClient';
import { fetchAttempts, fetchSemesters, fetchSuggestions, fetchCurrentCourses } from '../api/analyzerApi';
import { computeCGPA, totalCreditsRequired, maxProjection } from '../utils/cgpaMath';

const SESSION_KEY_PREFIX = 'gs.virtualSemester.v1:';

export default function Analyzer() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('courseRetake'); // future: cgpaPlanner, codPlanner, visuals, etc.

  // Auth
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data
  const [suggestions, setSuggestions] = useState([]); // [{code, title}]
  const [matrix, setMatrix] = useState([]); // current-term courses [{id, course_code, title, credit}]
  const [attempts, setAttempts] = useState([]); // all attempts
  const [semesters, setSemesters] = useState([]);

  // Virtual semester (session)
  const [simCourses, setSimCourses] = useState([]); // [{code, credit, targetGpa}]
  const [simRetakes, setSimRetakes] = useState([]); // [{code, credit, targetGpa}]
  const [retakeSet, setRetakeSet] = useState(() => new Set());

  // Inputs
  const [courseCodeInput, setCourseCodeInput] = useState('');
  const [courseGpaInput, setCourseGpaInput] = useState('4.0');
  const [retakeCodeInput, setRetakeCodeInput] = useState('');
  const [retakeGpaInput, setRetakeGpaInput] = useState('4.0');

  // Load session-backed virtual semester
  const loadSession = (uid) => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY_PREFIX + uid);
      if (!raw) return;
      const j = JSON.parse(raw);
      setSimCourses(Array.isArray(j?.simCourses) ? j.simCourses : []);
      setSimRetakes(Array.isArray(j?.simRetakes) ? j.simRetakes : []);
      setRetakeSet(new Set((j?.simRetakes || []).map((r) => r.code)));
    } catch (_) {}
  };
  const saveSession = (uid, next) => {
    try {
      sessionStorage.setItem(SESSION_KEY_PREFIX + uid, JSON.stringify({
        simCourses: next?.simCourses ?? simCourses,
        simRetakes: next?.simRetakes ?? simRetakes,
      }));
    } catch (_) {}
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }
      const uid = data.session.user.id;
      setUserId(uid);
      loadSession(uid);
      try {
        const [sugs, cur, att, sems] = await Promise.all([
          fetchSuggestions(uid),
          fetchCurrentCourses(uid),
          fetchAttempts(uid),
          fetchSemesters(uid),
        ]);
        setSuggestions(Array.isArray(sugs) ? sugs : []);
        setMatrix(Array.isArray(cur) ? cur : []);
        setAttempts(Array.isArray(att) ? att : []);
        setSemesters(Array.isArray(sems) ? sems : []);
      } catch (e) {
        console.error(e);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    });
    // Clear session when tab unloads (optional; sessionStorage usually clears on full tab close)
    const handleUnload = () => {
      if (userId) sessionStorage.removeItem(SESSION_KEY_PREFIX + userId);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latestAttempts = useMemo(() => attempts.filter((a) => a.is_latest), [attempts]);
  const retakeCandidates = useMemo(() => {
    return latestAttempts
      .filter((a) => typeof a.gpa === 'number' && a.gpa < 4.0)
      .sort((a, b) => a.gpa - b.gpa);
  }, [latestAttempts]);

  // Baseline points and credits
  const baseline = useMemo(() => {
    const latestByCourse = {};
    let credits = 0;
    let points = 0;
    for (const a of latestAttempts) {
      const code = String(a.course_code || '').toUpperCase();
      latestByCourse[code] = { gpa: a.gpa, credit: a.credit };
      if (typeof a.gpa === 'number' && typeof a.credit === 'number') {
        credits += a.credit;
        points += a.gpa * a.credit;
      }
    }
    return { latestByCourse, credits, points };
  }, [latestAttempts]);

  const creditForCode = (code, fallback) => {
    if (!code) return fallback ?? 3;
    const up = String(code).toUpperCase();
    if (up === 'CSE400') return 4; // special-case per constraint
    return typeof fallback === 'number' ? fallback : 3;
  };

  const computeLiveMetrics = () => {
    let points = baseline.points;
    let credits = baseline.credits;

    // Apply retakes: replace course contribution with target GPA
    for (const r of simRetakes) {
      const code = String(r.code || '').toUpperCase();
      const base = baseline.latestByCourse[code];
      const credit = creditForCode(code, base?.credit);
      const prevPoints = (typeof base?.gpa === 'number' && typeof credit === 'number') ? (base.gpa * credit) : 0;
      points = points - prevPoints + (Number(r.targetGpa) * credit);
      if (!(typeof base?.credit === 'number')) {
        credits += credit;
      }
    }

    // Apply new simulated courses
    for (const c of simCourses) {
      const credit = creditForCode(c.code, c.credit);
      points += Number(c.targetGpa) * credit;
      credits += credit;
    }

    const cgpa = credits > 0 ? Number((points / credits).toFixed(2)) : null;
    const earned = baseline.credits;
    const termsCount = semesters.length;
    const retakesCount = attempts.filter((a) => a.is_retake).length;

    // Max projection should reflect simulated overlay (live points/credits)
    const proj = maxProjection({ major: null }, credits, points);

    return { cgpa, credits, earned, termsCount, retakesCount, remaining: proj.remaining, maxCgpa: proj.maxCgpa };
  };

  const addSimCourse = () => {
    const code = String(courseCodeInput || '').toUpperCase().trim();
    if (!code) return;
    const allowed = new Set(suggestions.map((s) => s.code));
    if (!allowed.has(code)) return; // strictly within suggestions
    if (simCourses.find((c) => c.code === code)) return; // no duplicates
    const credit = creditForCode(code);
    const targetGpa = Math.max(0, Math.min(4, Number(courseGpaInput || 0)));
    const next = [...simCourses, { code, credit, targetGpa }];
    setSimCourses(next);
    saveSession(userId, { simCourses: next });
    setCourseCodeInput('');
    setCourseGpaInput('4.0');
  };

  const addSimRetake = () => {
    const code = String(retakeCodeInput || '').toUpperCase().trim();
    if (!code) return;
    const base = baseline.latestByCourse[code];
    if (!base || typeof base.gpa !== 'number') return;
    if (retakeSet.has(code)) return; // one retake per course
    const credit = creditForCode(code, base.credit);
    const targetGpa = Math.max(0, Math.min(4, Number(retakeGpaInput || 0)));
    const next = [...simRetakes, { code, credit, targetGpa }];
    setSimRetakes(next);
    const rs = new Set(retakeSet);
    rs.add(code);
    setRetakeSet(rs);
    saveSession(userId, { simRetakes: next });
    setRetakeCodeInput('');
    setRetakeGpaInput('4.0');
  };

  const removeSimCourse = (code) => {
    const next = simCourses.filter((c) => c.code !== code);
    setSimCourses(next);
    saveSession(userId, { simCourses: next });
  };
  const removeSimRetake = (code) => {
    const next = simRetakes.filter((c) => c.code !== code);
    setSimRetakes(next);
    const rs = new Set(retakeSet);
    rs.delete(code);
    setRetakeSet(rs);
    saveSession(userId, { simRetakes: next });
  };

  const TabButton = ({ id, label }) => (
    <button
      className="button"
      type="button"
      onClick={() => setActiveTab(id)}
      style={{ padding: '0.5rem 0.9rem', marginRight: '0.5rem', opacity: activeTab === id ? 1 : 0.85 }}
    >
      {label}
    </button>
  );

  return (
    <AuthLayout title="Analyzer" subtitle="Simulate courses and retakes; see live impact." noHero>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div className="sticky-tabs">
          <TabButton id="courseRetake" label="Courses & Retake" />
          {/* Future: <TabButton id="cgpaPlanner" label="CGPA Planner" /> */}
          {/* Future: <TabButton id="visuals" label="Visual Analytics" /> */}
          <div style={{ marginLeft: 'auto' }}>
            <button className="button" type="button" onClick={() => navigate('/dashboard')}>
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {loading && <div className="panel">Loading…</div>}
        {error && <div className="error">{error}</div>}

        {!loading && !error && activeTab === 'courseRetake' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {/* Live KPIs at top */}
            <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem' }}>
              {(() => { const lm = computeLiveMetrics(); return (
                <>
                  <div><div className="text-muted">Live CGPA</div><h2 style={{ margin: 0 }}>{lm.cgpa ?? '-'}</h2></div>
                  <div><div className="text-muted">Credits (live)</div><h2 style={{ margin: 0 }}>{lm.credits}</h2></div>
                  <div><div className="text-muted">Credits Earned</div><h2 style={{ margin: 0 }}>{lm.earned}</h2></div>
                  <div><div className="text-muted">Terms</div><h2 style={{ margin: 0 }}>{lm.termsCount}</h2></div>
                  <div><div className="text-muted">Retakes</div><h2 style={{ margin: 0 }}>{lm.retakesCount}</h2></div>
                  <div><div className="text-muted">Max Projection</div><h2 style={{ margin: 0 }}>{lm.maxCgpa ?? '-'}</h2></div>
                </>
              ); })()}
            </div>

            {/* Matrix of current-term courses */}
            <div className="panel">
              <h3 className="panel-title">Current-Term Courses</h3>
              {matrix.length === 0 ? (
                <p className="text-muted">No courses saved for the current term.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {matrix.map((c) => (
                    <div key={c.id} style={{ background: '#1f1f1f', border: '1px solid #333', borderRadius: 12, padding: '8px 10px' }}>
                      <strong>{c.course_code}</strong>
                      <div className="text-muted" style={{ fontSize: '0.85rem' }}>{c.title || '—'}</div>
                      <div style={{ fontSize: '0.85rem' }}>{typeof c.credit === 'number' ? `${c.credit} cr` : '—'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Simulate adding a course */}
            <div className="panel">
              <h3 className="panel-title">Simulate a Course</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  list="sugg-list"
                  className="input"
                  placeholder="Select course code"
                  value={courseCodeInput}
                  onChange={(e) => setCourseCodeInput(e.target.value)}
                  style={{ minWidth: 220 }}
                />
                <datalist id="sugg-list">
                  {suggestions.map((s) => (
                    <option key={s.code} value={s.code}>{s.title ? `${s.code} — ${s.title}` : s.code}</option>
                  ))}
                </datalist>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="4"
                  className="input"
                  value={courseGpaInput}
                  onChange={(e) => setCourseGpaInput(e.target.value)}
                  style={{ width: 110 }}
                />
                <button className="button" type="button" onClick={addSimCourse} disabled={!courseCodeInput}>Add Course</button>
              </div>
              {simCourses.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {simCourses.map((c) => (
                    <span key={c.code} style={{ background: '#222', border: '1px solid #444', borderRadius: 16, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <strong>{c.code}</strong>
                      <span className="text-muted" style={{ fontSize: '0.85rem' }}>{c.credit} cr • GPA {c.targetGpa}</span>
                      <button type="button" onClick={() => removeSimCourse(c.code)} style={{ background: 'transparent', border: 'none', color: '#bbb', cursor: 'pointer' }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Simulate a retake */}
            <div className="panel">
              <h3 className="panel-title">Simulate a Retake</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select className="input" value={retakeCodeInput} onChange={(e) => setRetakeCodeInput(e.target.value)} style={{ minWidth: 220 }}>
                  <option value="">Select a course (GPA &lt; 4.0)</option>
                  {retakeCandidates.map((a) => (
                    <option key={a.course_code} value={String(a.course_code).toUpperCase()} disabled={retakeSet.has(String(a.course_code).toUpperCase())}>
                      {String(a.course_code).toUpperCase()} — GPA {a.gpa}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="4"
                  className="input"
                  value={retakeGpaInput}
                  onChange={(e) => setRetakeGpaInput(e.target.value)}
                  style={{ width: 110 }}
                />
                <button className="button" type="button" onClick={addSimRetake} disabled={!retakeCodeInput}>Retake Course</button>
              </div>
              {simRetakes.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {simRetakes.map((c) => (
                    <span key={c.code} style={{ background: '#222', border: '1px solid #444', borderRadius: 16, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <strong>{c.code}</strong>
                      <span className="text-muted" style={{ fontSize: '0.85rem' }}>{c.credit} cr • New GPA {c.targetGpa}</span>
                      <button type="button" onClick={() => removeSimRetake(c.code)} style={{ background: 'transparent', border: 'none', color: '#bbb', cursor: 'pointer' }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* KPIs moved to top; removed bottom instance */}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
