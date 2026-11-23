import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  Sprout,
  MapPin,
  CalendarDays,
  PackageCheck,
  Phone,
  UserRound,
  LockKeyhole,
  LoaderCircle,
  MapPinOff,
} from 'lucide-react';
import MarketAccessNotice from '../components/MarketAccessNotice.jsx';
import { useMarketResource } from '../lib/marketplace.js';
import { mediaUrl } from '../lib/api.js';
import { bangla } from '../lib/registration.js';
import { unitLabels, formatAmount, formatDate } from '../lib/listings.js';

function PhotoGallery({ listing }) {
  const [selected, setSelected] = useState(0);
  return (
    <div className="market-gallery">
      <div className="market-main-photo">
        <img
          key={selected}
          src={mediaUrl(listing.photos[selected]?.url)}
          alt={`${listing.cropName} ফসলের ছবি ${bangla(selected + 1)}`}
        />
      </div>
      {listing.photos.length > 1 && (
        <div className="market-thumbnails" aria-label="ফসলের ছবিগুলো">
          {listing.photos.map((photo, index) => (
            <button
              type="button"
              key={photo.url}
              aria-label={`ফসলের ছবি ${bangla(index + 1)} দেখুন`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              <img src={mediaUrl(photo.url)} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketListing() {
  const { id } = useParams();
  const location = useLocation();
  const matchingFrom =
    typeof location.state?.from === 'string' &&
    /^\/requirements\/[a-f0-9-]{36}\/matches(?:\?|$)/.test(location.state.from);
  const backLabel = matchingFrom ? 'মিলে যাওয়া ফসলে ফিরুন' : 'ফসলের বাজারে ফিরুন';
  const from =
    typeof location.state?.from === 'string' &&
    (matchingFrom || /^\/marketplace(?:\?|$)/.test(location.state.from))
      ? location.state.from
      : '/marketplace';
  const { data, loading, error, reload } = useMarketResource(`marketplace/listings/${id}`);
  if (loading)
    return (
      <section className="page-container account-loading" role="status">
        <LoaderCircle className="spin" size={23} aria-hidden="true" /> ফসলের বিস্তারিত দেখা হচ্ছে…
      </section>
    );
  if (error?.status === 404)
    return (
      <section className="page-container market-unavailable">
        <MapPinOff size={45} aria-hidden="true" />
        <span className="eyebrow">বিজ্ঞাপনটি এখন পাওয়া যাচ্ছে না</span>
        <h1>এই ফসলের বিজ্ঞাপনটি বাজারে নেই।</h1>
        <p>বিক্রি শেষ হয়ে যেতে পারে, অথবা কৃষক বিজ্ঞাপনটি বন্ধ বা মুছে ফেলেছেন।</p>
        <Link className="button button-primary" to={from}>
          {backLabel}
        </Link>
      </section>
    );
  if (error)
    return (
      <section className="page-container account-loading">
        <p className="form-alert" role="alert">
          {error.message}
        </p>
        <button className="button button-primary" onClick={reload}>
          আবার চেষ্টা করুন
        </button>
        <Link className="text-link" to={from}>
          {backLabel}
        </Link>
      </section>
    );
  const { listing, access } = data;
  return (
    <section className="page-container market-page">
      <Link className="text-link listing-back" to={from}>
        {backLabel}
      </Link>
      <div className="market-heading">
        <div>
          <span className="eyebrow">
            <Sprout size={17} aria-hidden="true" /> কৃষকের ফসল
          </span>
          <h1>{listing.cropName}</h1>
          <p className="crop-location">
            <MapPin size={16} aria-hidden="true" /> {listing.upazila}, {listing.district}
          </p>
        </div>
        <button className="button button-secondary" type="button" onClick={reload}>
          তথ্য হালনাগাদ করুন
        </button>
      </div>
      <MarketAccessNotice access={access} />
      <div className="market-detail-grid">
        <div>
          <PhotoGallery key={listing.id} listing={listing} />
          {listing.description !== undefined && (
            <article className="market-description">
              <h2>ফসল সম্পর্কে</h2>
              <p>{listing.description}</p>
            </article>
          )}
        </div>
        <div className="market-detail-side">
          <article className="market-summary-card">
            <h2>মজুত ও সরবরাহের তথ্য</h2>
            <dl className="market-detail-figures">
              <div>
                <dt>মজুতের পরিমাণ</dt>
                <dd>
                  {formatAmount(listing.quantity)} <span>{unitLabels[listing.unit]}</span>
                </dd>
              </div>
              <div>
                <dt>প্রতি {unitLabels[listing.unit]} প্রত্যাশিত দাম</dt>
                <dd>
                  {listing.pricePerUnit !== undefined ? (
                    `৳${formatAmount(listing.pricePerUnit)}`
                  ) : (
                    <span className="market-price-locked">
                      <LockKeyhole size={17} aria-hidden="true" /> অনুমোদনের পর দেখা যাবে
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            <dl className="market-detail-dates">
              <div>
                <dt>
                  <CalendarDays size={17} aria-hidden="true" /> ফসল কাটার তারিখ
                </dt>
                <dd>{formatDate(listing.harvestDate)}</dd>
              </div>
              <div>
                <dt>
                  <PackageCheck size={17} aria-hidden="true" /> সরবরাহ শুরুর তারিখ
                </dt>
                <dd>{formatDate(listing.availableDate)}</dd>
              </div>
            </dl>
          </article>
          <article className="market-farmer-card">
            <h2>
              <UserRound size={20} aria-hidden="true" /> কৃষকের তথ্য
            </h2>
            {listing.farmer ? (
              <>
                <h3>{listing.farmer.fullName}</h3>
                {listing.farmer.farmName && (
                  <p className="market-farm-name">{listing.farmer.farmName}</p>
                )}
                <a className="market-farmer-phone" href={`tel:+88${listing.farmer.phone}`}>
                  <Phone size={18} aria-hidden="true" /> {bangla(listing.farmer.phone)}
                </a>
                <div className="market-farm-address">
                  <MapPin size={18} aria-hidden="true" />
                  <div>
                    <h3>এই ফসলের খামারের ঠিকানা</h3>
                    <p>{listing.farmer.farmAddress}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="market-contact-locked">
                <LockKeyhole size={18} aria-hidden="true" /> কৃষকের নাম, ফোন ও খামারের পূর্ণ ঠিকানা
                দেখতে অনুমোদিত ক্রেতা হিসেবে প্রবেশ করুন।
              </p>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
