import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import AuthLayout from '../components/AuthLayout';
import '../styles/auth.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter a new password.');
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
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Password updated. Redirecting to login…');
      setTimeout(() => navigate('/login'), 1200);
    }
  };

  return (
    <AuthLayout title="Reset password" subtitle="Set your new password">
      {error && <div className="error" role="alert">{error}</div>}
      {success && <div className="success" role="status">{success}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="input-label" htmlFor="password">New password</label>
        <div className="input-group">
          <span className="input-icon">• • •</span>
          <input
            id="password"
            className="input"
            type="password"
            placeholder="Enter new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
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
          {loading ? 'Updating…' : 'Update Password'}
        </button>
      </form>

      <div className="helper">
        <Link className="link" to="/login">Back to login</Link>
      </div>
    </AuthLayout>
  );
}
