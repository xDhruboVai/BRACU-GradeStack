import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthLayout from '../components/AuthLayout';

export default function CurrentCourses() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [courseInput, setCourseInput] = useState('');
  // current courses are managed server-side; local state removed
  const [saving, setSaving] = useState(false);
  const [savedList, setSavedList] = useState([]);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', text: string }
  const api = process.env.REACT_APP_API_URL;

  useEffect(() => {
    
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

  const addCourse = async () => {
    const code = String(courseInput || '').toUpperCase().trim();
    if (!code) return;
    const allowedCodes = suggestions.map((s) => s.code);
    if (allowedCodes.length && !allowedCodes.includes(code)) return;
    // prevent duplicates and enforce max 5 without separate save
    const existing = savedList.map((c) => String(c.course_code || '').toUpperCase());
    if (existing.includes(code)) { setCourseInput(''); return; }
    const combined = Array.from(new Set([code, ...existing]));
    if (combined.length > 5) {
      setToast({ type: 'error', text: '❌ Maximum 5 courses total' });
      setTimeout(() => setToast(null), 3500);
      return;
    }
    try {
      setSaving(true);
      const { data } = await axios.post(`${api}/marks/current-courses`, { userId, courseCodes: combined });
      if (data?.success) {
        const res = await axios.get(`${api}/marks/current-courses/${userId}`);
        setSavedList(Array.isArray(res?.data?.courses) ? res.data.courses : []);
        setToast({ type: 'success', text: `✅ Added ${code}` });
        setTimeout(() => setToast(null), 2500);
      }
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', text: '❌ Failed to add course' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
      setCourseInput('');
    }
  };

  // removeCourse and local list are deprecated; removal happens server-side in Saved list

  // save button removed; addCourse immediately persists

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
            <button className="button" type="button" onClick={addCourse} disabled={!courseInput || saving || savedList.length >= 5}>Add</button>
            <span className="text-muted">Max 5 courses</span>
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
                  {}
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
