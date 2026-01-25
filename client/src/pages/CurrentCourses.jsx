import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthLayout from '../components/AuthLayout';

export default function CurrentCourses() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [courseInput, setCourseInput] = useState('');
  const [currentCourses, setCurrentCourses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedList, setSavedList] = useState([]);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', text: string }
  const api = process.env.REACT_APP_API_URL;

  useEffect(() => {
    // lazy import to avoid circular
    import('../supabaseClient').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) {
          navigate('/login');
        } else {
          const u = data.session.user;
          setUserId(u.id);
          axios.get(`${api}/courses/suggestions/${u.id}`).then(({ data }) => {
            const meta = Array.isArray(data?.meta) ? data.meta : [];
            setSuggestions(meta);
          }).catch(() => {});
          axios.get(`${api}/marks/current-courses/${u.id}`).then(({ data }) => {
            setSavedList(Array.isArray(data?.courses) ? data.courses : []);
          }).catch(() => {});
        }
      });
    });
  }, [navigate, api]);

  const addCourse = () => {
    const code = String(courseInput || '').toUpperCase().trim();
    if (!code) return;
    if (currentCourses.includes(code)) return;
    if (currentCourses.length >= 5) return;
    const allowedCodes = suggestions.map((s) => s.code);
    if (allowedCodes.length && !allowedCodes.includes(code)) return;
    setCurrentCourses((prev) => [...prev, code]);
    setCourseInput('');
  };

  const removeCourse = (code) => {
    setCurrentCourses((prev) => prev.filter((c) => c !== code));
  };

  const save = async () => {
    if (!userId || currentCourses.length === 0) return;
    try {
      setSaving(true);
      const { data } = await axios.post(`${api}/marks/current-courses`, { userId, courseCodes: currentCourses });
      if (data?.success) {
        // refresh saved list
        const res = await axios.get(`${api}/marks/current-courses/${userId}`);
        setSavedList(Array.isArray(res?.data?.courses) ? res.data.courses : []);
        setCurrentCourses([]);
        setToast({ type: 'success', text: '✅ Current courses saved' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      // minimal error handling
      console.error(err);
      setToast({ type: 'error', text: '❌ Failed to save courses' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout title="Current Semester Courses" subtitle="These will be added to Marks Book and used by the Analyzer." noHero>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            className="button"
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{ padding: '0.4rem 0.8rem' }}
          >
            ← Back to Dashboard
          </button>
        </div>
        {toast && (
          <div
            className="panel"
            style={{
              borderColor: toast.type === 'success' ? '#22c55e' : '#ef4444',
              color: toast.type === 'success' ? '#22c55e' : '#ef4444',
            }}
          >
            {toast.text}
          </div>
        )}
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              list="course-suggestions-list"
              value={courseInput}
              onChange={(e) => setCourseInput(e.target.value)}
              placeholder="Type course code (e.g., CSE220)"
              className="input"
              style={{ minWidth: 220 }}
            />
            <datalist id="course-suggestions-list">
              {suggestions.map((s) => (
                <option key={s.code} value={s.code}>{s.title ? `${s.code} — ${s.title}` : s.code}</option>
              ))}
            </datalist>
            <button className="button" type="button" onClick={addCourse} disabled={!courseInput || currentCourses.length >= 5}>Add</button>
            <span className="text-muted">Max 5 courses</span>
          </div>

          {currentCourses.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {currentCourses.map((code) => (
                <span key={code} style={{ background: '#222', border: '1px solid #444', borderRadius: '16px', padding: '4px 10px' }}>
                  {code}
                  <button type="button" onClick={() => removeCourse(code)} style={{ marginLeft: 8, background: 'transparent', color: '#bbb', border: 'none', cursor: 'pointer' }}>×</button>
                </span>
              ))}
            </div>
          )}

          <div style={{ marginTop: '0.75rem' }}>
            <button className="button glow" type="button" disabled={saving || currentCourses.length === 0} onClick={save}>
              {saving ? 'Saving…' : 'Save Current Courses'}
            </button>
          </div>
        </div>

        {savedList.length > 0 && (
          <div>
            <h4 className="panel-title">Saved for Current Term</h4>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              {savedList.map((c) => (
                <div key={c.id} style={{ background: '#1f1f1f', border: '1px solid #333', borderRadius: 18, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'grid' }}>
                    <strong>{c.course_code}</strong>
                    {c.title ? <span style={{ fontSize: '0.85rem', color: '#888' }}>{c.title}</span> : null}
                  </div>
                  {typeof c.credit === 'number' ? <span style={{ color: '#aaa' }}>• {c.credit} cr</span> : null}
                  <button
                    type="button"
                    title="Remove"
                    onClick={async () => {
                      try {
                        await axios.delete(`${api}/marks/current-courses/${userId}/${c.id}`);
                        const res = await axios.get(`${api}/marks/current-courses/${userId}`);
                        setSavedList(Array.isArray(res?.data?.courses) ? res.data.courses : []);
                        setToast({ type: 'success', text: `Removed ${c.course_code}` });
                        setTimeout(() => setToast(null), 2500);
                      } catch (err) {
                        setToast({ type: 'error', text: 'Failed to remove course' });
                        setTimeout(() => setToast(null), 3500);
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
