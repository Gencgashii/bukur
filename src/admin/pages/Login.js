import React, { useState } from 'react';
import { api, setCsrf } from '../api';
import { Msg } from '../components/ui';
import '../admin.css';

export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.login(email.trim(), password);
      setCsrf(r.csrfToken);
      setPassword('');
      onLoggedIn(r.admin);
    } catch (err) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-login">
      <form className="ad-login__card" onSubmit={submit}>
        <div className="ad-brand ad-brand--lg">BUKUR<span>ADMIN</span></div>
        <p className="ad-login__sub">Sign in to manage the BUKUR store.</p>
        <label className="ad-field">
          <span className="ad-field__label">Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="ad-field">
          <span className="ad-field__label">Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <Msg kind="error">{error}</Msg>
        <button className="ad-btn ad-btn--primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
