import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { LoaderCircle, RefreshCw, UsersRound, Phone, MapPin, X, Search } from 'lucide-react';
import AuthGate from '../components/AuthGate.jsx';
import OrderButton from '../components/OrderButton.jsx';
import MarketCropCard from '../components/MarketCropCard.jsx';
import { useApiResource } from '../lib/resource.js';
import { useAuth } from '../context/AuthContext.jsx';
import { bangla } from '../lib/registration.js';
import { formatAmount, formatDate, unitLabels } from '../lib/listings.js';
import { formatMoney } from '../lib/orders.js';
const units = (value) => {
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'));
};
const labels = {
  exact: 'বাকি পরিমাণের সমান',
  excess: 'বাকি পরিমাণের চেয়ে কিছু বেশি',
  partial: 'আংশিক ঘাটতি পূরণ',
};
function ReplacementContent() {
  const { id } = useParams(),
    { refresh } = useAuth(),
    [params, setParams] = useSearchParams();
  const orderResource = useApiResource(`orders/${id}`),
    order = orderResource.data?.order;
  const canReplace = Boolean(order && Number(order.replacementNeededQuantity) > 0);
  const ranking = params.get('ranking') || 'recommended';
  const manualQuery = new URLSearchParams();
  for (const key of ['district', 'upazila', 'sort', 'page'])
    if (params.has(key)) manualQuery.set(key, params.get(key));
  const recommendations = useApiResource(
    canReplace ? `orders/${id}/replacements?sort=${encodeURIComponent(ranking)}` : null,
  );
  const manual = useApiResource(
    canReplace
      ? `orders/${id}/replacements/listings${manualQuery.size ? `?${manualQuery}` : ''}`
      : null,
  );
  const [selected, setSelected] = useState({}),
    [filters, setFilters] = useState({
      district: params.get('district') || '',
      upazila: params.get('upazila') || '',
      sort: params.get('sort') || 'available_asc',
    });
  useEffect(() => {
    if (
      [orderResource.error, recommendations.error, manual.error].some((error) =>
        [401, 403].includes(error?.status),
      )
    )
      refresh();
  }, [orderResource.error, recommendations.error, manual.error, refresh]);
  useEffect(() => {
    setSelected({});
  }, [id, order?.version]);
  useEffect(() => {
    setFilters({
      district: params.get('district') || '',
      upazila: params.get('upazila') || '',
      sort: params.get('sort') || 'available_asc',
    });
  }, [params]);
  function reloadAll() {
    orderResource.reload();
    recommendations.reload();
    manual.reload();
  }
  function toggle(listing) {
    setSelected((previous) => {
      const next = { ...previous };
      if (next[listing.id]) delete next[listing.id];
      else next[listing.id] = listing;
      return next;
    });
  }
  function changePage(number) {
    const next = new URLSearchParams(params);
    next.set('page', String(number));
    setParams(next);
    document.getElementById('manual-replacements')?.scrollIntoView({ behavior: 'instant' });
  }
  if (orderResource.loading)
    return (
      <section className="page-container account-loading" role="status">
        <LoaderCircle className="spin" size={22} aria-hidden="true" /> অর্ডারের বাকি পরিমাণ দেখা
        হচ্ছে…
      </section>
    );
  if (orderResource.error)
    return (
      <section className="page-container account-loading">
        <h1 className="section-title">
          {orderResource.error.status === 404
            ? 'অর্ডারটি খুঁজে পাওয়া যায়নি।'
            : 'বিকল্প সরবরাহ দেখা যাচ্ছে না।'}
        </h1>
        <p className="form-alert" role="alert">
          {orderResource.error.message}
        </p>
        <div className="requirement-gate-actions">
          <button className="button button-secondary" onClick={reloadAll}>
            আবার চেষ্টা করুন
          </button>
          <Link className="button button-primary" to="/orders">
            আমার অর্ডারে ফিরুন
          </Link>
        </div>
      </section>
    );
  const unit = unitLabels[order.unit],
    members = Object.values(selected),
    gap = units(order.replacementNeededQuantity);
  const rawTotal = members.reduce((sum, listing) => sum + units(listing.quantity), 0n),
    total = members.length === 1 && rawTotal > gap ? gap : rawTotal,
    tooMuch = total * 5n > gap * 6n;
  const outOfDate = [recommendations.data, manual.data].some(
    (data) => data && data.orderVersion !== order.version,
  );
  return (
    <section className="page-container market-page">
      <div className="market-heading">
        <div>
          <span className="eyebrow">
            <UsersRound size={17} aria-hidden="true" /> প্রত্যাখ্যাত অংশের নতুন সরবরাহ
          </span>
          <h1>বিকল্প কৃষক বেছে নিন</h1>
          <p>
            {order.cropName} · অর্ডারের বাকি অংশ {formatAmount(order.replacementNeededQuantity)}{' '}
            {unit}
          </p>
        </div>
      </div>
      {!canReplace ? (
        <div className="listing-empty">
          <UsersRound size={32} aria-hidden="true" />
          <h2>এই অর্ডারে এখন বিকল্প সরবরাহ প্রয়োজন নেই</h2>
          <p>গৃহীত ও অপেক্ষমাণ অংশে অর্ডারের পরিমাণ রয়েছে, অথবা এখনো কোনো অংশ প্রত্যাখ্যাত হয়নি।</p>
          <Link className="button button-primary" to={`/orders/${id}`}>
            অর্ডারের অগ্রগতি দেখুন
          </Link>
        </div>
      ) : (
        <>
          <div className="replacement-context">
            <p>
              বর্তমানে গৃহীত {formatAmount(order.acceptedQuantity)} {unit} · উত্তরের অপেক্ষায়{' '}
              {formatAmount(order.pendingQuantity)} {unit}
            </p>
            <p>
              বর্তমান পণ্যমূল্য {formatMoney(order.currentCost)}। প্রত্যাখ্যানের পুরোনো ইতিহাসে{' '}
              {formatAmount(order.rejectedQuantity)} {unit}; নতুন সরবরাহের লক্ষ্য উপরের বাকি পরিমাণ।
            </p>
          </div>
          <details className="combination-rules">
            <summary>বিকল্প বাছাইয়ের নিয়ম</summary>
            <p>
              অর্ডারের সময়কার ফসলের নাম, একক ও ঠিকানা ব্যবহার করা হয়। আগে এই অর্ডারে থাকা সব কৃষক
              বাদ থাকবেন। নতুন কৃষকের চালু উন্মুক্ত মজুত থেকে বেছে নিন।
            </p>
            <p>
              আগে সমান, তারপর বাকি পরিমাণের সর্বোচ্চ ২০% অতিরিক্ত, শেষে আংশিক সরবরাহ। একই শ্রেণিতে
              আগের সরবরাহ, ফসল কাটার তারিখ, কম দাম, কম কৃষক ও জেলা–উপজেলাভিত্তিক নৈকট্যের নিয়ম
              প্রযোজ্য।
            </p>
            <p>
              একটি বিজ্ঞাপন নিলে বাকি পরিমাণ পর্যন্ত নেওয়া হবে; তার মজুত কম হলে পুরো মজুত নেওয়া হবে।
              একাধিক বিজ্ঞাপন নিলে প্রতিটির পুরো উন্মুক্ত মজুত নেওয়া হবে। নিশ্চিত করার আগে সর্বশেষ
              পরিমাণ ও দাম আবার দেখাবে।
            </p>
          </details>
          {outOfDate && (
            <p className="form-alert" role="alert">
              অর্ডারের তথ্য বদলেছে। উপরের হালনাগাদ বোতাম দিয়ে সর্বশেষ বাকি পরিমাণ আনুন।
            </p>
          )}
          <section
            className="replacement-recommendations"
            aria-labelledby="replacement-recommendations-title"
          >
            <div className="market-results-toolbar">
              <h2 id="replacement-recommendations-title">উপযুক্ত সরবরাহের পরামর্শ</h2>
              <div className="market-sort">
                <label htmlFor="replacement-ranking">সাজান</label>
                <select
                  id="replacement-ranking"
                  value={ranking}
                  onChange={(event) => {
                    const next = new URLSearchParams(params);
                    next.set('ranking', event.target.value);
                    setParams(next);
                  }}
                >
                  <option value="recommended">প্রস্তাবিত ক্রম</option>
                  <option value="price_asc">কম মোট দাম আগে</option>
                  <option value="available_asc">আগে সরবরাহ হবে</option>
                  <option value="harvest_asc">আগে ফসল কাটা হবে</option>
                  <option value="farmers_asc">কম কৃষক আগে</option>
                  <option value="proximity_asc">কাছাকাছি অবস্থান আগে</option>
                </select>
              </div>
            </div>
            {recommendations.loading ? (
              <p className="order-loading" role="status">
                <LoaderCircle className="spin" size={20} aria-hidden="true" /> সেরা সমন্বয় খোঁজা
                হচ্ছে…
              </p>
            ) : recommendations.error ? (
              <div className="form-alert" role="alert">
                <p>{recommendations.error.message}</p>
                <p>নিচে নিজে বিজ্ঞাপন বেছে নেওয়া যাবে।</p>
                <button
                  className="text-link"
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.delete('ranking');
                    setParams(next);
                    recommendations.reload();
                  }}
                >
                  আবার পরামর্শ দেখুন
                </button>
              </div>
            ) : recommendations.data?.recommendations.length ? (
              <div className="replacement-recommendation-grid">
                {recommendations.data.recommendations.map((match) => (
                  <article className="replacement-recommendation-card" key={match.id}>
                    <div className="order-list-top">
                      <h3>{labels[match.fulfilment]}</h3>
                      <span className={`combination-badge combination-${match.fulfilment}`}>
                        {bangla(match.farmerCount)} জন কৃষক
                      </span>
                    </div>
                    <p className="replacement-offer-total">
                      <strong>
                        {formatAmount(match.quantity)} {unit}
                      </strong>{' '}
                      · {formatMoney(match.totalCost)}
                    </p>
                    <p className="field-hint">
                      সব ফসল পাওয়া যাবে {formatDate(match.availableDate)}
                    </p>
                    <p className="field-hint">
                      {match.fulfilment === 'excess'
                        ? `অতিরিক্ত ${formatAmount(match.excessQuantity)} ${unit}`
                        : match.fulfilment === 'partial'
                          ? `আরও বাকি ${formatAmount(match.shortageQuantity)} ${unit}`
                          : 'বাকি পুরো পরিমাণ মিলেছে।'}
                    </p>
                    <details className="replacement-offer-members">
                      <summary>কৃষক ও সরবরাহের তথ্য</summary>
                      {match.listings.map((listing) => (
                        <div key={listing.id}>
                          <strong>{listing.farmer.fullName}</strong>
                          <p>
                            {formatAmount(listing.proposedQuantity)} {unit} · প্রতি {unit}{' '}
                            {formatMoney(listing.pricePerUnit)}
                          </p>
                          <p>
                            {listing.upazila}, {listing.district} · {listing.farmer.farmAddress}
                          </p>
                          <a href={`tel:+88${listing.farmer.phone}`} className="combination-phone">
                            <Phone size={14} aria-hidden="true" />
                            {bangla(listing.farmer.phone)}
                          </a>
                        </div>
                      ))}
                    </details>
                    <OrderButton
                      replacementOrderId={id}
                      listingIds={match.listings.map((listing) => listing.id)}
                      label="এই বিকল্প সরবরাহ বেছে নিন"
                      disabled={outOfDate}
                    />
                  </article>
                ))}
              </div>
            ) : (
              <div className="replacement-empty">
                <p>
                  এখন কোনো উপযুক্ত পরামর্শ পাওয়া যায়নি। নিচে নিজে খুঁজে দেখুন অথবা নতুন মজুত এলে
                  হালনাগাদ করুন।
                </p>
              </div>
            )}
          </section>
          <section
            id="manual-replacements"
            className="replacement-manual"
            aria-labelledby="manual-replacements-title"
          >
            <h2 id="manual-replacements-title">নিজে বিজ্ঞাপন বেছে নিন</h2>
            <form
              className="replacement-filter-form"
              onSubmit={(event) => {
                event.preventDefault();
                const next = new URLSearchParams(params);
                for (const key of ['district', 'upazila', 'sort']) {
                  if (filters[key].trim()) next.set(key, filters[key].trim());
                  else next.delete(key);
                }
                next.delete('page');
                setParams(next);
              }}
            >
              <label>
                জেলা
                <input
                  name="district"
                  value={filters.district}
                  maxLength={80}
                  onChange={(event) => setFilters({ ...filters, district: event.target.value })}
                />
              </label>
              <label>
                উপজেলা
                <input
                  name="upazila"
                  value={filters.upazila}
                  maxLength={80}
                  onChange={(event) => setFilters({ ...filters, upazila: event.target.value })}
                />
              </label>
              <label>
                বিজ্ঞাপন সাজান
                <select
                  value={filters.sort}
                  onChange={(event) => setFilters({ ...filters, sort: event.target.value })}
                >
                  <option value="available_asc">আগে সরবরাহ হবে</option>
                  <option value="price_asc">কম একক দাম আগে</option>
                  <option value="quantity_desc">বেশি মজুত আগে</option>
                </select>
              </label>
              <button className="button button-secondary" type="submit">
                <Search size={16} aria-hidden="true" /> খুঁজুন
              </button>
              <button
                className="text-link"
                type="button"
                onClick={() => {
                  const next = new URLSearchParams();
                  if (params.has('ranking')) next.set('ranking', ranking);
                  setParams(next);
                }}
              >
                বাছাই মুছুন
              </button>
            </form>
            <div className="replacement-selection">
              <div>
                <h3>বেছে নেওয়া বিজ্ঞাপন {bangla(members.length)}টি</h3>
                <p>
                  নিশ্চিত করার আগে পরিমাণ ও দাম আবার দেখে নিতে পারবেন। পাতা বা বাছাই বদলালেও
                  নির্বাচিত বিজ্ঞাপন এখানে থাকবে।
                </p>
              </div>
              {members.length > 0 && (
                <>
                  <ul>
                    {members.map((listing) => (
                      <li key={listing.id}>
                        <span>
                          {listing.farmer.fullName} · মজুত {formatAmount(listing.quantity)} {unit}
                        </span>
                        <button
                          type="button"
                          aria-label={`${listing.farmer.fullName}-এর বিজ্ঞাপন বাদ দিন`}
                          onClick={() => toggle(listing)}
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {tooMuch && (
                    <p className="form-alert" role="alert">
                      বেছে নেওয়া পুরো মজুত বাকি পরিমাণের ২০% অতিরিক্ত সীমা ছাড়িয়েছে। কিছু বিজ্ঞাপন
                      বাদ দিন।
                    </p>
                  )}
                  <OrderButton
                    replacementOrderId={id}
                    listingIds={members.map((listing) => listing.id)}
                    label="বেছে নেওয়া সরবরাহ যাচাই করুন"
                    disabled={tooMuch || outOfDate}
                  />
                </>
              )}
            </div>
            {manual.loading ? (
              <p className="order-loading" role="status">
                <LoaderCircle className="spin" size={20} aria-hidden="true" /> বিজ্ঞাপন আনা হচ্ছে…
              </p>
            ) : manual.error ? (
              <div className="form-alert" role="alert">
                <p>{manual.error.message}</p>
                <button className="text-link" onClick={() => setParams({})}>
                  বাছাই ও পাতার তথ্য মুছুন
                </button>
              </div>
            ) : manual.data?.listings.length ? (
              <>
                <p className="matching-rules" role="status">
                  যোগ্য বিজ্ঞাপন {bangla(manual.data.total)}টি
                </p>
                <div className="listing-grid">
                  {manual.data.listings.map((listing) => (
                    <div
                      className={`replacement-manual-card ${selected[listing.id] ? 'is-selected' : ''}`}
                      key={listing.id}
                    >
                      <MarketCropCard
                        listing={listing}
                        from={`/orders/${id}/replacements${params.size ? `?${params}` : ''}`}
                      >
                        <p className="replacement-farmer-name">{listing.farmer.fullName}</p>
                        <label className="replacement-checkbox">
                          <input
                            type="checkbox"
                            checked={Boolean(selected[listing.id])}
                            onChange={() => toggle(listing)}
                            aria-label={`${listing.farmer.fullName}-এর বিজ্ঞাপন বেছে নিন`}
                          />
                          {selected[listing.id] ? 'বেছে নেওয়া আছে' : 'এই বিজ্ঞাপন বেছে নিন'}
                        </label>
                      </MarketCropCard>
                    </div>
                  ))}
                </div>
                {manual.data.pages > 1 && (
                  <nav className="review-pagination" aria-label="বিকল্প বিজ্ঞাপনের পাতা">
                    <button
                      className="button button-secondary"
                      disabled={manual.data.page <= 1}
                      onClick={() => changePage(manual.data.page - 1)}
                    >
                      আগের পাতা
                    </button>
                    <span>
                      পাতা {bangla(manual.data.page)} / {bangla(manual.data.pages)}
                    </span>
                    <button
                      className="button button-secondary"
                      disabled={manual.data.page >= manual.data.pages}
                      onClick={() => changePage(manual.data.page + 1)}
                    >
                      পরের পাতা
                    </button>
                  </nav>
                )}
              </>
            ) : (
              <div className="listing-empty">
                <MapPin size={30} aria-hidden="true" />
                <h3>
                  {manual.data?.page > 1
                    ? 'এই পাতায় কোনো বিজ্ঞাপন নেই'
                    : 'এই বাছাইয়ে যোগ্য নতুন কৃষকের বিজ্ঞাপন নেই'}
                </h3>
                <p>জেলা–উপজেলার বাছাই মুছে দেখুন অথবা নতুন মজুত এলে আবার হালনাগাদ করুন।</p>
                <button className="button button-secondary" onClick={() => setParams({})}>
                  সব যোগ্য বিজ্ঞাপন দেখুন
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
export default function OrderReplacements() {
  return (
    <AuthGate
      role="buyer"
      approvedBuyer
      approvalTitle="বিকল্প সরবরাহ বাছাইয়ের জন্য অনুমোদন নেই।"
    >
      <ReplacementContent />
    </AuthGate>
  );
}
