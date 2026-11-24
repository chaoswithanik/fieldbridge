import { useEffect } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { UsersRound, RefreshCw, LoaderCircle, Search, MapPin, Phone } from 'lucide-react';
import AuthGate from '../components/AuthGate.jsx';
import OrderButton from '../components/OrderButton.jsx';
import MatchingRequirementSummary, {
  MatchingTabs,
} from '../components/MatchingRequirementSummary.jsx';
import { useApiResource } from '../lib/resource.js';
import { useAuth } from '../context/AuthContext.jsx';
import { bangla } from '../lib/registration.js';
import { formatAmount, formatDate, unitLabels } from '../lib/listings.js';

const money = (value) => {
  const [whole, fraction = '00'] = value.split('.');
  return `৳${new Intl.NumberFormat('bn-BD').format(BigInt(whole))}.${bangla(fraction)}`;
};
const labels = {
  exact: 'পুরো চাহিদার সমান',
  excess: 'চাহিদার চেয়ে কিছু বেশি',
  partial: 'আংশিক চাহিদা পূরণ',
};
function CollectiveContent() {
  const { id } = useParams(),
    location = useLocation(),
    { refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const { data, loading, error, reload } = useApiResource(
    `buyer/requirements/${id}/combinations${query ? `?${query}` : ''}`,
  );
  useEffect(() => {
    if ([401, 403].includes(error?.status)) refresh();
  }, [error, refresh]);
  if (loading)
    return (
      <section className="page-container account-loading" role="status">
        <LoaderCircle className="spin" size={23} aria-hidden="true" /> কৃষকদের সম্মিলিত সরবরাহ খোঁজা
        হচ্ছে…
      </section>
    );
  if (error)
    return (
      <section className="page-container account-loading">
        <h1 className="section-title">
          {error.status === 404 ? 'চাহিদাটি খুঁজে পাওয়া যায়নি।' : 'সম্মিলিত সরবরাহ দেখা যাচ্ছে না।'}
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
              সাজানোর তথ্য মুছুন
            </button>
          )}
          <Link className="button button-primary" to="/requirements">
            আমার ক্রয় চাহিদায় ফিরুন
          </Link>
        </div>
      </section>
    );
  const { requirement, combinations } = data,
    unit = unitLabels[requirement.unit];
  const from = location.pathname + location.search;
  return (
    <section className="page-container market-page">
      <Link className="text-link listing-back" to="/requirements">
        আমার ক্রয় চাহিদা
      </Link>
      <div className="market-heading">
        <div>
          <span className="eyebrow">
            <UsersRound size={17} aria-hidden="true" /> একসঙ্গে চাহিদা পূরণ
          </span>
          <h1>কৃষকদের সম্মিলিত সরবরাহ</h1>
          <p>একজন বা একাধিক কৃষকের ফসল মিলিয়ে আপনার প্রয়োজন মেটানোর সর্বোচ্চ পাঁচটি সমন্বয়।</p>
        </div>
      </div>
      <MatchingTabs id={id} />
      <MatchingRequirementSummary requirement={requirement} />
      <div className="market-results-toolbar">
        <p role="status">{bangla(combinations.length)}টি সমন্বয় পাওয়া গেছে</p>
        <div className="market-sort">
          <label htmlFor="collective-sort">সাজান</label>
          <select
            id="collective-sort"
            value={data.sort}
            onChange={(event) =>
              setParams(event.target.value === 'recommended' ? {} : { sort: event.target.value })
            }
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
      {combinations.length ? (
        <div className="combination-list">
          {combinations.map((combination, index) => (
            <article className="combination-card" key={combination.id}>
              <div className="combination-heading">
                <h2>{labels[combination.fulfilment]}</h2>
                <span className={`combination-badge combination-${combination.fulfilment}`}>
                  {combination.fulfilment === 'exact'
                    ? 'পরিমাণে সঠিক মিল'
                    : combination.fulfilment === 'excess'
                      ? '২০% সীমার মধ্যে'
                      : 'পুরো পরিমাণ পাওয়া যাচ্ছে না'}
                </span>
              </div>
              <dl className="combination-figures">
                <div>
                  <dt>মোট পরিমাণ</dt>
                  <dd>
                    {formatAmount(combination.quantity)} <span>{unit}</span>
                  </dd>
                </div>
                <div>
                  <dt>মোট পণ্যমূল্য</dt>
                  <dd>{money(combination.totalCost)}</dd>
                </div>
                <div>
                  <dt>কৃষকের সংখ্যা</dt>
                  <dd>
                    {bangla(combination.farmerCount)} <span>জন</span>
                  </dd>
                </div>
                <div>
                  <dt>সব ফসল পাওয়া যাবে</dt>
                  <dd className="combination-date">{formatDate(combination.availableDate)}</dd>
                </div>
              </dl>
              <div className="combination-notes">
                <p>
                  {combination.fulfilment === 'excess' ? (
                    <>
                      অতিরিক্ত {formatAmount(combination.excessQuantity)} {unit}
                    </>
                  ) : combination.fulfilment === 'partial' ? (
                    <>
                      আরও প্রয়োজন {formatAmount(combination.shortageQuantity)} {unit}
                    </>
                  ) : (
                    'আপনার প্রয়োজনের পুরো পরিমাণ মিলেছে।'
                  )}
                </p>
                <p>
                  সব ফসল কাটা হবে {formatDate(combination.harvestDate)} ·{' '}
                  {combination.farmerCount === 1
                    ? 'একজন কৃষকের অবস্থান'
                    : combination.proximity.differentDistrictPairs
                      ? 'একাধিক জেলার অবস্থান'
                      : combination.proximity.sameDistrictPairs
                        ? 'একই জেলার বিভিন্ন উপজেলা'
                        : 'একই উপজেলার অবস্থান'}
                </p>
              </div>
              <details className="combination-members" open={index === 0}>
                <summary>{bangla(combination.farmerCount)} জন কৃষকের সরবরাহ দেখুন</summary>
                <div>
                  {combination.listings.map((listing) => (
                    <section
                      className="combination-member"
                      key={listing.id}
                      aria-label={`${listing.farmer.fullName}-এর সরবরাহ`}
                    >
                      <div className="combination-member-top">
                        <div>
                          <h3>{listing.farmer.fullName}</h3>
                          {listing.farmer.farmName && <p>{listing.farmer.farmName}</p>}
                        </div>
                        <a className="combination-phone" href={`tel:+88${listing.farmer.phone}`}>
                          <Phone size={15} aria-hidden="true" />
                          {bangla(listing.farmer.phone)}
                        </a>
                      </div>
                      <p>
                        <strong>
                          {formatAmount(listing.quantity)} {unit}
                        </strong>{' '}
                        · প্রতি {unit} {money(listing.pricePerUnit)} · উপমোট{' '}
                        {money(listing.subtotal)}
                      </p>
                      <p>
                        ফসল কাটা {formatDate(listing.harvestDate)} · সরবরাহ শুরু{' '}
                        {formatDate(listing.availableDate)}
                      </p>
                      <p className="combination-address">
                        <MapPin size={15} aria-hidden="true" />
                        <span>
                          {listing.farmer.farmAddress} · {listing.upazila}, {listing.district}
                        </span>
                      </p>
                      <Link
                        className="text-link"
                        to={`/marketplace/${listing.id}`}
                        state={{ from }}
                      >
                        ফসলের বিস্তারিত দেখুন
                      </Link>
                    </section>
                  ))}
                </div>
              </details>
              <OrderButton
                requirement={requirement}
                listingIds={combination.listings.map((listing) => listing.id)}
                collective
              />
            </article>
          ))}
        </div>
      ) : (
        <div className="listing-empty">
          <span className="listing-empty-icon">
            <Search size={30} aria-hidden="true" />
          </span>
          <h2>উপযুক্ত সরবরাহের সমন্বয় পাওয়া যায়নি</h2>
          <p>একই ফসল ও এককের উপযুক্ত চালু মজুত পাওয়া যায়নি। একক কৃষকের সরবরাহও দেখে নিতে পারেন।</p>
          <Link className="button button-primary" to={`/requirements/${id}/matches`}>
            একক কৃষকের ফসল দেখুন
          </Link>
        </div>
      )}
      <p className="matching-rules">
        এটি বর্তমান মজুতের ভিত্তিতে সম্ভাব্য সরবরাহ। দেখলে চাহিদার সম্পাদনার সুযোগ খরচ হবে না।
        পণ্যমূল্যে পরিবহন খরচ অন্তর্ভুক্ত নয়। অর্ডার নিশ্চিত করলে সংশ্লিষ্ট মজুত সংরক্ষিত থাকবে।
      </p>
    </section>
  );
}
export default function CollectiveMatches() {
  return (
    <AuthGate role="buyer" approvedBuyer>
      <CollectiveContent />
    </AuthGate>
  );
}
