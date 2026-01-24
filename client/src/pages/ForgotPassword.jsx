import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import AuthLayout from '../components/AuthLayout';
import '../styles/auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Please enter your email.');
      return;
    }

    setLoading(true);
    const redirectTo = `${window.location.origin}/reset`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Password reset email sent. Please check your inbox.');
    }
  };

  return (
    <AuthLayout title="Forgot password" subtitle="We'll email you a reset link">
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

        <button className="button glow" type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send Reset Link'}
        </button>
      </form>

      <div className="helper">
        <Link className="link" to="/login">Back to login</Link>
      </div>
    </AuthLayout>
  );
}
