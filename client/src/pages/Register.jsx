import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Camera, Check, LoaderCircle, ShieldCheck, Sprout, X } from 'lucide-react';
import AuthLayout from '../components/AuthLayout.jsx';
import RegistrationChoices from '../components/RegistrationChoices.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../lib/api.js';
import { bangla, digits, phoneNumber, registrationErrors } from '../lib/registration.js';

const empty = {
  fullName: '',
  phone: '',
  password: '',
  confirmPassword: '',
  nid: '',
  district: '',
  upazila: '',
  village: '',
  farmAddress: '',
  email: '',
  farmName: '',
};

export default function Register() {
  const { user, acceptUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('details');
  const [verification, setVerification] = useState(null);
  const [code, setCode] = useState('');
  const [now, setNow] = useState(Date.now());
  const [needsNewCode, setNeedsNewCode] = useState(false);
  const status = useRef(null);
  const otpInput = useRef(null);

  useEffect(() => {
    if (!photo) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => {
    if (step !== 'otp') return;
    otpInput.current?.focus();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);
  useEffect(() => {
    if (error) status.current?.focus();
  }, [error]);
  useEffect(() => {
    if (step === 'details' && (fields.photo || fields.email || fields.farmName))
      document.getElementById('optional-details').open = true;
  }, [step, fields.photo, fields.email, fields.farmName]);

  const resendSeconds = verification
    ? Math.max(0, Math.ceil((new Date(verification.resendAt).getTime() - now) / 1000))
    : 0;
  const expiresSeconds = verification
    ? Math.max(0, Math.ceil((new Date(verification.expiresAt).getTime() - now) / 1000))
    : 0;

  function change(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setFields((previous) => ({ ...previous, [name]: undefined }));
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
  async function sendCode() {
    const response = await apiRequest('auth/farmers/otp', {
      method: 'POST',
      body: JSON.stringify({ phone: form.phone }),
    });
    setVerification({ ...response, phone: phoneNumber(form.phone) });
    setNow(Date.now());
    setCode('');
    setNeedsNewCode(false);
    setStep('otp');
  }
  async function next(event) {
    event.preventDefault();
    setError('');
    const errors = registrationErrors(form, photo);
    setFields(errors);
    if (Object.keys(errors).length) {
      setError('চিহ্নিত তথ্যগুলো ঠিক করে আবার চেষ্টা করুন।');
      if (errors.email || errors.farmName || errors.photo)
        document.getElementById('optional-details').open = true;
      return;
    }
    if (
      verification?.phone === phoneNumber(form.phone) &&
      new Date(verification.expiresAt) > new Date()
    ) {
      setStep('otp');
      return;
    }
    setBusy(true);
    try {
      await sendCode();
    } catch (failure) {
      setError(failure.message);
      setFields(failure.fields || {});
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError('');
    setFields({});
    try {
      await sendCode();
      otpInput.current?.focus();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function register(event) {
    event.preventDefault();
    setError('');
    setFields({});
    if (!/^\d{6}$/.test(digits(code))) {
      setFields({ code: '৬ সংখ্যার কোডটি লিখুন।' });
      return;
    }
    setBusy(true);
    const data = new FormData();
    for (const [key, value] of Object.entries(form)) data.append(key, value);
    data.append('challengeId', verification.challengeId);
    data.append('code', code);
    if (photo) data.append('photo', photo);
    try {
      const result = await apiRequest('auth/farmers/register', { method: 'POST', body: data });
      setForm(empty);
      setPhoto(null);
      setCode('');
      acceptUser(result.user);
      navigate('/account', { replace: true, state: { registered: true } });
    } catch (failure) {
      setError(failure.message);
      setFields(failure.fields || {});
      if (failure.status === 410 || (failure.status === 429 && failure.fields?.code))
        setNeedsNewCode(true);
      if (failure.fields && Object.keys(failure.fields).some((key) => key !== 'code'))
        setStep('details');
    } finally {
      setBusy(false);
    }
  }

  if (user) return <Navigate to="/account" replace />;

  return (
    <AuthLayout>
      <RegistrationChoices />
      <div className="auth-step">
        <span className={step === 'details' ? 'current' : 'complete'}>
          {step === 'otp' ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Sprout size={16} aria-hidden="true" />
          )}{' '}
          কৃষকের তথ্য
        </span>
        <span className="step-line" />
        <span className={step === 'otp' ? 'current' : ''}>
          <ShieldCheck size={16} aria-hidden="true" /> ফোন যাচাই
        </span>
      </div>
      <h2 className="auth-card-title">
        {step === 'details' ? 'কৃষক হিসেবে নিবন্ধন করুন' : 'আপনার ফোন নম্বর যাচাই করুন'}
      </h2>
      <p className="auth-card-description">
        {step === 'details'
          ? 'তারকা চিহ্নিত তথ্যগুলো আবশ্যক। আপনার তথ্য যত্নের সঙ্গে সংরক্ষণ করা হবে।'
          : `${bangla(verification?.phone)} নম্বরের জন্য ৬ সংখ্যার যাচাইকরণ কোডটি লিখুন।`}
      </p>
      {error && (
        <div className="form-alert" role="alert" tabIndex={-1} ref={status}>
          {error}
        </div>
      )}
      {step === 'details' ? (
        <form onSubmit={next} noValidate>
          <fieldset disabled={busy}>
            <legend>ব্যক্তিগত পরিচয়</legend>
            <div className="form-grid">
              {field('fullName', 'পুরো নাম', {
                autoComplete: 'name',
                maxLength: 100,
                placeholder: 'আপনার পুরো নাম',
              })}
              {field('phone', 'মোবাইল নম্বর', {
                type: 'tel',
                autoComplete: 'tel',
                placeholder: '০১৭১২৩৪৫৬৭৮',
                maxLength: 18,
                hint: 'নিবন্ধনের পর মোবাইল নম্বর পরিবর্তন করা যাবে না।',
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
                {field('nid', 'জাতীয় পরিচয়পত্রের নম্বর', {
                  inputMode: 'numeric',
                  maxLength: 22,
                  hint: 'শুধু ১০, ১৩ অথবা ১৭ সংখ্যার নম্বর দিন। পরিচয়পত্রের ছবি প্রয়োজন নেই।',
                })}
              </div>
            </div>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>খামারের অবস্থান</legend>
            <div className="form-grid">
              {field('district', 'জেলা', { maxLength: 80, placeholder: 'যেমন: বগুড়া' })}
              {field('upazila', 'উপজেলা', { maxLength: 80, placeholder: 'যেমন: শিবগঞ্জ' })}
              <div className="form-full">
                {field('village', 'গ্রাম', { maxLength: 100, placeholder: 'গ্রামের নাম' })}
              </div>
              <div className="form-full">
                {field('farmAddress', 'খামারের পূর্ণ ঠিকানা', {
                  multiline: true,
                  rows: 3,
                  maxLength: 500,
                  placeholder: 'খামারের অবস্থান বুঝতে সহায়ক পূর্ণ ঠিকানা লিখুন',
                })}
              </div>
            </div>
          </fieldset>
          <details id="optional-details" className="optional-details">
            <summary>
              আরও কিছু তথ্য <span>ঐচ্ছিক</span>
            </summary>
            <fieldset disabled={busy}>
              <legend className="sr-only">ঐচ্ছিক তথ্য</legend>
              <div className="form-grid">
                {field('farmName', 'খামারের নাম', { optional: true, maxLength: 120 })}
                {field('email', 'ইমেইল', {
                  type: 'email',
                  autoComplete: 'email',
                  optional: true,
                  maxLength: 254,
                  hint: 'ইমেইল যোগ করলে এটি দিয়েও প্রবেশ করতে পারবেন।',
                })}
                <div className="form-full photo-picker">
                  <span className="photo-preview">
                    {preview ? (
                      <img src={preview} alt="বেছে নেওয়া প্রোফাইল ছবি" />
                    ) : (
                      <Camera size={25} aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <label htmlFor="profile-photo">
                      প্রোফাইলের ছবি <span className="optional-label">(ঐচ্ছিক)</span>
                    </label>
                    <input
                      id="profile-photo"
                      name="photo"
                      type="file"
                      className="sr-only"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        setPhoto(event.target.files?.[0] || null);
                        setFields((previous) => ({ ...previous, photo: undefined }));
                      }}
                      aria-describedby="photo-help"
                    />
                    <button
                      type="button"
                      className="photo-select"
                      onClick={() => document.getElementById('profile-photo').click()}
                    >
                      ছবি বেছে নিন
                    </button>
                    <span className="photo-filename">
                      {photo?.name || 'কোনো ছবি বেছে নেওয়া হয়নি'}
                    </span>
                    <p id="photo-help" className={fields.photo ? 'field-error' : 'field-hint'}>
                      {fields.photo || 'JPG, PNG অথবা WebP; সর্বোচ্চ ২ মেগাবাইট।'}
                    </p>
                  </div>
                  {photo && (
                    <button
                      type="button"
                      className="remove-photo"
                      onClick={() => {
                        setPhoto(null);
                        document.getElementById('profile-photo').value = '';
                      }}
                      aria-label="ছবিটি সরিয়ে দিন"
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </fieldset>
          </details>
          <button type="submit" className="button button-primary auth-submit" disabled={busy}>
            {busy && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
            {busy ? 'অপেক্ষা করুন…' : 'ফোন যাচাই করুন'}
          </button>
        </form>
      ) : (
        <form onSubmit={register} noValidate>
          {verification.delivery === 'console' && (
            <div className="otp-dev-note">
              <ShieldCheck size={20} aria-hidden="true" />
              <p>
                <strong>পরীক্ষামূলক ফোন যাচাই</strong>কোডটি SMS-এ পাঠানো হয়নি। development সার্ভারের
                টার্মিনালে কোডটি দেখুন।
              </p>
            </div>
          )}
          <label className="otp-label" htmlFor="verification-code">
            যাচাইকরণ কোড
          </label>
          <input
            ref={otpInput}
            id="verification-code"
            className={`otp-input ${fields.code ? 'has-error' : ''}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => {
              setCode(digits(event.target.value).replace(/\D/g, '').slice(0, 6));
              setFields({});
            }}
            aria-invalid={Boolean(fields.code)}
            aria-describedby="code-help"
            disabled={busy}
          />
          <p
            id="code-help"
            className={
              fields.code || !expiresSeconds || needsNewCode ? 'field-error' : 'field-hint'
            }
          >
            {fields.code ||
              (needsNewCode
                ? 'নতুন কোড নিয়ে আবার চেষ্টা করুন।'
                : expiresSeconds
                  ? `কোডের মেয়াদ বাকি ${bangla(Math.floor(expiresSeconds / 60))} মিনিট ${bangla(expiresSeconds % 60)} সেকেন্ড।`
                  : 'কোডের মেয়াদ শেষ হয়েছে। নতুন কোড নিন।')}
          </p>
          <button
            type="submit"
            className="button button-primary auth-submit"
            disabled={busy || !expiresSeconds || needsNewCode}
          >
            {busy && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
            {busy ? 'যাচাই করা হচ্ছে…' : 'যাচাই করে অ্যাকাউন্ট তৈরি করুন'}
          </button>
          <div className="otp-actions">
            <button
              type="button"
              className="text-button"
              disabled={busy || resendSeconds > 0}
              onClick={resend}
            >
              {resendSeconds > 0 ? `${bangla(resendSeconds)} সেকেন্ড পর নতুন কোড নিন` : 'নতুন কোড নিন'}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setStep('details');
                setError('');
                setFields({});
              }}
            >
              তথ্য সংশোধন করুন
            </button>
          </div>
        </form>
      )}
      <p className="auth-bottom">
        আগেই অ্যাকাউন্ট আছে?{' '}
        <Link to="/login" className="text-link">
          প্রবেশ করুন
        </Link>
      </p>
      <p className="auth-scope-note">কৃষকের নিবন্ধনে ফোন যাচাই আবশ্যক।</p>
    </AuthLayout>
  );
}
