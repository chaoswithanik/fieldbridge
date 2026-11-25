import { Link } from 'react-router-dom';
import { Sprout, MapPin, CalendarDays, PackageCheck, LockKeyhole, Images } from 'lucide-react';
import { mediaUrl } from '../lib/api.js';
import { bangla } from '../lib/registration.js';
import { unitLabels, formatAmount, formatDate } from '../lib/listings.js';

export default function MarketCropCard({ listing, from, children }) {
  const to = `/marketplace/${listing.id}`;
  return (
    <article className="crop-card market-crop-card">
      <Link
        className="crop-card-photo"
        to={to}
        state={{ from }}
        aria-label={`${listing.cropName} বিজ্ঞাপনের বিস্তারিত দেখুন`}
      >
        <Sprout size={36} aria-hidden="true" />
        <img
          src={mediaUrl(listing.photos[0]?.url)}
          alt={`${listing.cropName} ফসলের ছবি`}
          loading="lazy"
          onLoad={(event) => {
            event.currentTarget.hidden = false;
          }}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
        <span className="crop-photo-count">
          <Images size={14} aria-hidden="true" /> {bangla(listing.photos.length)}
        </span>
      </Link>
      <div className="crop-card-content">
        <h2>
          <Link to={to} state={{ from }}>
            {listing.cropName}
          </Link>
        </h2>
        <p className="crop-location">
          <MapPin size={15} aria-hidden="true" /> {listing.upazila}, {listing.district}
        </p>
        <dl className="crop-figures">
          <div>
            <dt>মজুতের পরিমাণ</dt>
            <dd>
              {formatAmount(listing.quantity)} <span>{unitLabels[listing.unit]}</span>
            </dd>
          </div>
          <div>
            <dt>প্রতি {unitLabels[listing.unit]} দাম</dt>
            <dd>
              {listing.pricePerUnit !== undefined ? (
                `৳${formatAmount(listing.pricePerUnit)}`
              ) : (
                <span className="market-price-locked">
                  <LockKeyhole size={14} aria-hidden="true" /> অনুমোদন নেই
                </span>
              )}
            </dd>
          </div>
        </dl>
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
        {children}
        <Link className="button button-secondary market-details-link" to={to} state={{ from }}>
          বিস্তারিত দেখুন
        </Link>
      </div>
    </article>
  );
}
