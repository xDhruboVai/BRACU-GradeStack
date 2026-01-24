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

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h1 className="auth-title">Dashboard</h1>
        <p className="auth-subtitle">Welcome{userEmail ? `, ${userEmail}` : ''}</p>

        <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
          <section style={{ textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Upload Gradesheet</h3>
            <p className="text-muted">Upload a gradesheet to start analyzing.</p>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.75rem' }}>
              <input type="file" accept="application/pdf" className="input" style={{ padding: '0.6rem' }} />
              <button className="button glow" type="button" disabled>Upload (wired soon)</button>
              <span className="text-muted">Major:</span>
              <button type="button" className="button glow" onClick={() => setUserMajor('CSE')}>CSE</button>
              <button type="button" className="button glow" onClick={() => setUserMajor('CS')}>CS</button>
              {major && <span className="text-muted">Current: {major}</span>}
            </div>
          </section>

          <section style={{ display: 'flex', gap: '0.75rem' }}>
            <Link className="button glow" to="/analyzer">Gradesheet Analyzer</Link>
            <Link className="button glow" to="/marks-book">Marks Book</Link>
            <button className="button" onClick={handleSignOut}>Sign Out</button>
          </section>
        </div>
      </div>
    </div>
  );
}
