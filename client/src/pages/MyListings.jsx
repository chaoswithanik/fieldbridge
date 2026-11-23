import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  Sprout,
  Plus,
  RefreshCw,
  MapPin,
  CalendarDays,
  Pencil,
  Pause,
  Play,
  PackageCheck,
  Trash2,
  LoaderCircle,
  Images,
} from 'lucide-react';
import AuthGate from '../components/AuthGate.jsx';
import ListingConfirmation from '../components/ListingConfirmation.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest, mediaUrl } from '../lib/api.js';
import { bangla } from '../lib/registration.js';
import { unitLabels, statusLabels, formatAmount, formatDate } from '../lib/listings.js';

function MyListingsContent() {
  const { refresh } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const status = Object.hasOwn(statusLabels, params.get('status')) ? params.get('status') : 'all';
  const requestedPage = Number(params.get('page') || 1);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000
      ? requestedPage
      : 1;
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(''),
    [message, setMessage] = useState(location.state?.listingMessage || ''),
    [busy, setBusy] = useState(false),
    [action, setAction] = useState(null),
    [dialogError, setDialogError] = useState('');
  const alert = useRef(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiRequest(`farmer/listings?status=${status}&page=${page}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((failure) => {
        if (active) {
          setData(null);
          setError(failure.message);
          if (failure.status === 401 || failure.status === 403) refresh();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status, page, revision, refresh]);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  function changePage(nextPage, nextStatus = status) {
    setParams({
      ...(nextStatus !== 'all' ? { status: nextStatus } : {}),
      ...(nextPage > 1 ? { page: String(nextPage) } : {}),
    });
    setMessage('');
  }
  async function mutate(listing, type, nextStatus) {
    setBusy(true);
    setError('');
    setDialogError('');
    setMessage('');
    try {
      const result = await apiRequest(
        `farmer/listings/${listing.id}${type === 'delete' ? '' : '/status'}`,
        {
          method: type === 'delete' ? 'DELETE' : 'PATCH',
          body: JSON.stringify({
            version: listing.version,
            ...(type !== 'delete' ? { status: nextStatus } : {}),
          }),
        },
      );
      setAction(null);
      const leavesPage = type === 'delete' || (status !== 'all' && nextStatus !== status);
      if (leavesPage && data?.listings.length === 1 && page > 1) changePage(page - 1);
      else setRevision((value) => value + 1);
      setMessage(result.message);
    } catch (failure) {
      if (action) setDialogError(failure.message);
      else setError(failure.message);
      if (failure.status === 401 || failure.status === 403) refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-container listings-page">
      <Link className="text-link listing-back" to="/account">
        আমার অ্যাকাউন্ট
      </Link>
      <div className="listing-page-heading">
        <div>
          <span className="eyebrow">
            <Sprout size={17} aria-hidden="true" /> কৃষকের আঙিনা
          </span>
          <h1>আমার ফসলের বিজ্ঞাপন</h1>
          <p>আপনার ফসল, মজুত ও সরবরাহের তথ্য এক জায়গায়।</p>
        </div>
        <Link className="button button-primary" to="/account/listings/new">
          <Plus size={18} aria-hidden="true" /> নতুন বিজ্ঞাপন
        </Link>
      </div>
      <div className="listing-toolbar">
        <nav className="listing-filters" aria-label="বিজ্ঞাপনের অবস্থা">
          {Object.entries({ all: 'সব বিজ্ঞাপন', ...statusLabels }).map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-pressed={status === key}
              disabled={busy || loading}
              onClick={() => changePage(1, key)}
            >
              {label}{' '}
              {data && (
                <span>
                  {bangla(
                    key === 'all'
                      ? Object.values(data.counts).reduce((sum, value) => sum + value, 0)
                      : data.counts[key],
                  )}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="listing-refresh"
          disabled={loading || busy}
          onClick={() => setRevision((value) => value + 1)}
        >
          <RefreshCw size={16} aria-hidden="true" /> হালনাগাদ
        </button>
      </div>
      {message && (
        <p className="success-note" role="status">
          {message}
        </p>
      )}
      {error && (
        <div className="form-alert listing-error" role="alert" ref={alert} tabIndex={-1}>
          <p>{error}</p>
          <button
            className="text-button"
            disabled={loading || busy}
            onClick={() => setRevision((value) => value + 1)}
          >
            সর্বশেষ তথ্য আনুন
          </button>
        </div>
      )}
      {loading ? (
        <div className="admin-loading" role="status">
          <LoaderCircle className="spin" size={22} aria-hidden="true" /> বিজ্ঞাপনগুলো দেখা হচ্ছে…
        </div>
      ) : (
        data &&
        (data.listings.length ? (
          <>
            <div className="listing-grid">
              {data.listings.map((listing) => (
                <article
                  className="crop-card"
                  key={listing.id}
                  aria-label={`${listing.cropName} বিজ্ঞাপন`}
                >
                  <div className="crop-card-photo">
                    <Sprout size={36} aria-hidden="true" />
                    <img
                      src={mediaUrl(listing.photos[0]?.url)}
                      alt={`${listing.cropName} ফসলের ছবি`}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                    <span className={`listing-status listing-status-${listing.status}`}>
                      {statusLabels[listing.status]}
                    </span>
                    <span className="crop-photo-count">
                      <Images size={14} aria-hidden="true" /> {bangla(listing.photos.length)}
                    </span>
                  </div>
                  <div className="crop-card-content">
                    <h2>{listing.cropName}</h2>
                    <p className="crop-location">
                      <MapPin size={15} aria-hidden="true" /> {listing.upazila}, {listing.district}
                    </p>
                    <dl className="crop-figures">
                      <div>
                        <dt>অর্ডারের জন্য উন্মুক্ত মজুত</dt>
                        <dd>
                          {formatAmount(listing.quantity)} <span>{unitLabels[listing.unit]}</span>
                        </dd>
                      </div>
                      <div>
                        <dt>প্রতি {unitLabels[listing.unit]} দাম</dt>
                        <dd>৳{formatAmount(listing.pricePerUnit)}</dd>
                      </div>
                    </dl>
                    {Number(listing.reservedQuantity) > 0 && (
                      <p className="listing-info">
                        অর্ডারে সংরক্ষিত {formatAmount(listing.reservedQuantity)}{' '}
                        {unitLabels[listing.unit]}।
                      </p>
                    )}
                    <div className="crop-dates">
                      <p>
                        <CalendarDays size={15} aria-hidden="true" />
                        <span>ফসল কাটা</span>
                        <strong>{formatDate(listing.harvestDate)}</strong>
                      </p>
                      <p>
                        <PackageCheck size={15} aria-hidden="true" />
                        <span>সরবরাহ শুরু</span>
                        <strong>{formatDate(listing.availableDate)}</strong>
                      </p>
                    </div>
                    <div className="crop-actions">
                      <Link
                        className="button button-secondary"
                        to={`/account/listings/${listing.id}/edit`}
                      >
                        <Pencil size={15} aria-hidden="true" /> সম্পাদনা
                      </Link>
                      <button
                        className="button button-secondary"
                        disabled={busy}
                        onClick={() =>
                          mutate(
                            listing,
                            'status',
                            listing.status === 'active' ? 'inactive' : 'active',
                          )
                        }
                      >
                        {listing.status === 'active' ? (
                          <Pause size={15} aria-hidden="true" />
                        ) : (
                          <Play size={15} aria-hidden="true" />
                        )}
                        {listing.status === 'active' ? 'বন্ধ রাখুন' : 'চালু করুন'}
                      </button>
                      {listing.status !== 'sold_out' && (
                        <button
                          className="crop-action-text"
                          disabled={busy || Number(listing.reservedQuantity) > 0}
                          onClick={() => {
                            setDialogError('');
                            setAction({ listing, type: 'sold_out' });
                          }}
                        >
                          <PackageCheck size={15} aria-hidden="true" /> বিক্রি শেষ
                        </button>
                      )}
                      <button
                        className="crop-action-text crop-delete"
                        disabled={busy || Number(listing.reservedQuantity) > 0}
                        onClick={() => {
                          setDialogError('');
                          setAction({ listing, type: 'delete' });
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" /> মুছুন
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {data.pages > 1 && (
              <nav className="review-pagination" aria-label="বিজ্ঞাপনের পাতা">
                <button
                  className="button button-secondary"
                  disabled={page <= 1 || busy}
                  onClick={() => changePage(page - 1)}
                >
                  আগের পাতা
                </button>
                <span>
                  পাতা {bangla(page)} / {bangla(data.pages)}
                </span>
                <button
                  className="button button-secondary"
                  disabled={page >= data.pages || busy}
                  onClick={() => changePage(page + 1)}
                >
                  পরের পাতা
                </button>
              </nav>
            )}
          </>
        ) : (
          <div className="listing-empty">
            <span className="listing-empty-icon">
              <Sprout size={32} aria-hidden="true" />
            </span>
            <h2>
              {status === 'all' ? 'আপনার প্রথম ফসলের বিজ্ঞাপন দিন' : 'এই অবস্থায় কোনো বিজ্ঞাপন নেই'}
            </h2>
            <p>
              {status === 'all'
                ? 'ফসলের ছবি, পরিমাণ ও দাম দিয়ে শুরু করুন। পরে তথ্য বদলাতেও পারবেন।'
                : 'অন্য অবস্থার বিজ্ঞাপন দেখুন অথবা নতুন বিজ্ঞাপন যোগ করুন।'}
            </p>
            {page > 1 ? (
              <button className="button button-secondary" onClick={() => changePage(1)}>
                প্রথম পাতায় ফিরুন
              </button>
            ) : (
              <Link className="button button-primary" to="/account/listings/new">
                <Plus size={17} aria-hidden="true" /> নতুন বিজ্ঞাপন
              </Link>
            )}
          </div>
        ))
      )}
      {action && (
        <ListingConfirmation
          action={action}
          busy={busy}
          error={dialogError}
          onCancel={() => setAction(null)}
          onConfirm={() =>
            mutate(action.listing, action.type === 'delete' ? 'delete' : 'status', 'sold_out')
          }
        />
      )}
    </section>
  );
}

export default function MyListings() {
  return (
    <AuthGate role="farmer">
      <MyListingsContent />
    </AuthGate>
  );
}
