import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import '../styles/auth.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [major, setMajor] = useState('');
  const [file, setFile] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const api = process.env.REACT_APP_API_URL;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate('/login');
      } else {
        const u = data.session.user;
        setUserEmail(u.email || '');
        setUserId(u.id);
      }
    });
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const setUserMajor = async (newMajor) => {
    if (!userId) return;
    try {
      const { data } = await axios.put(`${api}/profile/${userId}`, { major: newMajor });
      setMajor(data?.profile?.major || newMajor);
    } catch (err) {
      console.error('Failed to update major', err?.message);
    }
  };

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setParseResult(null);
  };

  const uploadAndParse = async () => {
    if (!file) return;
    try {
      setIsUploading(true);
      const form = new FormData();
      form.append('file', file);
      const { data } = await axios.post(`${api}/parse`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setParseResult(data);
    } catch (err) {
      console.error('Parse failed', err?.response?.data || err?.message);
      setParseResult({ error: 'Failed to parse PDF', details: err?.response?.data || err?.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ paddingTop: '1rem' }}>
        {/* Top-right sign out for a cleaner header */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="button" onClick={handleSignOut}>Sign Out</button>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem', marginTop: '0.5rem' }}>
          {/* Section 1: Upload Gradesheet */}
          <section className="panel" style={{ textAlign: 'left' }}>
            <h3 className="panel-title">Upload Gradesheet</h3>
            <p className="text-muted">Upload a gradesheet to start analyzing.</p>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <input type="file" accept="application/pdf" className="input" style={{ padding: '0.6rem', minWidth: '240px' }} onChange={onFileChange} />
              <button className="button glow" type="button" onClick={uploadAndParse} disabled={!file || isUploading}>{isUploading ? 'Parsing…' : 'Upload & Parse'}</button>
              <span className="text-muted">Major:</span>
              <button type="button" className="button glow" onClick={() => setUserMajor('CSE')}>CSE</button>
              <button type="button" className="button glow" onClick={() => setUserMajor('CS')}>CS</button>
              {major && <span className="text-muted">Current: {major} (you can change this later)</span>}
            </div>
            {parseResult && !parseResult.error && (
              <div className="panel" style={{ marginTop: '0.75rem' }}>
                <h4 className="panel-title">Parsed Summary</h4>
                <p className="text-muted">Name: {parseResult?.profile?.full_name || '—'}</p>
                <p className="text-muted">Student ID: {parseResult?.profile?.student_id || '—'}</p>
                <p className="text-muted">Semesters: {parseResult?.semesters?.length ?? 0}</p>
                <p className="text-muted">Attempts: {parseResult?.course_attempts?.length ?? 0}</p>
              </div>
            )}
            {parseResult && parseResult.error && (
              <div className="panel" style={{ marginTop: '0.75rem', color: '#c00' }}>
                <h4 className="panel-title">Parsing Error</h4>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(parseResult, null, 2)}</pre>
              </div>
            )}
          </section>

          {/* Section 2: Analyzer */}
          <section className="panel" style={{ textAlign: 'left' }}>
            <h3 className="panel-title">Gradesheet Analyzer</h3>
            <p className="text-muted">View parsed results, retakes, and KPIs.</p>
            <div style={{ marginTop: '0.75rem' }}>
              <Link className="button glow" to="/analyzer">Open Analyzer</Link>
            </div>
          </section>

          {/* Section 3: Marks Book */}
          <section className="panel" style={{ textAlign: 'left' }}>
            <h3 className="panel-title">Marks Book</h3>
            <p className="text-muted">Plan ongoing assessments, targets, and track progress.</p>
            <div style={{ marginTop: '0.75rem' }}>
              <Link className="button glow" to="/marks-book">Open Marks Book</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
