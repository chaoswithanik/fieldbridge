import { useRef, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import AuthLayout from '../components/AuthLayout.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../lib/api.js';

export default function Login() {
  const { user, acceptUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const destination =
    typeof from === 'string' &&
    /^\/(?:marketplace|requirements|orders|notifications)(?:[/?]|$)/.test(from) &&
    !from.includes('\\')
      ? from
      : '/account';
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const alert = useRef(null);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
    setFields({ ...fields, [event.target.name]: undefined });
  }
  async function submit(event) {
    event.preventDefault();
    setError('');
    const missing = {
      ...(!form.identifier.trim() ? { identifier: 'ফোন নম্বর অথবা ইমেইল লিখুন।' } : {}),
      ...(!form.password ? { password: 'পাসওয়ার্ড লিখুন।' } : {}),
    };
    setFields(missing);
    if (Object.keys(missing).length) {
      setError('প্রবেশের জন্য প্রয়োজনীয় তথ্য লিখুন।');
      return;
    }
    setBusy(true);
    try {
      const response = await apiRequest('auth/login', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({ identifier: '', password: '' });
      acceptUser(response.user);
      navigate(response.user.role === 'admin' ? '/admin/buyers' : destination, {
        replace: true,
      });
    } catch (failure) {
      setError(failure.message);
      setFields(failure.fields || {});
    } finally {
      setBusy(false);
    }
  }
  if (user) return <Navigate to={user.role === 'admin' ? '/admin/buyers' : destination} replace />;
  return (
    <AuthLayout login>
      <span className="eyebrow">আপনার ফিল্ডব্রিজ অ্যাকাউন্ট</span>
      <h2 className="auth-card-title">প্রবেশ করুন</h2>
      <p className="auth-card-description">নিবন্ধিত ফোন নম্বর বা যুক্ত করা ইমেইল ব্যবহার করুন।</p>
      {error && (
        <div className="form-alert" role="alert" ref={alert} tabIndex={-1}>
          {error}
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <fieldset disabled={busy} className="login-fields">
          <legend className="sr-only">প্রবেশের তথ্য</legend>
          <FormField
            name="identifier"
            label="ফোন নম্বর অথবা ইমেইল"
            value={form.identifier}
            onChange={change}
            autoComplete="username"
            maxLength={254}
            error={fields.identifier}
          />
          <FormField
            name="password"
            label="পাসওয়ার্ড"
            type="password"
            value={form.password}
            onChange={change}
            autoComplete="current-password"
            maxLength={128}
            error={fields.password}
          />
        </fieldset>
        <button className="button button-primary auth-submit" type="submit" disabled={busy}>
          {busy && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
          {busy ? 'প্রবেশ করা হচ্ছে…' : 'প্রবেশ করুন'}
        </button>
      </form>
      <p className="auth-bottom">
        এখনো অ্যাকাউন্ট নেই?{' '}
        <Link className="text-link" to="/register">
          নিবন্ধন করুন
        </Link>
      </p>
    </AuthLayout>
  );
}
