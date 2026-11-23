import { useEffect } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import {
  SearchCheck,
  RefreshCw,
  LoaderCircle,
  Phone,
  MapPin,
  UserRound,
  Search,
} from 'lucide-react';
import AuthGate from '../components/AuthGate.jsx';
import OrderButton from '../components/OrderButton.jsx';
import MarketCropCard from '../components/MarketCropCard.jsx';
import { useApiResource } from '../lib/resource.js';
import { useAuth } from '../context/AuthContext.jsx';
import { bangla } from '../lib/registration.js';
import MatchingRequirementSummary, {
  MatchingTabs,
} from '../components/MatchingRequirementSummary.jsx';

function MatchesContent() {
  const { id } = useParams(),
    location = useLocation(),
    { refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const { data, loading, error, reload } = useApiResource(
    `buyer/requirements/${id}/matches${query ? `?${query}` : ''}`,
  );
  useEffect(() => {
    if ([401, 403].includes(error?.status)) refresh();
  }, [error, refresh]);
  function page(number) {
    const next = new URLSearchParams(params);
    next.set('page', String(number));
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  if (loading)
    return (
      <section className="page-container account-loading" role="status">
        <LoaderCircle className="spin" size={23} aria-hidden="true" /> চাহিদার সঙ্গে মিলে যাওয়া ফসল
        খোঁজা হচ্ছে…
      </section>
    );
  if (error)
    return (
      <section className="page-container account-loading">
        <h1 className="section-title">
          {error.status === 404 ? 'চাহিদাটি খুঁজে পাওয়া যায়নি।' : 'মিলে যাওয়া ফসল দেখা যাচ্ছে না।'}
        </h1>
        <p className="form-alert" role="alert">
          {error.message}
        </p>
        <div className="requirement-gate-actions">
          <button className="button button-secondary" onClick={reload}>
            আবার চেষ্টা করুন
          </button>
          {error.status === 422 && (
            <button className="button button-secondary" onClick={() => setParams({})}>
              সাজানো ও পাতার তথ্য মুছুন
            </button>
          )}
          <Link className="button button-primary" to="/requirements">
            আমার ক্রয় চাহিদায় ফিরুন
          </Link>
        </div>
      </section>
    );
  const { requirement } = data;
  const marketUrl = `/marketplace?${new URLSearchParams({ q: requirement.cropName, unit: requirement.unit, minQuantity: requirement.quantity })}`;
  return (
    <section className="page-container market-page">
      <Link className="text-link listing-back" to="/requirements">
        আমার ক্রয় চাহিদা
      </Link>
      <div className="market-heading">
        <div>
          <span className="eyebrow">
            <SearchCheck size={17} aria-hidden="true" /> একক কৃষকের সরবরাহ
          </span>
          <h1>চাহিদার সঙ্গে মিলে যাওয়া ফসল</h1>
          <p>একটি বিজ্ঞাপন থেকেই আপনার পুরো প্রয়োজন মেটাতে পারে এমন ফসল দেখুন।</p>
        </div>
        <button type="button" className="button button-secondary" onClick={reload}>
          <RefreshCw size={16} aria-hidden="true" /> তথ্য হালনাগাদ করুন
        </button>
      </div>
      <MatchingTabs id={id} />
      <MatchingRequirementSummary requirement={requirement} />
      <p className="matching-rules">
        ফসলের নাম ও একক একই, বিজ্ঞাপন চালু এবং মজুত আপনার চাহিদার সমান বা বেশি। সব জেলার মিল এখানে
        দেখা যাবে।
      </p>
      <div className="market-results-toolbar">
        <p role="status">{bangla(data.total)}টি বিজ্ঞাপন পুরো পরিমাণ দিতে পারবে</p>
        <div className="market-sort">
          <label htmlFor="matching-sort">সাজান</label>
          <select
            id="matching-sort"
            value={data.sort}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              next.set('sort', event.target.value);
              next.delete('page');
              setParams(next);
            }}
          >
            <option value="available_asc">আগে সরবরাহ হবে</option>
            <option value="harvest_asc">আগে ফসল কাটা হবে</option>
            <option value="price_asc">কম দাম আগে</option>
            <option value="price_desc">বেশি দাম আগে</option>
          </select>
        </div>
      </div>
      {data.listings.length ? (
        <>
          <div className="listing-grid matching-grid">
            {data.listings.map((listing) => (
              <MarketCropCard
                key={listing.id}
                listing={listing}
                from={location.pathname + location.search}
              >
                <div className="matching-farmer">
                  <h3>
                    <UserRound size={16} aria-hidden="true" /> {listing.farmer.fullName}
                  </h3>
                  {listing.farmer.farmName && (
                    <p className="matching-farm-name">{listing.farmer.farmName}</p>
                  )}
                  <a href={`tel:+88${listing.farmer.phone}`}>
                    <Phone size={15} aria-hidden="true" /> {bangla(listing.farmer.phone)}
                  </a>
                  <p className="matching-farm-address">
                    <MapPin size={15} aria-hidden="true" />
                    <span>{listing.farmer.farmAddress}</span>
                  </p>
                </div>
                <OrderButton requirement={requirement} listingIds={[listing.id]} />
              </MarketCropCard>
            ))}
          </div>
          {data.pages > 1 && (
            <nav className="review-pagination" aria-label="মিলে যাওয়া ফসলের পাতা">
              <button
                className="button button-secondary"
                disabled={data.page <= 1}
                onClick={() => page(data.page - 1)}
              >
                আগের পাতা
              </button>
              <span>
                পাতা {bangla(data.page)} / {bangla(data.pages)}
              </span>
              <button
                className="button button-secondary"
                disabled={data.page >= data.pages}
                onClick={() => page(data.page + 1)}
              >
                পরের পাতা
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="listing-empty">
          <span className="listing-empty-icon">
            <Search size={30} aria-hidden="true" />
          </span>
          <h2>
            {data.page > 1 ? 'এই পাতায় কোনো মিল নেই' : 'একটি বিজ্ঞাপনে পুরো পরিমাণ পাওয়া যাচ্ছে না'}
          </h2>
          <p>
            ফসলের নাম ও একক একরকম না হলে মিল দেখাবে না। নতুন মজুত যোগ হলে আবার হালনাগাদ করে দেখুন।
          </p>
          <div className="requirement-gate-actions">
            {data.page > 1 && (
              <button className="button button-secondary" onClick={() => page(1)}>
                প্রথম পাতায় যান
              </button>
            )}
            <Link className="button button-primary" to={marketUrl}>
              বাজারে ফসল খুঁজুন
            </Link>
            <button className="button button-secondary" onClick={reload}>
              আবার খুঁজুন
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function RequirementMatches() {
  return (
    <AuthGate role="buyer" approvedBuyer>
      <MatchesContent />
    </AuthGate>
  );
}
