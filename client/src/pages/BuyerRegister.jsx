import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LoaderCircle, ClipboardCheck } from 'lucide-react';
import AuthLayout from '../components/AuthLayout.jsx';
import RegistrationChoices from '../components/RegistrationChoices.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../lib/api.js';
import { phoneNumber } from '../lib/registration.js';

const empty = {
  fullName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  businessName: '',
  businessType: '',
  address: '',
};

export default function BuyerRegister() {
  const { user, acceptUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty),
    [fields, setFields] = useState({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const alert = useRef(null);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  function change(event) {
    const { name, value } = event.target;
    setForm((old) => ({ ...old, [name]: value }));
    setFields((old) => ({ ...old, [name]: undefined }));
  }
  function field(name, label, props = {}) {
    return (
      <FormField
        name={name}
        label={label}
        value={form[name]}
        onChange={change}
        error={fields[name]}
        {...props}
      />
    );
  }
  async function submit(event) {
    event.preventDefault();
    setError('');
    const invalid = {};
    for (const [key, label, min, max] of [
      ['fullName', 'পুরো নাম', 2, 100],
      ['businessName', 'ব্যবসা বা প্রতিষ্ঠানের নাম', 2, 160],
      ['businessType', 'ব্যবসার ধরন', 2, 80],
      ['address', 'পূর্ণ ঠিকানা', 5, 500],
    ])
      if (form[key].trim().length < min || form[key].trim().length > max)
        invalid[key] = `${label} সঠিকভাবে লিখুন।`;
    if (!/^01[3-9]\d{8}$/.test(phoneNumber(form.phone)))
      invalid.phone = 'বাংলাদেশের ১১ সংখ্যার মোবাইল নম্বর দিন।';
    if (form.password.length < 8 || form.password.length > 128)
      invalid.password = 'পাসওয়ার্ড ৮ থেকে ১২৮ অক্ষরের হতে হবে।';
    if (form.password !== form.confirmPassword) invalid.confirmPassword = 'দুটি পাসওয়ার্ড মিলছে না।';
    if (
      form.email.trim() &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.email.trim().length > 254)
    )
      invalid.email = 'সঠিক ইমেইল দিন।';
    setFields(invalid);
    if (Object.keys(invalid).length) {
      setError('চিহ্নিত তথ্যগুলো ঠিক করে আবার চেষ্টা করুন।');
      return;
    }
    setBusy(true);
    try {
      const data = await apiRequest('auth/buyers/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm(empty);
      acceptUser(data.user);
      navigate('/account', { replace: true });
    } catch (failure) {
      setError(failure.message);
      setFields(failure.fields || {});
    } finally {
      setBusy(false);
    }
  }
  if (user) return <Navigate to="/account" replace />;
  return (
    <AuthLayout buyer>
      <RegistrationChoices />
      <h2 className="auth-card-title">ক্রেতা হিসেবে নিবন্ধন করুন</h2>
      <p className="auth-card-description">
        ইমেইল ছাড়া সব তথ্য আবশ্যক। আবেদন জমা দেওয়ার পর অ্যাডমিনের অনুমোদন প্রয়োজন হবে।
      </p>
      {error && (
        <div className="form-alert" role="alert" tabIndex={-1} ref={alert}>
          {error}
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <fieldset disabled={busy}>
          <legend>ব্যক্তিগত তথ্য</legend>
          <div className="form-grid">
            {field('fullName', 'পুরো নাম', { autoComplete: 'name', maxLength: 100 })}
            {field('phone', 'মোবাইল নম্বর', {
              type: 'tel',
              autoComplete: 'tel',
              maxLength: 18,
              placeholder: '০১৭১২৩৪৫৬৭৮',
            })}
            {field('password', 'পাসওয়ার্ড', {
              type: 'password',
              autoComplete: 'new-password',
              maxLength: 128,
              hint: 'কমপক্ষে ৮ অক্ষর ব্যবহার করুন।',
            })}
            {field('confirmPassword', 'পাসওয়ার্ড আবার লিখুন', {
              type: 'password',
              autoComplete: 'new-password',
              maxLength: 128,
            })}
            <div className="form-full">
              {field('email', 'ইমেইল', {
                type: 'email',
                optional: true,
                autoComplete: 'email',
                maxLength: 254,
                hint: 'ইমেইল যোগ করলে এটি দিয়েও প্রবেশ করতে পারবেন।',
              })}
            </div>
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>ব্যবসা বা প্রতিষ্ঠানের তথ্য</legend>
          <div className="form-grid">
            {field('businessName', 'ব্যবসা বা প্রতিষ্ঠানের নাম', {
              autoComplete: 'organization',
              maxLength: 160,
            })}
            {field('businessType', 'ব্যবসার ধরন', {
              maxLength: 80,
              placeholder: 'যেমন: পাইকারি ব্যবসা, রেস্তোরাঁ',
            })}
            <div className="form-full">
              {field('address', 'পূর্ণ ঠিকানা', {
                multiline: true,
                rows: 3,
                maxLength: 500,
                autoComplete: 'street-address',
              })}
            </div>
          </div>
        </fieldset>
        <div className="buyer-info-note">
          <ClipboardCheck size={19} aria-hidden="true" />
          <p>
            আবেদনের অবস্থা ও প্রত্যাখ্যানের কারণ নিজের অ্যাকাউন্টে দেখতে পারবেন। অনুমোদনের আগে কেনাকাটার
            অনুমতি থাকবে না।
          </p>
        </div>
        <button className="button button-primary auth-submit" disabled={busy}>
          {busy && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
          {busy ? 'আবেদন জমা হচ্ছে…' : 'নিবন্ধনের আবেদন জমা দিন'}
        </button>
      </form>
      <p className="auth-bottom">
        আগেই অ্যাকাউন্ট আছে?{' '}
        <Link className="text-link" to="/login">
          প্রবেশ করুন
        </Link>
      </p>
    </AuthLayout>
  );
}
