import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import AuthLayout from '../components/AuthLayout';
import '../styles/auth.css';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score; // 0-4
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Account created. Please check your email to confirm.');
      // Optionally redirect after confirmation is handled
      // navigate('/login');
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Join GradeStack">
      {error && <div className="error" role="alert">{error}</div>}
      {success && <div className="success" role="status">{success}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="input-label" htmlFor="email">Email</label>
        <div className="input-group">
          <span className="input-icon">@</span>
          <input
            id="email"
            className="input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <label className="input-label" htmlFor="password">Password</label>
        <div className="input-group">
          <span className="input-icon">• • •</span>
          <input
            id="password"
            className="input"
            type="password"
            placeholder="At least 8 chars, mix recommended"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="divider" aria-hidden>
          <span className="text-muted">Password strength: {['Very weak','Weak','Okay','Strong','Excellent'][strength]}</span>
        </div>

        <label className="input-label" htmlFor="confirm">Confirm password</label>
        <div className="input-group">
          <span className="input-icon">✔</span>
          <input
            id="confirm"
            className="input"
            type="password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <button className="button glow" type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Sign Up'}
        </button>
      </form>

      <div className="helper">
        <span className="text-muted">Already have an account?</span>
        <Link className="link" to="/login">Sign in</Link>
      </div>
    </AuthLayout>
  );
}
