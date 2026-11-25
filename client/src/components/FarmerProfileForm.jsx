import LocationFields from './LocationFields.jsx';
import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../lib/api.js';
import FormField from './FormField.jsx';

export default function FarmerProfileForm({ user, onCancel, onSaved }) {
  const { acceptUser, refresh } = useAuth();
  const [form, setForm] = useState({
    fullName: user.fullName,
    email: user.email || '',
    farmName: user.farmerProfile.farmName || '',
    district: user.farmerProfile.district,
    upazila: user.farmerProfile.upazila,
    village: user.farmerProfile.village,
    farmAddress: user.farmerProfile.farmAddress,
  });
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [stale, setStale] = useState(false);
  const alert = useRef(null);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFields({});
    setStale(false);
    const body = new FormData();
    for (const [key, value] of Object.entries(form)) body.append(key, value);
    body.append('version', user.farmerProfile.version);
    if (photo) body.append('photo', photo);
    try {
      const result = await apiRequest('farmer/profile', { method: 'PATCH', body });
      acceptUser(result.user);
      onSaved(result.message);
    } catch (failure) {
      setError(failure.message);
      setFields(failure.fields || {});
      setStale(failure.status === 409 && !failure.fields);
      if ([401, 403].includes(failure.status)) refresh();
    } finally {
      setBusy(false);
    }
  }

  function field(name, label, props = {}) {
    return (
      <FormField
        name={name}
        label={label}
        value={form[name]}
        onChange={(event) => {
          setForm({ ...form, [name]: event.target.value });
          setFields({ ...fields, [name]: undefined });
        }}
        error={fields[name]}
        {...props}
      />
    );
  }

  return (
    <section className="account-card farmer-profile-form" aria-labelledby="farmer-profile-title">
      <h2 id="farmer-profile-title">প্রোফাইল সম্পাদনা</h2>
      {error && (
        <p className="form-alert" role="alert" tabIndex={-1} ref={alert}>{error}</p>
      )}
      <form onSubmit={submit} noValidate>
        <fieldset disabled={busy}>
          <div className="form-grid">
            {field('fullName', 'পুরো নাম', { maxLength: 100, autoComplete: 'name', autoFocus: true })}
            {field('email', 'ইমেইল', { type: 'email', optional: true, maxLength: 254, autoComplete: 'email' })}
            <div className="form-full">
              {field('farmName', 'খামারের নাম', { maxLength: 120, optional: true })}
            </div>
            <LocationFields
              values={form}
              errors={fields}
              onChange={(location) => {
                setForm((current) => ({ ...current, ...location }));
                setFields((current) => ({ ...current, district: undefined, upazila: undefined }));
              }}
            />
            {field('village', 'গ্রাম', { maxLength: 100 })}
            <FormField
              name="photo"
              label="প্রোফাইলের ছবি"
              type="file"
              optional
              accept="image/jpeg,image/png,image/webp"
              hint="JPG, PNG অথবা WebP ছবি দিন, সর্বোচ্চ ২ মেগাবাইট।"
              error={fields.photo}
              onChange={(event) => {
                setPhoto(event.target.files[0] || null);
                setFields({ ...fields, photo: undefined });
              }}
            />
            <div className="form-full">
              {field('farmAddress', 'খামারের পূর্ণ ঠিকানা', { multiline: true, rows: 3, maxLength: 500 })}
            </div>
          </div>
          <div className="farmer-profile-actions">
            <button type="button" className="button button-secondary" onClick={onCancel}>বাতিল</button>
            {stale ? (
              <button type="button" className="button button-primary" onClick={refresh}>
                সর্বশেষ তথ্য আনুন
              </button>
            ) : (
              <button type="submit" className="button button-primary">
                {busy ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
                সংরক্ষণ করুন
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </section>
  );
}
