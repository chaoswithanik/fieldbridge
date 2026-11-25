import { useRef, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import {
  BadgeCheck,
  Sprout,
  UserRound,
  MapPin,
  ShieldCheck,
  LoaderCircle,
  Plus,
  Pencil,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { mediaUrl } from '../lib/api.js';
import { bangla } from '../lib/registration.js';
import BuyerAccount from './BuyerAccount.jsx';
import FarmerProfileForm from '../components/FarmerProfileForm.jsx';

export default function Account() {
  const { user, loading, loadError, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const editButton = useRef(null);
  function closeEditor() {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  }
  if (loading)
    return (
      <div className="account-loading page-container" role="status">
        <LoaderCircle className="spin" size={24} aria-hidden="true" /> আপনার অ্যাকাউন্টের তথ্য দেখা
        হচ্ছে…
      </div>
    );
  if (loadError)
    return (
      <section className="account-loading page-container">
        <p role="alert">{loadError}</p>
        <button type="button" className="button button-primary" onClick={refresh}>
          আবার চেষ্টা করুন
        </button>
      </section>
    );
  if (!user) return <Navigate to="/login" state={{ from: '/account' }} replace />;
  if (user.role === 'admin') return <Navigate to="/admin/buyers" replace />;
  if (user.role === 'buyer') return <BuyerAccount />;
  const profile = user.farmerProfile;
  return (
    <section className="page-container account-page">
      <div>
        <span className="eyebrow">
          <Sprout size={17} aria-hidden="true" /> আপনার নিজের আঙিনা
        </span>
        <div className="account-title-row">
          <h1 className="section-title">স্বাগতম, {user.fullName}।</h1>
          <div className="farmer-listing-links account-heading-actions">
            <button
              type="button"
              className="button button-secondary"
              ref={editButton}
              disabled={editing}
              onClick={() => { setMessage(''); setEditing(true); }}
            >
              <Pencil size={17} aria-hidden="true" /> প্রোফাইল সম্পাদনা
            </button>
            <Link className="button button-secondary" to="/orders">
              আমার অর্ডার
            </Link>
            <Link className="button button-secondary" to="/account/listings">
              আমার বিজ্ঞাপন
            </Link>
            <Link className="button button-primary" to="/account/listings/new">
              <Plus size={17} aria-hidden="true" /> নতুন বিজ্ঞাপন
            </Link>
          </div>
        </div>
      </div>
      {message && <p className="success-note" role="status">{message}</p>}
      {editing ? (
        <FarmerProfileForm
          user={user}
          onCancel={closeEditor}
          onSaved={(text) => { setMessage(text); closeEditor(); }}
        />
      ) : (
        <div className="account-grid">
          <article className="account-card">
            <div className="account-identity">
              <span className="account-avatar">
                {profile?.photoUrl ? (
                  <img src={mediaUrl(profile.photoUrl)} alt={user.fullName} />
                ) : (
                  <UserRound size={35} strokeWidth={1.5} aria-hidden="true" />
                )}
              </span>
              <div>
                <h2>{user.fullName}</h2>
                <span className="verified-badge">
                  <BadgeCheck size={16} aria-hidden="true" /> ফোন যাচাই সম্পন্ন
                </span>
              </div>
            </div>
            <dl className="account-details">
              <div>
                <dt>অ্যাকাউন্টের ধরন</dt>
                <dd>কৃষক</dd>
              </div>
              <div>
                <dt>মোবাইল নম্বর</dt>
                <dd>{bangla(user.phone)}</dd>
              </div>
              <div>
                <dt>ইমেইল</dt>
                <dd>{user.email || 'যোগ করা হয়নি'}</dd>
              </div>
              <div>
                <dt>জাতীয় পরিচয়পত্র</dt>
                <dd>•••• {bangla(profile?.nidLast4 || '')}</dd>
              </div>
            </dl>
            <p className="field-hint account-private">
              <ShieldCheck size={16} aria-hidden="true" /> মোবাইল নম্বর ও NID নিবন্ধনের পর পরিবর্তন
              করা যাবে না।
            </p>
          </article>
          <article className="account-card">
            <div className="account-section-title">
              <MapPin size={23} aria-hidden="true" />
              <h2>আপনার খামার</h2>
            </div>
            <dl className="account-details">
              <div>
                <dt>খামারের নাম</dt>
                <dd>{profile?.farmName || 'যোগ করা হয়নি'}</dd>
              </div>
              <div>
                <dt>জেলা</dt>
                <dd>{profile?.district}</dd>
              </div>
              <div>
                <dt>উপজেলা</dt>
                <dd>{profile?.upazila}</dd>
              </div>
              <div>
                <dt>গ্রাম</dt>
                <dd>{profile?.village}</dd>
              </div>
              <div>
                <dt>পূর্ণ ঠিকানা</dt>
                <dd>{profile?.farmAddress}</dd>
              </div>
            </dl>
          </article>
        </div>
      )}
    </section>
  );
}
