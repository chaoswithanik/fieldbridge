import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, MapPin, Pencil, LoaderCircle, LockKeyhole, Info } from 'lucide-react';
import AuthGate from '../components/AuthGate.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApiResource } from '../lib/resource.js';
import { apiRequest } from '../lib/api.js';
import { bangla } from '../lib/registration.js';
import { unitLabels } from '../lib/listings.js';
import { requirementErrors, requirementLabels } from '../lib/requirements.js';

function RequirementFormContent({ id }) {
  const { user, refresh } = useAuth(),
    navigate = useNavigate();
  const {
    data,
    loading,
    error: loadError,
    reload,
  } = useApiResource(id ? `buyer/requirements/${id}` : null);
  const requirement = data?.requirement;
  const [form, setForm] = useState({
    cropName: '',
    quantity: '',
    unit: 'kg',
    deliveryAddress: user.buyerProfile.address,
    instructions: '',
  });
  const [fields, setFields] = useState({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [stale, setStale] = useState(false);
  const alert = useRef(null);
  useEffect(() => {
    if (requirement) {
      setForm(
        Object.fromEntries(
          ['cropName', 'quantity', 'unit', 'deliveryAddress', 'instructions'].map((key) => [
            key,
            requirement[key] ?? '',
          ]),
        ),
      );
      setFields({});
      setError('');
      setStale(false);
    }
  }, [requirement]);
  useEffect(() => {
    if ([401, 403].includes(loadError?.status)) refresh();
  }, [loadError, refresh]);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFields((current) => ({ ...current, [name]: undefined }));
  }
  async function submit(event) {
    event.preventDefault();
    setError('');
    const issues = requirementErrors(form);
    setFields(issues);
    if (Object.keys(issues).length) {
      setError('চিহ্নিত তথ্যগুলো ঠিক করে আবার চেষ্টা করুন।');
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest(`buyer/requirements${id ? `/${id}` : ''}`, {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify({ ...form, ...(id ? { version: requirement.version } : {}) }),
      });
      navigate('/requirements', { replace: true, state: { requirementMessage: result.message } });
    } catch (failure) {
      setError(failure.message);
      setFields(failure.fields || {});
      setStale(failure.status === 409);
      if ([401, 403].includes(failure.status)) refresh();
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <section className="page-container account-loading" role="status">
        <LoaderCircle className="spin" size={23} aria-hidden="true" /> চাহিদার তথ্য দেখা হচ্ছে…
      </section>
    );
  if (loadError)
    return (
      <section className="page-container account-loading">
        <h1 className="section-title">
          {loadError.status === 404
            ? 'চাহিদাটি খুঁজে পাওয়া যায়নি।'
            : 'চাহিদার তথ্য দেখা যাচ্ছে না।'}
        </h1>
        <p role="alert">{loadError.message}</p>
        <button className="button button-secondary" onClick={reload}>
          আবার চেষ্টা করুন
        </button>
        <Link className="text-link" to="/requirements">
          আমার ক্রয় চাহিদায় ফিরুন
        </Link>
      </section>
    );
  if (requirement?.editsRemaining === 0)
    return (
      <section className="page-container account-loading">
        <LockKeyhole size={32} aria-hidden="true" />
        <h1 className="section-title">এই চাহিদার সম্পাদনার সুযোগ শেষ।</h1>
        <p>ইতিমধ্যে ২ বার সম্পাদনা করা হয়েছে। তালিকা থেকে অবস্থা বদলানো বা মুছে ফেলা যাবে।</p>
        <Link className="button button-primary" to="/requirements">
          আমার ক্রয় চাহিদায় ফিরুন
        </Link>
      </section>
    );
  const remaining = requirement?.editsRemaining ?? 2;
  return (
    <section className="page-container listings-page">
      <div className="listing-page-heading">
        <div>
          <span className="eyebrow">
            <ClipboardList size={17} aria-hidden="true" /> ক্রেতার আঙিনা
          </span>
          <h1>{id ? 'ক্রয় চাহিদা সম্পাদনা' : 'নতুন ক্রয় চাহিদা'}</h1>
          <p>আপনার প্রয়োজনীয় ফসলের পরিমাণ ও ডেলিভারির তথ্য দিন।</p>
        </div>
        {requirement && (
          <span className={`listing-status requirement-status-${requirement.status}`}>
            {requirementLabels[requirement.status]}
          </span>
        )}
      </div>
      {error && (
        <div className="form-alert listing-error" ref={alert} tabIndex={-1} role="alert">
          <p>{error}</p>
          {stale && (
            <button type="button" className="text-button" onClick={reload}>
              সর্বশেষ তথ্য আনুন
            </button>
          )}
        </div>
      )}
      <form className="listing-form-layout" onSubmit={submit} noValidate>
        <div className="listing-form-main">
          <fieldset className="listing-form-card" disabled={busy}>
            <legend>
              <ClipboardList size={18} aria-hidden="true" /> প্রয়োজনীয় ফসল
            </legend>
            <div className="listing-fields">
              <div className="form-full">
                <FormField
                  name="cropName"
                  label="ফসলের নাম"
                  placeholder="যেমন: আলু, ধান, টমেটো"
                  value={form.cropName}
                  onChange={change}
                  maxLength={100}
                  error={fields.cropName}
                />
              </div>
              <FormField
                name="quantity"
                label="প্রয়োজনীয় পরিমাণ"
                inputMode="decimal"
                placeholder="যেমন: ১০০০"
                value={form.quantity}
                onChange={change}
                maxLength={13}
                error={fields.quantity}
              />
              <FormField
                name="unit"
                label="একক"
                value={form.unit}
                onChange={change}
                options={Object.entries(unitLabels).map(([value, label]) => ({ value, label }))}
                error={fields.unit}
              />
            </div>
          </fieldset>
          <fieldset className="listing-form-card" disabled={busy}>
            <legend>
              <MapPin size={18} aria-hidden="true" /> ডেলিভারির স্থান
            </legend>
            <FormField
              name="deliveryAddress"
              label="ডেলিভারির পূর্ণ ঠিকানা"
              multiline
              rows={3}
              value={form.deliveryAddress}
              onChange={change}
              maxLength={500}
              error={fields.deliveryAddress}
              hint="জেলা, উপজেলা/এলাকা এবং পণ্য পৌঁছানোর সঠিক ঠিকানা লিখুন।"
            />
          </fieldset>
          <fieldset className="listing-form-card" disabled={busy}>
            <legend>অতিরিক্ত নির্দেশনা</legend>
            <FormField
              name="instructions"
              label="কৃষকের জন্য নির্দেশনা"
              multiline
              rows={4}
              optional
              value={form.instructions}
              onChange={change}
              maxLength={2000}
              error={fields.instructions}
              placeholder="প্যাকেটজাতকরণ বা ডেলিভারি সম্পর্কে প্রয়োজনীয় নির্দেশনা লিখুন।"
              hint={`${bangla(form.instructions.length)} / ২০০০ অক্ষর`}
            />
          </fieldset>
        </div>
        <aside className="listing-form-side">
          <div className="requirement-quota-card">
            <h2>
              <Pencil size={18} aria-hidden="true" /> সম্পাদনার সুযোগ
            </h2>
            <p className="requirement-quota-number">
              বাকি <strong>{bangla(remaining)}</strong> বার
            </p>
            <p>
              {id
                ? 'তথ্য বদলে সংরক্ষণ করলে একটি সুযোগ ব্যবহার হবে।'
                : 'চাহিদা তৈরির পরে সর্বোচ্চ দুইবার তথ্য সম্পাদনা করতে পারবেন।'}
            </p>
            <p className="field-hint">
              তথ্য অপরিবর্তিত রাখলে বা চাহিদার অবস্থা বদলালে সুযোগ খরচ হবে না।
            </p>
          </div>
          <div className="listing-publish-card">
            <p>
              <Info size={17} aria-hidden="true" />{' '}
              {id
                ? 'সংরক্ষণের আগে ফসল, পরিমাণ ও ঠিকানা মিলিয়ে নিন।'
                : 'ডেলিভারির ঠিকানা আপনার অ্যাকাউন্ট থেকে দেওয়া আছে। প্রয়োজন হলে বদলে দিন।'}
            </p>
            <button type="submit" className="button button-primary" disabled={busy || stale}>
              {busy && <LoaderCircle className="spin" size={17} aria-hidden="true" />}
              {busy ? 'সংরক্ষণ করা হচ্ছে…' : id ? 'পরিবর্তন সংরক্ষণ করুন' : 'চাহিদা তৈরি করুন'}
            </button>
            <Link className="text-link" to="/requirements">
              বাতিল করে তালিকায় ফিরুন
            </Link>
          </div>
        </aside>
      </form>
    </section>
  );
}

export default function RequirementForm() {
  const { id } = useParams();
  return (
    <AuthGate role="buyer" approvedBuyer>
      <RequirementFormContent key={id || 'new'} id={id} />
    </AuthGate>
  );
}
