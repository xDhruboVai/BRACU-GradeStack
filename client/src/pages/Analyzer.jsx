import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { supabase } from '../supabaseClient';
import { fetchAttempts, fetchSemesters, fetchSuggestions, fetchCurrentCourses, fetchMarksSummary } from '../api/analyzerApi';
import SmoothLineChart from '../components/SmoothLineChart';
import CreditsProgressEChart from '../components/CreditsProgressEChart';
import UnlockedCoursesGraph from '../components/UnlockedCoursesGraph';
import { totalCreditsRequired, maxProjection } from '../utils/cgpaMath';

const SESSION_KEY_PREFIX = 'gs.virtualSemester.v1:';

export default function Analyzer() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('courseRetake'); 

  
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data
  const [suggestions, setSuggestions] = useState([]); // [{code, title}]
  const [matrix, setMatrix] = useState([]); // current-term courses [{id, course_code, title, credit}]
  const [marksSummary, setMarksSummary] = useState([]); // [{course_code, total_marks}]
  const [attempts, setAttempts] = useState([]); // all attempts
  const [semesters, setSemesters] = useState([]);
  const [profileMajor, setProfileMajor] = useState('CSE');
  const [selectedTermDetail, setSelectedTermDetail] = useState(null); 

  
  const [simCourses, setSimCourses] = useState([]); 
  const [simRetakes, setSimRetakes] = useState([]); 
  const [retakeSet, setRetakeSet] = useState(() => new Set());

  
  const [courseCodeInput, setCourseCodeInput] = useState('');
  const [courseGpaInput, setCourseGpaInput] = useState('4.0');
  const [retakeCodeInput, setRetakeCodeInput] = useState('');
  const [retakeGpaInput, setRetakeGpaInput] = useState('4.0');

  
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
        
        try {
          const sum = await fetchMarksSummary(uid);
          setMarksSummary(Array.isArray(sum) ? sum : []);
        } catch (_) {
          setMarksSummary([]);
        }
        
        try {
          const { data: profRes } = await supabase
            .from('user_profiles')
            .select('major')
            .eq('user_id', uid)
            .maybeSingle();
          setProfileMajor((profRes && profRes.major) ? profRes.major : 'CSE');
        } catch (_) {}
      } catch (e) {
        console.error(e);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    });
    
    const handleUnload = () => {
      if (userId) sessionStorage.removeItem(SESSION_KEY_PREFIX + userId);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
    
  }, []);

  const latestAttempts = useMemo(() => attempts.filter((a) => a.is_latest), [attempts]);
  const doneCodes = useMemo(() => {
    const deny = new Set(['F','W','I']);
    return latestAttempts
      .filter((a) => !deny.has(String(a.grade || '').toUpperCase()))
      .map((a) => String(a.course_code || '').toUpperCase());
  }, [latestAttempts]);
  const retakeCandidates = useMemo(() => {
    return latestAttempts
      .filter((a) => typeof a.gpa === 'number' && a.gpa < 4.0)
      .sort((a, b) => a.gpa - b.gpa);
  }, [latestAttempts]);

  
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
    if (up === 'CSE400') return 4; 
    return typeof fallback === 'number' ? fallback : 3;
  };

  const computeLiveMetrics = () => {
    let points = baseline.points;
    let credits = baseline.credits;

    
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

    
    for (const c of simCourses) {
      const credit = creditForCode(c.code, c.credit);
      points += Number(c.targetGpa) * credit;
      credits += credit;
    }

    const cgpa = credits > 0 ? Number((points / credits).toFixed(2)) : null;
    const earned = baseline.credits;
    const termsCount = semesters.length;
    const retakesCount = attempts.filter((a) => a.is_retake).length;

    
    const proj = maxProjection({ major: null }, credits, points);

    return { cgpa, credits, earned, termsCount, retakesCount, remaining: proj.remaining, maxCgpa: proj.maxCgpa };
  };

  
  const creditsEarned = useMemo(() => latestAttempts.reduce((s,a)=> s + (a.credit || 0), 0), [latestAttempts]);
  const required = useMemo(() => totalCreditsRequired(profileMajor), [profileMajor]);
  

  const termNameById = useMemo(() => {
    const m = {};
    for (const s of semesters) m[s.id] = s.name || `Term ${s.term_index}`;
    return m;
  }, [semesters]);

  const gpaTrend = useMemo(() => {
    const acc = {};
    for (const a of attempts) {
      if (!a.semester_id || typeof a.gpa !== 'number' || typeof a.credit !== 'number') continue;
      const name = termNameById[a.semester_id] || String(a.semester_id);
      acc[name] = acc[name] || { name, points: 0, credits: 0, semester_id: a.semester_id };
      acc[name].points += a.gpa * a.credit;
      acc[name].credits += a.credit;
    }
    let rows = Object.values(acc).map(r => ({ name: r.name, gpa: r.credits > 0 ? Number((r.points / r.credits).toFixed(2)) : null, semester_id: r.semester_id }));
    
    if ((simCourses.length || 0) + (simRetakes.length || 0)) {
      let vPoints = 0; let vCredits = 0;
      for (const c of (simCourses || [])) { vPoints += Number(c.targetGpa || 0) * Number(c.credit || 3); vCredits += Number(c.credit || 3); }
      for (const r of (simRetakes || [])) { vPoints += Number(r.targetGpa || 0) * Number(r.credit || 3); vCredits += Number(r.credit || 3); }
      const vg = vCredits > 0 ? Number((vPoints / vCredits).toFixed(2)) : null;
      rows = [...rows, { name: 'Virtual', gpa: vg, semester_id: null }];
    }
    return rows;
  }, [attempts, termNameById, simCourses, simRetakes]);

  const cgpaTrend = useMemo(() => {
    const sems = semesters.slice().sort((a,b)=> (a.term_index ?? 0) - (b.term_index ?? 0));
    let rows = sems.map(s => ({ name: s.name || `Term ${s.term_index}`, cgpa: (typeof s.cumulative_cgpa === 'number') ? Number(s.cumulative_cgpa.toFixed(2)) : null }));
    if ((simCourses.length || 0) + (simRetakes.length || 0)) {
      let points = 0; let credits = 0;
      for (const a of attempts.filter(a => a.is_latest && typeof a.credit === 'number' && typeof a.gpa === 'number')) {
        points += a.gpa * a.credit; credits += a.credit;
      }
      let vPoints = 0; let vCredits = 0;
      for (const c of (simCourses || [])) { vPoints += Number(c.targetGpa || 0) * Number(c.credit || 3); vCredits += Number(c.credit || 3); }
      for (const r of (simRetakes || [])) { vPoints += Number(r.targetGpa || 0) * Number(r.credit || 3); vCredits += Number(r.credit || 3); }
      const cLive = (credits + vCredits) > 0 ? Number(((points + vPoints) / (credits + vCredits)).toFixed(2)) : null;
      rows = [...rows, { name: 'Virtual', cgpa: cLive }];
    }
    return rows;
  }, [semesters, attempts, simCourses, simRetakes]);

  const culpritForSemester = (semester_id) => {
    const list = attempts.filter(a => a.semester_id === semester_id && typeof a.gpa === 'number' && typeof a.credit === 'number');
    if (!list.length) return null;
    let worst = null; let worstScore = -Infinity;
    for (const a of list) {
      const score = (4 - a.gpa) * a.credit; 
      if (score > worstScore) { worstScore = score; worst = a; }
    }
    if (!worst || worstScore <= 0) return 'All courses at 4.0';
    return `${String(worst.course_code).toUpperCase()} — GPA ${worst.gpa}`;
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
    if (retakeSet.has(code)) return; 
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
          {}
          <TabButton id="unlocked" label="Unlocked" />
          <TabButton id="visuals" label="Visual Analytics" />
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
            {}
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

            {}
            <div className="panel">
              <h3 className="panel-title">Current-Term Courses</h3>
              {matrix.length === 0 ? (
                <p className="text-muted">No courses saved for the current term.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {matrix.map((c) => (
                    <div key={c.id} style={{ background: '#1f1f1f', border: '1px solid #333', borderRadius: 12, padding: '8px 10px' }}>
                      <strong>{c.course_code}</strong>
                      <div className="text-muted" style={{ fontSize: '0.85rem' }}>{c.title || '---'}</div>
                      <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                        <span className="text-muted">Marks - </span>
                        {(() => {
                          const rec = marksSummary.find((m) => String(m.course_code).toUpperCase() === String(c.course_code).toUpperCase());
                          return (typeof rec?.total_marks === 'number' && Number.isFinite(rec.total_marks)) ? rec.total_marks : '---';
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {}
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

            {}
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

            {}
          </div>
        )}

        {!loading && !error && activeTab === 'visuals' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <section className="panel" style={{ textAlign: 'left' }}>
              <h3 className="panel-title">Credits Progress</h3>
              <CreditsProgressEChart required={required} earned={creditsEarned} />
            </section>

            <section className="panel" style={{ textAlign: 'left' }}>
              <h3 className="panel-title">GPA Trend</h3>
              <div style={{ width: '100%', height: 300 }}>
                <SmoothLineChart
                  data={gpaTrend.map(r => ({ name: r.name, value: r.gpa, semester_id: r.semester_id }))}
                  valueKey="value"
                  label="GPA"
                  color="#60a5fa"
                  yDomain={[0,4]}
                  onPointClick={({ name, semester_id }) => {
                    const culprit = semester_id ? culpritForSemester(semester_id) : (simCourses.length || simRetakes.length) ? 'Virtual composition' : null;
                    setSelectedTermDetail(culprit ? { name, culprit } : null);
                  }}
                />
              </div>
              {selectedTermDetail && (
                <div className="panel" style={{ marginTop: '0.75rem' }}>
                  <div className="text-muted">Pivot: {selectedTermDetail.name}</div>
                  <div>Course causing minimizing deviation: {selectedTermDetail.culprit}</div>
                </div>
              )}
            </section>

            <section className="panel" style={{ textAlign: 'left' }}>
              <h3 className="panel-title">CGPA Trend</h3>
              <div style={{ width: '100%', height: 300 }}>
                <SmoothLineChart
                  data={cgpaTrend.map(r => ({ name: r.name, value: r.cgpa }))}
                  valueKey="value"
                  label="CGPA"
                  color="#34d399"
                  yDomain={[0,4]}
                />
              </div>
            </section>
          </div>
        )}

        {!loading && !error && activeTab === 'unlocked' && (
          <UnlockedCoursesGraph
            doneCodes={doneCodes}
            currentCodes={(matrix || []).map((c) => String(c.course_code || '').toUpperCase()).filter(Boolean)}
          />
        )}
      </div>
    </AuthLayout>
  );
}
