import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LoaderCircle, FileText, Plus, Trash2 } from 'lucide-react';
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
const documentOptions = [
  { value: 'trade_license', label: 'ট্রেড লাইসেন্স' },
  { value: 'incorporation_certificate', label: 'কোম্পানি ইনকরপোরেশন সনদ' },
  { value: 'partnership_deed', label: 'পার্টনারশিপ ডিড/নিবন্ধন' },
  { value: 'cooperative_certificate', label: 'সমবায় বা সমিতির নিবন্ধন সনদ' },
  { value: 'etin_certificate', label: 'ই-টিআইএন সনদ (ঐচ্ছিক)' },
  { value: 'vat_bin_certificate', label: 'ভ্যাট/BIN সনদ (ঐচ্ছিক)' },
  { value: 'import_registration_certificate', label: 'ইমপোর্ট রেজিস্ট্রেশন সনদ (IRC)' },
];
const newDocument = (id) => ({ id, type: 'trade_license', file: null });

export default function BuyerRegister() {
  const { user, acceptUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty),
    [documents, setDocuments] = useState(() => [newDocument(0)]),
    [fields, setFields] = useState({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const alert = useRef(null);
  const nextDocumentId = useRef(1);
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
    if (!documents.length || documents.some((document) => !document.file))
      invalid.documents = 'অন্তত একটি নথি বেছে দিন।';
    else if (
      documents.some(
        (document) =>
          document.file.size > 5 * 1024 * 1024 ||
          !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(document.file.type),
      )
    )
      invalid.documents = 'প্রতিটি নথি PDF, JPG, PNG বা WebP এবং সর্বোচ্চ ৫ মেগাবাইট হতে হবে।';
    setFields(invalid);
    if (Object.keys(invalid).length) {
      setError('চিহ্নিত তথ্যগুলো ঠিক করে আবার চেষ্টা করুন।');
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      for (const [key, value] of Object.entries(form)) body.append(key, value);
      for (const document of documents) {
        body.append('documentTypes', document.type);
        body.append('documents', document.file);
      }
      const data = await apiRequest('auth/buyers/register', {
        method: 'POST',
        body,
      });
      setForm(empty);
      setDocuments([newDocument(0)]);
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
        ইমেইল ছাড়া সব তথ্য আবশ্যক। আবেদন জমা দেওয়ার পর অ্যাডমিনের অনুমোদন নেই হবে।
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
        <fieldset disabled={busy}>
          <legend>ব্যবসায়িক নথি</legend>
          <p className="buyer-document-intro">
            ট্রেড লাইসেন্স সবচেয়ে উপযোগী। প্রয়োজনে একাধিক নথি দিন—যেমন ই-টিআইএন বা ভ্যাট/BIN সনদ।
          </p>
          <div className="buyer-document-list">
            {documents.map((document, index) => (
              <div className="buyer-document-row" key={document.id}>
                <FormField
                  name={`document-type-${document.id}`}
                  label={`নথি ${index + 1}-এর ধরন`}
                  options={documentOptions}
                  value={document.type}
                  onChange={(event) =>
                    {
                      setDocuments((rows) =>
                        rows.map((row) =>
                          row.id === document.id ? { ...row, type: event.target.value } : row,
                        ),
                      );
                      setFields((current) => ({ ...current, documents: undefined }));
                    }
                  }
                />
                <div className={`form-field ${fields.documents ? 'has-error' : ''}`}>
                  <label htmlFor={`document-file-${document.id}`}>
                    নথি নির্বাচন করুন <span className="required-mark">*</span>
                  </label>
                  <input
                    id={`document-file-${document.id}`}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    aria-invalid={Boolean(fields.documents)}
                    onChange={(event) =>
                      {
                        setDocuments((rows) =>
                          rows.map((row) =>
                            row.id === document.id
                              ? { ...row, file: event.target.files?.[0] || null }
                              : row,
                          ),
                        );
                        setFields((current) => ({ ...current, documents: undefined }));
                      }
                    }
                  />
                </div>
                {documents.length > 1 && (
                  <button
                    type="button"
                    className="button button-secondary buyer-document-remove"
                    aria-label={`নথি ${index + 1} বাদ দিন`}
                    onClick={() => setDocuments((rows) => rows.filter((row) => row.id !== document.id))}
                  >
                    <Trash2 size={17} aria-hidden="true" /> বাদ দিন
                  </button>
                )}
              </div>
            ))}
          </div>
          {fields.documents && <p className="field-error">{fields.documents}</p>}
          {documents.length < 5 && (
            <button
              type="button"
              className="button button-secondary buyer-document-add"
              onClick={() => setDocuments((rows) => [...rows, newDocument(nextDocumentId.current++)])}
            >
              <Plus size={17} aria-hidden="true" /> আরও নথি যোগ করুন
            </button>
          )}
        </fieldset>
        <div className="buyer-info-note">
          <FileText size={19} aria-hidden="true" />
          <p>
            আপনার নথি শুধু আপনি ও আবেদন যাচাইয়ের দায়িত্বে থাকা অ্যাডমিন দেখতে পারবেন। আবেদনের অবস্থা ও প্রত্যাখ্যানের
            কারণ নিজের অ্যাকাউন্টে দেখতে পারবেন। অনুমোদনের আগে কেনাকাটার অনুমতি থাকবে না।
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
