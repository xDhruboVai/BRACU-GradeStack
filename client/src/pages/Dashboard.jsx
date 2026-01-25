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
  const [saveResult, setSaveResult] = useState(null);
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
    setSaveResult(null);
  };

  const handleUpload = async () => {
    if (!file || !userId) return;
    try {
      setIsUploading(true);
      const form = new FormData();
      form.append('file', file);
      form.append('userId', userId);
      const { data } = await axios.post(`${api}/parse-and-save`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSaveResult(data);
    } catch (err) {
      console.error('Save failed', err?.response?.data || err?.message);
      setSaveResult({ error: 'Failed to save to DB', details: err?.response?.data || err?.message });
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
              <button className="button glow" type="button" onClick={handleUpload} disabled={!file || !userId || isUploading}>
                {isUploading ? 'Uploading…' : 'Upload & Analyze'}
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                 <span className="text-muted">Major:</span>
                 <button type="button" className={`button ${major === 'CSE' ? 'glow' : ''}`} onClick={() => setUserMajor('CSE')}>CSE</button>
                 <button type="button" className={`button ${major === 'CS' ? 'glow' : ''}`} onClick={() => setUserMajor('CS')}>CS</button>
              </div>
            </div>

            {saveResult && !saveResult.error && (
              <div className="success" style={{ marginTop: '1rem', fontWeight: 'bold', color: '#4ade80' }}>
                ✅ Upload successful
              </div>
            )}
            {saveResult && saveResult.error && (
               <div className="panel" style={{ marginTop: '0.75rem', color: '#ef4444', borderColor: '#ef4444' }}>
                <h4 className="panel-title">Upload Error</h4>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(saveResult.error, null, 2)}</pre>
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
