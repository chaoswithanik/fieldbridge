import { useState, useEffect, useRef } from 'react';
import {
  Clock3,
  BadgeCheck,
  CircleX,
  RefreshCw,
  ShoppingBasket,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../lib/api.js';
import { bangla } from '../lib/registration.js';
import FormField from '../components/FormField.jsx';
import { Link } from 'react-router-dom';

const statusInfo = {
  pending: {
    title: 'আপনার আবেদন পর্যালোচনাধীন',
    text: 'অ্যাডমিনের সিদ্ধান্তের জন্য অপেক্ষা করুন। অনুমোদনের আগে কেনাকাটার অনুমতি থাকবে না।',
    Icon: Clock3,
  },
  approved: {
    title: 'আপনার ক্রেতা অ্যাকাউন্ট অনুমোদিত',
    text: 'অ্যাডমিন আপনার আবেদন অনুমোদন করেছেন।',
    Icon: BadgeCheck,
  },
  rejected: {
    title: 'আপনার আবেদন প্রত্যাখ্যাত হয়েছে',
    text: 'নিচের কারণটি দেখে ব্যবসার তথ্য সংশোধন করে আবার আবেদন করতে পারেন।',
    Icon: CircleX,
  },
};

export default function BuyerAccount() {
  const { user, acceptUser, refresh } = useAuth();
  const profile = user.buyerProfile;
  const [form, setForm] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [fields, setFields] = useState({}),
    [message, setMessage] = useState('');
  const alert = useRef(null);
  useEffect(() => {
    setForm({
      fullName: user.fullName,
      email: user.email || '',
      businessName: profile.businessName,
      businessType: profile.businessType,
      address: profile.address,
    });
  }, [user, profile]);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  const rejected = profile.status === 'rejected',
    info = statusInfo[profile.status];
  function field(name, label, props = {}) {
    return (
      <FormField
        name={name}
        label={label}
        value={form[name] || ''}
        onChange={(event) => {
          setForm({ ...form, [name]: event.target.value });
          setFields({ ...fields, [name]: undefined });
        }}
        error={fields[name]}
        {...props}
      />
    );
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFields({});
    setMessage('');
    const body = rejected
      ? { ...form, version: profile.version }
      : { fullName: form.fullName, email: form.email };
    try {
      const result = await apiRequest(rejected ? 'buyer/resubmit' : 'buyer/profile', {
        method: rejected ? 'POST' : 'PATCH',
        body: JSON.stringify(body),
      });
      acceptUser(result.user);
      setMessage(result.message);
    } catch (failure) {
      setError(failure.message);
      setFields(failure.fields || {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-container account-page">
      <div className="buyer-page-heading">
        <div>
          <span className="eyebrow">
            <ShoppingBasket size={17} aria-hidden="true" /> আপনার ক্রেতা অ্যাকাউন্ট
          </span>
          <h1 className="section-title">স্বাগতম, {user.fullName}।</h1>
        </div>
        <button type="button" className="button button-secondary" onClick={refresh} disabled={busy}>
          <RefreshCw size={16} aria-hidden="true" /> অবস্থা হালনাগাদ
        </button>
      </div>
      <div className={`approval-banner approval-${profile.status}`}>
        <info.Icon size={24} aria-hidden="true" />
        <div>
          <h2>{info.title}</h2>
          <p>{info.text}</p>
          {profile.rejectionReason && (
            <p className="rejection-reason">
              <strong>প্রত্যাখ্যানের কারণ:</strong> {profile.rejectionReason}
            </p>
          )}
        </div>
      </div>
      <div className="buyer-market-link">
        {profile.status === 'approved' && (
          <Link className="button button-secondary" to="/orders">
            আমার অর্ডার
          </Link>
        )}
        {profile.status === 'approved' && (
          <Link className="button button-primary" to="/requirements">
            <ClipboardList size={17} aria-hidden="true" /> আমার ক্রয় চাহিদা
          </Link>
        )}
        <Link className="button button-primary" to="/marketplace">
          <ShoppingBasket size={17} aria-hidden="true" /> ফসলের বাজার দেখুন
        </Link>
      </div>
      {message && (
        <p className="success-note" role="status">
          {message}
        </p>
      )}
      <div className="account-grid">
        <article className="account-card">
          <h2>নিবন্ধিত তথ্য</h2>
          <dl className="account-details buyer-details">
            <div>
              <dt>পুরো নাম</dt>
              <dd>{user.fullName}</dd>
            </div>
            <div>
              <dt>মোবাইল</dt>
              <dd>{bangla(user.phone)}</dd>
            </div>
            <div>
              <dt>ইমেইল</dt>
              <dd>{user.email || 'যোগ করা হয়নি'}</dd>
            </div>
            <div>
              <dt>ব্যবসা বা প্রতিষ্ঠান</dt>
              <dd>{profile.businessName}</dd>
            </div>
            <div>
              <dt>ব্যবসার ধরন</dt>
              <dd>{profile.businessType}</dd>
            </div>
            <div>
              <dt>পূর্ণ ঠিকানা</dt>
              <dd>{profile.address}</dd>
            </div>
          </dl>
        </article>
        <article className="account-card auth-card">
          <h2>{rejected ? 'সংশোধন করে আবার আবেদন করুন' : 'নাম ও ইমেইল সংশোধন'}</h2>
          <p className="auth-card-description">
            {rejected
              ? 'মোবাইল নম্বর অপরিবর্তিত থাকবে। প্রয়োজনীয় তথ্য সংশোধন করে আবেদন জমা দিন।'
              : 'নিবন্ধনের পর এখানে শুধু নাম ও ইমেইল পরিবর্তন করতে পারবেন।'}
          </p>
          {error && (
            <div className="form-alert" role="alert" tabIndex={-1} ref={alert}>
              {error}
            </div>
          )}
          <form onSubmit={submit} noValidate>
            <fieldset disabled={busy}>
              <div className="form-grid">
                <div className="form-full">{field('fullName', 'পুরো নাম', { maxLength: 100 })}</div>
                <div className="form-full">
                  {field('email', 'ইমেইল', { type: 'email', optional: true, maxLength: 254 })}
                </div>
                {rejected && (
                  <>
                    <div className="form-full">
                      {field('businessName', 'ব্যবসা বা প্রতিষ্ঠানের নাম', { maxLength: 160 })}
                    </div>
                    <div className="form-full">
                      {field('businessType', 'ব্যবসার ধরন', { maxLength: 80 })}
                    </div>
                    <div className="form-full">
                      {field('address', 'পূর্ণ ঠিকানা', {
                        multiline: true,
                        rows: 3,
                        maxLength: 500,
                      })}
                    </div>
                  </>
                )}
              </div>
              <button className="button button-primary auth-submit" disabled={busy}>
                {busy
                  ? 'সংরক্ষণ হচ্ছে…'
                  : rejected
                    ? 'সংশোধিত আবেদন জমা দিন'
                    : 'পরিবর্তন সংরক্ষণ করুন'}
              </button>
            </fieldset>
          </form>
        </article>
      </div>
    </section>
  );
}
