import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Sprout,
  Camera,
  X,
  LoaderCircle,
  MapPin,
  CalendarDays,
  Check,
  ImagePlus,
  Info,
} from 'lucide-react';
import AuthGate from '../components/AuthGate.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest, mediaUrl } from '../lib/api.js';
import { bangla } from '../lib/registration.js';
import { unitLabels, statusLabels, listingErrors, formatAmount } from '../lib/listings.js';

function PhotoPreview({ photo, index, onRemove, disabled }) {
  const [url, setUrl] = useState(photo.url ? mediaUrl(photo.url) : '');
  useEffect(() => {
    if (!photo.file) return;
    const value = URL.createObjectURL(photo.file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [photo.file]);
  return (
    <div className="listing-photo-preview">
      <img src={url || undefined} alt={`ফসলের ছবি ${bangla(index + 1)}`} />
      {index === 0 && <span>প্রধান ছবি</span>}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`ছবি ${bangla(index + 1)} সরান`}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function ListingFormContent({ id }) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const profile = user.farmerProfile;
  const [form, setForm] = useState({
    cropName: '',
    quantity: '',
    unit: 'kg',
    pricePerUnit: '',
    harvestDate: '',
    availableDate: '',
    district: profile?.district || '',
    upazila: profile?.upazila || '',
    farmAddress: profile?.farmAddress || '',
    description: '',
  });
  const [listing, setListing] = useState(null),
    [photos, setPhotos] = useState([]),
    [loading, setLoading] = useState(Boolean(id)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [fields, setFields] = useState({}),
    [loadFailure, setLoadFailure] = useState(false),
    [stale, setStale] = useState(false),
    [revision, setRevision] = useState(0);
  const alert = useRef(null),
    picker = useRef(null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setLoadFailure(false);
    setError('');
    apiRequest(`farmer/listings/${id}`)
      .then((result) => {
        if (!active) return;
        const row = result.listing;
        setListing(row);
        setForm(
          Object.fromEntries(
            [
              'cropName',
              'quantity',
              'unit',
              'pricePerUnit',
              'harvestDate',
              'availableDate',
              'district',
              'upazila',
              'farmAddress',
              'description',
            ].map((key) => [key, String(row[key])]),
          ),
        );
        setPhotos(row.photos);
        setFields({});
        setStale(false);
      })
      .catch((failure) => {
        if (active) {
          setError(failure.message);
          setLoadFailure(true);
          if (failure.status === 401 || failure.status === 403) refresh();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, revision, refresh]);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFields((current) => ({ ...current, [name]: undefined }));
  }
  function choosePhotos(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected.length) return;
    let problem = '';
    if (photos.length + selected.length > 5) problem = 'মোট সর্বোচ্চ ৫টি ছবি রাখতে পারবেন।';
    else if (
      selected.some(
        (file) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
          file.size > 2 * 1024 * 1024,
      )
    )
      problem = 'JPG, PNG অথবা WebP ছবি দিন; প্রতিটি সর্বোচ্চ ২ মেগাবাইট।';
    setFields((current) => ({ ...current, photos: problem || undefined }));
    if (!problem)
      setPhotos((current) => [
        ...current,
        ...selected.map((file) => ({ file, key: crypto.randomUUID() })),
      ]);
  }
  async function submit(event) {
    event.preventDefault();
    setError('');
    const issues = listingErrors(
      form,
      photos.length,
      listing?.status === 'sold_out' || Number(listing?.reservedQuantity) > 0,
    );
    setFields(issues);
    if (Object.keys(issues).length) {
      setError('চিহ্নিত তথ্যগুলো ঠিক করে আবার চেষ্টা করুন।');
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      body.append(
        'retainedPhotos',
        JSON.stringify(photos.filter((photo) => !photo.file).map((photo) => photo.filename)),
      );
      photos.filter((photo) => photo.file).forEach((photo) => body.append('photos', photo.file));
      if (id) body.append('version', String(listing.version));
      const result = await apiRequest(`farmer/listings${id ? `/${id}` : ''}`, {
        method: id ? 'PUT' : 'POST',
        body,
      });
      navigate('/account/listings', { replace: true, state: { listingMessage: result.message } });
    } catch (failure) {
      setError(failure.message);
      setFields(failure.fields || {});
      setStale(failure.status === 409);
      if (failure.status === 401 || failure.status === 403) refresh();
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <section className="page-container account-loading" role="status">
        <LoaderCircle className="spin" size={23} aria-hidden="true" /> বিজ্ঞাপনের তথ্য দেখা হচ্ছে…
      </section>
    );
  return (
    <section className="page-container listings-page listing-form-page">
      <div className="listing-page-heading">
        <div>
          <span className="eyebrow">
            <Sprout size={17} aria-hidden="true" /> কৃষকের আঙিনা
          </span>
          <h1>{id ? 'বিজ্ঞাপন সম্পাদনা করুন' : 'নতুন ফসলের বিজ্ঞাপন'}</h1>
          <p>
            {id
              ? 'ফসলের তথ্য, দাম ও মজুতের পরিমাণ হালনাগাদ রাখুন।'
              : 'আপনার ফসলের সঠিক তথ্য দিন। তারকা চিহ্নিত সব ঘর পূরণ করুন।'}
          </p>
        </div>
        {listing && (
          <span className={`listing-status listing-status-${listing.status}`}>
            {statusLabels[listing.status]}
          </span>
        )}
      </div>
      {error && (
        <div className="form-alert listing-error" role="alert" ref={alert} tabIndex={-1}>
          <p>{error}</p>
          {(stale || loadFailure) && (
            <button
              type="button"
              className="text-button"
              onClick={() => setRevision((value) => value + 1)}
            >
              সর্বশেষ তথ্য আনুন
            </button>
          )}
        </div>
      )}
      {!loadFailure && (
        <form className="listing-form-layout" onSubmit={submit} noValidate>
          <div className="listing-form-main">
            {Number(listing?.reservedQuantity) > 0 && (
              <p className="listing-info">
                অর্ডারের জন্য সংরক্ষিত {formatAmount(listing.reservedQuantity)}{' '}
                {unitLabels[listing.unit]}। নিচে শুধু অর্ডারের জন্য উন্মুক্ত মজুত লিখুন। ফসলের নাম ও
                একক এখন বদলানো যাবে না।
              </p>
            )}
            {listing?.status === 'sold_out' && (
              <p className="listing-info">
                <Info size={18} aria-hidden="true" /> নতুন মজুতের পরিমাণ দিয়ে সংরক্ষণ করুন। এরপর
                তালিকা থেকে বিজ্ঞাপন আবার চালু করতে পারবেন।
              </p>
            )}
            <fieldset className="listing-form-card" disabled={busy}>
              <legend>
                <Sprout size={18} aria-hidden="true" /> ফসলের তথ্য
              </legend>
              <div className="listing-fields">
                <div className="form-full">
                  <FormField
                    name="cropName"
                    disabled={Number(listing?.reservedQuantity) > 0}
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
                  label="অর্ডারের জন্য উন্মুক্ত মজুত"
                  value={form.quantity}
                  onChange={change}
                  inputMode="decimal"
                  maxLength={13}
                  placeholder="যেমন: ৫০০"
                  error={fields.quantity}
                />
                <FormField
                  name="unit"
                  disabled={Number(listing?.reservedQuantity) > 0}
                  label="একক"
                  value={form.unit}
                  onChange={change}
                  error={fields.unit}
                  options={Object.entries(unitLabels).map(([value, label]) => ({ value, label }))}
                />
                <div className="form-full">
                  <FormField
                    name="pricePerUnit"
                    label={`প্রতি ${unitLabels[form.unit]} প্রত্যাশিত দাম (টাকা)`}
                    value={form.pricePerUnit}
                    onChange={change}
                    inputMode="decimal"
                    maxLength={13}
                    placeholder="যেমন: ২৫.৫০"
                    hint="নির্বাচিত এককের জন্য দাম লিখুন; সর্বোচ্চ ২ ঘর দশমিক।"
                    error={fields.pricePerUnit}
                  />
                </div>
              </div>
            </fieldset>
            <fieldset className="listing-form-card" disabled={busy}>
              <legend>
                <CalendarDays size={18} aria-hidden="true" /> ফসল কাটা ও সরবরাহ
              </legend>
              <div className="listing-fields">
                <FormField
                  name="harvestDate"
                  label="ফসল কাটার তারিখ"
                  type="date"
                  value={form.harvestDate}
                  onChange={change}
                  min="1900-01-01"
                  max="9999-12-31"
                  error={fields.harvestDate}
                />
                <FormField
                  name="availableDate"
                  label="সরবরাহ শুরুর তারিখ"
                  type="date"
                  value={form.availableDate}
                  onChange={change}
                  min={form.harvestDate || '1900-01-01'}
                  max="9999-12-31"
                  error={fields.availableDate}
                />
              </div>
            </fieldset>
            <fieldset className="listing-form-card" disabled={busy}>
              <legend>
                <MapPin size={18} aria-hidden="true" /> খামারের অবস্থান
              </legend>
              <p className="field-hint listing-location-hint">
                আপনার প্রোফাইলের ঠিকানা দেওয়া আছে। এই ফসলের অবস্থান আলাদা হলে বদলে দিন।
              </p>
              <div className="listing-fields">
                <FormField
                  name="district"
                  label="জেলা"
                  value={form.district}
                  onChange={change}
                  maxLength={80}
                  error={fields.district}
                />
                <FormField
                  name="upazila"
                  label="উপজেলা"
                  value={form.upazila}
                  onChange={change}
                  maxLength={80}
                  error={fields.upazila}
                />
                <div className="form-full">
                  <FormField
                    name="farmAddress"
                    label="খামারের পূর্ণ ঠিকানা"
                    multiline
                    rows={2}
                    value={form.farmAddress}
                    onChange={change}
                    maxLength={500}
                    error={fields.farmAddress}
                  />
                </div>
              </div>
            </fieldset>
            <fieldset className="listing-form-card" disabled={busy}>
              <legend>ফসলের বিস্তারিত</legend>
              <FormField
                name="description"
                label="অতিরিক্ত বিবরণ"
                multiline
                rows={4}
                value={form.description}
                onChange={change}
                maxLength={2000}
                placeholder="ফসলের জাত, সংগ্রহ বা সংরক্ষণ সম্পর্কে প্রয়োজনীয় তথ্য লিখুন।"
                error={fields.description}
                hint={`${bangla(form.description.length)} / ২০০০ অক্ষর`}
              />
            </fieldset>
          </div>
          <aside className="listing-form-side">
            <fieldset className="listing-form-card" disabled={busy}>
              <legend>
                <Camera size={18} aria-hidden="true" /> ফসলের ছবি{' '}
                <span className="required-mark" aria-label="আবশ্যক">
                  *
                </span>
              </legend>
              <p className="field-hint">
                নিজের ফসলের ১–৫টি পরিষ্কার ছবি দিন। JPG, PNG বা WebP; প্রতিটি সর্বোচ্চ ২ মেগাবাইট।
                প্রথম ছবিটি প্রধান ছবি হবে।
              </p>
              <div className="listing-photo-grid">
                {photos.map((photo, index) => (
                  <PhotoPreview
                    key={photo.filename || photo.key}
                    photo={photo}
                    index={index}
                    disabled={busy}
                    onRemove={() => {
                      setPhotos((current) => current.filter((_, position) => position !== index));
                      setFields((current) => ({ ...current, photos: undefined }));
                    }}
                  />
                ))}
              </div>
              <input
                ref={picker}
                id="listing-photos"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-label="ফসলের ছবি বেছে নিন"
                onChange={choosePhotos}
                aria-invalid={Boolean(fields.photos)}
                aria-describedby={fields.photos ? 'listing-photo-error' : undefined}
              />
              <button
                type="button"
                className="listing-photo-picker"
                aria-describedby={fields.photos ? 'listing-photo-error' : undefined}
                aria-invalid={Boolean(fields.photos)}
                onClick={() => picker.current?.click()}
                disabled={busy || photos.length >= 5}
              >
                <ImagePlus size={22} aria-hidden="true" /> ছবি বেছে নিন{' '}
                <span>{bangla(photos.length)} / ৫টি ছবি</span>
              </button>
              {fields.photos && (
                <p id="listing-photo-error" className="field-error" role="alert">
                  {fields.photos}
                </p>
              )}
            </fieldset>
            <div className="listing-publish-card">
              <p>
                <Check size={17} aria-hidden="true" />{' '}
                {id
                  ? 'সংরক্ষণ করলে বিজ্ঞাপনের তথ্য হালনাগাদ হবে। বর্তমান অবস্থা একই থাকবে।'
                  : 'চালু বিজ্ঞাপন বাজারে দেখা যাবে। অনুমোদিত ক্রেতারা দাম ও আপনার যোগাযোগের তথ্য দেখতে পারবেন।'}
              </p>
              <button type="submit" className="button button-primary" disabled={busy || stale}>
                {busy && <LoaderCircle className="spin" size={17} aria-hidden="true" />}
                {busy
                  ? 'সংরক্ষণ করা হচ্ছে…'
                  : id
                    ? 'পরিবর্তন সংরক্ষণ করুন'
                    : 'বিজ্ঞাপন প্রকাশ করুন'}
              </button>
              <Link className="text-link" to="/account/listings">
                বাতিল করে তালিকায় ফিরুন
              </Link>
            </div>
          </aside>
        </form>
      )}
    </section>
  );
}

export default function ListingForm() {
  const { id } = useParams();
  return (
    <AuthGate role="farmer">
      <ListingFormContent key={id || 'new'} id={id} />
    </AuthGate>
  );
}
