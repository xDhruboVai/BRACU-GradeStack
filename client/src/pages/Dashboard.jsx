import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import '../styles/auth.css';

export default function Dashboard() {
  const navigate = useNavigate();
  
  const [userId, setUserId] = useState('');
  const [profile, setProfile] = useState({});
  const [major, setMajor] = useState('');
  const [file, setFile] = useState(null);
  const [saveResult, setSaveResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [blurInfo, setBlurInfo] = useState(false);
  // suggestions and course input are not used on Dashboard
  // current courses are now managed in the dedicated page
  const api = process.env.REACT_APP_API_URL;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate('/login');
      } else {
        const u = data.session.user;
        
        setUserId(u.id);
        
        axios.get(`${api}/profile/${u.id}`)
          .then(({ data: res }) => {
            if (res.profile) {
              setProfile(res.profile);
              setMajor(res.profile.major || '');
            }
          })
          .catch(err => console.error('Failed to load profile', err));
        
      }
    });
  }, [navigate, api]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const setUserMajor = async (newMajor) => {
    if (!userId) return;
    try {
      const { data } = await axios.put(`${api}/profile/${userId}`, { major: newMajor });
      setMajor(data?.profile?.major || newMajor);
      setProfile(prev => ({ ...prev, major: data?.profile?.major || newMajor }));
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
      if (data.profile) {
        setProfile(prev => ({ ...prev, ...data.profile }));
      }
      
    } catch (err) {
      console.error('Save failed', err?.response?.data || err?.message);
      setSaveResult({ error: 'Failed to save to DB', details: err?.response?.data || err?.message });
    } finally {
      setIsUploading(false);
    }
  };

  

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ paddingTop: '1rem', width: '100%', maxWidth: '1000px' }}>
        
        {}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'left' }}>
              
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  checked={blurInfo} 
                  onChange={(e) => setBlurInfo(e.target.checked)} 
                  style={{ accentColor: '#8a2be2' }}
                />
                Blur Info
              </label>

              <div style={{ fontSize: '0.95rem' }}>
                <span className="text-muted">Name: </span>
                <span style={{ filter: blurInfo ? 'blur(6px)' : 'none', transition: 'filter 0.2s' }}>
                  {profile.full_name || '—'}
                </span>
              </div>
              <div style={{ fontSize: '0.95rem' }}>
                <span className="text-muted">Student ID: </span>
                <span style={{ filter: blurInfo ? 'blur(6px)' : 'none', transition: 'filter 0.2s', fontFamily: 'monospace' }}>
                  {profile.student_id || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                 <span className="text-muted">Major:</span>
                 <div style={{ display: 'flex', gap: '0.25rem' }}>
                   <button 
                      type="button" 
                      onClick={() => setUserMajor('CSE')}
                      style={{ 
                        background: major === 'CSE' ? '#8a2be2' : '#333', 
                        border: 'none', 
                        color: 'white', 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      CSE
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setUserMajor('CS')}
                      style={{ 
                        background: major === 'CS' ? '#8a2be2' : '#333', 
                        border: 'none', 
                        color: 'white', 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      CS
                    </button>
                 </div>
              </div>

           </div>
           
           <button className="button" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={handleSignOut}>Sign Out</button>
        </div>

        {}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
          {}
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {}
            <section className="panel" style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3 className="panel-title">Upload Gradesheet</h3>
              {profile.last_parsed_at && (
                <span style={{ fontSize: '0.8rem', color: '#888' }}>
                  Last updated: {new Date(profile.last_parsed_at).toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-muted">Upload a gradesheet to start analyzing.</p>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <input type="file" accept="application/pdf" className="input" style={{ padding: '0.6rem', minWidth: '240px' }} onChange={onFileChange} />
              <button className="button glow" type="button" onClick={handleUpload} disabled={!file || !userId || isUploading}>
                {isUploading ? 'Uploading…' : 'Upload & Analyze'}
              </button>
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

            {}
            <section className="panel" style={{ textAlign: 'left' }}>
            <h3 className="panel-title">Gradesheet Analyzer</h3>
            <p className="text-muted">View parsed results, retakes, and KPIs.</p>
            <div style={{ marginTop: '0.75rem' }}>
              <Link className="button glow" to="/analyzer">Open Analyzer</Link>
            </div>
            </section>

            {}

            {}
            <section className="panel" style={{ textAlign: 'left' }}>
            <h3 className="panel-title">Marks Book</h3>
            <p className="text-muted">Plan ongoing assessments, targets, and track progress.</p>
            <div style={{ marginTop: '0.75rem' }}>
              <Link className="button glow" to="/marks-book">Open Marks Book</Link>
            </div>
            </section>
          </div>

          {}
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {}
            <section className="panel" style={{ textAlign: 'left' }}>
            <h3 className="panel-title">Courses in Current Semester</h3>
            <p className="text-muted">These will be added to Marks Book for your current term and used to simulate grades in the analyzer.</p>
            <div style={{ marginTop: '0.75rem' }}>
              <Link className="button glow" to="/current-courses">PRESS TO ADD THE COURSES</Link>
            </div>
            {}
            <div style={{ marginTop: '0.75rem' }}>
              {profile && userId && (
                <PreviewCurrentCourses userId={userId} api={api} />
              )}
            </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewCurrentCourses({ userId, api }) {
  const [list, setList] = React.useState([]);
  React.useEffect(() => {
    axios.get(`${api}/marks/current-courses/${userId}`)
      .then(({ data }) => setList(Array.isArray(data?.courses) ? data.courses : []))
      .catch(() => {});
  }, [userId, api]);
  if (!list.length) return null;
  const remove = async (id, code) => {
    try {
      await axios.delete(`${api}/marks/current-courses/${userId}/${id}`);
      const { data } = await axios.get(`${api}/marks/current-courses/${userId}`);
      setList(Array.isArray(data?.courses) ? data.courses : []);
    } catch (e) {
      
    }
  };
  return (
    <>
      {list.map((c) => (
        <span key={c.id} style={{ background: '#222', border: '1px solid #444', borderRadius: '16px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {c.course_code}
          <button type="button" title="Remove" onClick={() => remove(c.id, c.course_code)} style={{ background: 'transparent', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>
        </span>
      ))}
    </>
  );
}
