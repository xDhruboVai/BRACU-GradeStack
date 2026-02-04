import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { supabase } from '../supabaseClient';
import { fetchAttempts, fetchSemesters } from '../api/analyzerApi';
import { totalCreditsRequired } from '../utils/cgpaMath';
import SmoothLineChart from '../components/SmoothLineChart';
import CreditsProgressEChart from '../components/CreditsProgressEChart';

const SESSION_KEY_PREFIX = 'gs.virtualSemester.v1:';

export default function Visuals() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [profile, setProfile] = useState({});
  const [attempts, setAttempts] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [virt, setVirt] = useState({ simCourses: [], simRetakes: [] });
  const [selectedTermDetail, setSelectedTermDetail] = useState(null); // { name, culprit }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate('/login');
        return;
      }
      const uid = data.session.user.id;
      setUserId(uid);
      
      const { data: profRes } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, student_id, major')
        .eq('user_id', uid)
        .maybeSingle();
      setProfile(profRes || {});
      
      try {
        const [att, sems] = await Promise.all([
          fetchAttempts(uid),
          fetchSemesters(uid),
        ]);
        setAttempts(Array.isArray(att) ? att : []);
        setSemesters(Array.isArray(sems) ? sems : []);
      } catch (_) {}
      
      try {
        const raw = sessionStorage.getItem(SESSION_KEY_PREFIX + uid);
        if (raw) {
          const j = JSON.parse(raw);
          setVirt({
            simCourses: Array.isArray(j?.simCourses) ? j.simCourses : [],
            simRetakes: Array.isArray(j?.simRetakes) ? j.simRetakes : [],
          });
        }
      } catch (_) {}
    });
  }, [navigate]);

  const latestAttempts = useMemo(() => attempts.filter(a => a.is_latest), [attempts]);
  const creditsEarned = useMemo(() => latestAttempts.reduce((s,a)=> s + (a.credit || 0), 0), [latestAttempts]);
  const required = useMemo(() => totalCreditsRequired(profile.major), [profile]);

  
  

  
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
    
    if ((virt.simCourses?.length || 0) + (virt.simRetakes?.length || 0)) {
      let vPoints = 0; let vCredits = 0;
      for (const c of (virt.simCourses || [])) { vPoints += Number(c.targetGpa || 0) * Number(c.credit || 3); vCredits += Number(c.credit || 3); }
      for (const r of (virt.simRetakes || [])) { vPoints += Number(r.targetGpa || 0) * Number(r.credit || 3); vCredits += Number(r.credit || 3); }
      const vg = vCredits > 0 ? Number((vPoints / vCredits).toFixed(2)) : null;
      rows = [...rows, { name: 'Virtual', gpa: vg, semester_id: null }];
    }
    return rows;
  }, [attempts, termNameById, virt]);

  
  const cgpaTrend = useMemo(() => {
    const sems = semesters.slice().sort((a,b)=> (a.term_index ?? 0) - (b.term_index ?? 0));
    let rows = sems.map(s => ({ name: s.name || `Term ${s.term_index}`, cgpa: (typeof s.cumulative_cgpa === 'number') ? Number(s.cumulative_cgpa.toFixed(2)) : null }));
    
    if ((virt.simCourses?.length || 0) + (virt.simRetakes?.length || 0)) {
      let points = 0; let credits = 0;
      for (const a of attempts.filter(a => a.is_latest && typeof a.credit === 'number' && typeof a.gpa === 'number')) {
        points += a.gpa * a.credit; credits += a.credit;
      }
      let vPoints = 0; let vCredits = 0;
      for (const c of (virt.simCourses || [])) { vPoints += Number(c.targetGpa || 0) * Number(c.credit || 3); vCredits += Number(c.credit || 3); }
      for (const r of (virt.simRetakes || [])) { vPoints += Number(r.targetGpa || 0) * Number(r.credit || 3); vCredits += Number(r.credit || 3); }
      const cLive = (credits + vCredits) > 0 ? Number(((points + vPoints) / (credits + vCredits)).toFixed(2)) : null;
      rows = [...rows, { name: 'Virtual', cgpa: cLive }];
    }
    return rows;
  }, [semesters, attempts, virt]);

  
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

  return (
    <AuthLayout title="Visual Analytics" subtitle="Credits progress and performance trends" noHero>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="button" type="button" onClick={() => navigate('/dashboard')} style={{ padding: '0.4rem 0.8rem' }}>← Back to Dashboard</button>
        </div>

        {}
        <section className="panel" style={{ textAlign: 'left' }}>
          <h3 className="panel-title">Credits Progress</h3>
          <div className="text-muted" style={{ marginBottom: '0.5rem' }}>
            {String(profile.major || '').toUpperCase()} requires {required} credits
          </div>
          <CreditsProgressEChart required={required} earned={creditsEarned} />
        </section>

        {/* GPA Trend */}
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
                const culprit = semester_id ? culpritForSemester(semester_id) : (virt.simCourses?.length || virt.simRetakes?.length) ? 'Virtual composition' : null;
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

        {}
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
    </AuthLayout>
  );
}
