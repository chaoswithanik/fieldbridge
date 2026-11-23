import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, LoaderCircle, RefreshCw } from 'lucide-react';
import OrderAccess from '../components/OrderAccess.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApiResource } from '../lib/resource.js';
import { formatAmount, unitLabels } from '../lib/listings.js';
import { orderLabels, orderDate, formatMoney } from '../lib/orders.js';
import { bangla } from '../lib/registration.js';
function OrdersContent() {
  const { user, refresh } = useAuth(),
    [params, setParams] = useSearchParams();
  const query = params.toString();
  const { data, loading, error, reload } = useApiResource(`orders${query ? `?${query}` : ''}`);
  useEffect(() => {
    if ([401, 403].includes(error?.status)) refresh();
  }, [error, refresh]);
  return (
    <section className="page-container market-page">
      <div className="market-heading">
        <div>
          <span className="eyebrow">
            <ClipboardList size={17} aria-hidden="true" /> অর্ডারের খবর
          </span>
          <h1>আমার অর্ডার</h1>
          <p>
            {user.role === 'farmer'
              ? 'আপনার জন্য আসা অর্ডার ও নিজের অংশের উত্তর দেখুন।'
              : 'আপনার অর্ডার এবং কৃষকদের আলাদা উত্তর দেখুন।'}
          </p>
        </div>
        <button className="button button-secondary" onClick={reload}>
          <RefreshCw size={16} aria-hidden="true" /> তথ্য হালনাগাদ করুন
        </button>
      </div>
      {loading ? (
        <p className="order-loading" role="status">
          <LoaderCircle className="spin" size={20} aria-hidden="true" /> অর্ডার দেখা হচ্ছে…
        </p>
      ) : error ? (
        <div className="form-alert" role="alert">
          <p>{error.message}</p>
          <button className="text-link" onClick={() => setParams({})}>
            প্রথম পাতায় ফিরুন
          </button>
        </div>
      ) : data.orders.length ? (
        <>
          <div className="order-list">
            {data.orders.map((order) => (
              <article className="order-list-card" key={order.id}>
                <div className="order-list-top">
                  <div>
                    <h2>{order.cropName}</h2>
                    <p className="field-hint">{orderDate(order.createdAt)}</p>
                  </div>
                  <span className={`order-badge order-${order.status}`}>
                    {orderLabels[order.status]}
                  </span>
                </div>
                <dl className="order-list-figures">
                  <div>
                    <dt>{user.role === 'farmer' ? 'আপনার সরবরাহ' : 'অর্ডারের পরিমাণ'}</dt>
                    <dd>
                      {formatAmount(order.totalQuantity)} {unitLabels[order.unit]}
                    </dd>
                  </div>
                  <div>
                    <dt>পণ্যমূল্য</dt>
                    <dd>{formatMoney(order.totalCost)}</dd>
                  </div>
                </dl>
                <p className="field-hint">
                  গৃহীত {formatAmount(order.acceptedQuantity)} · উত্তরের অপেক্ষায়{' '}
                  {formatAmount(order.pendingQuantity)} · প্রত্যাখ্যাত{' '}
                  {formatAmount(order.rejectedQuantity)} {unitLabels[order.unit]}
                </p>
                <Link
                  className="button button-secondary order-card-link"
                  to={`/orders/${order.id}`}
                >
                  অর্ডারের বিস্তারিত দেখুন
                </Link>
              </article>
            ))}
          </div>
          {data.pages > 1 && (
            <nav className="review-pagination" aria-label="অর্ডারের পাতা">
              <button
                className="button button-secondary"
                disabled={data.page <= 1}
                onClick={() => {
                  setParams({ page: String(data.page - 1) });
                  window.scrollTo({ top: 0, behavior: 'instant' });
                }}
              >
                আগের পাতা
              </button>
              <span>
                পাতা {bangla(data.page)} / {bangla(data.pages)}
              </span>
              <button
                className="button button-secondary"
                disabled={data.page >= data.pages}
                onClick={() => {
                  setParams({ page: String(data.page + 1) });
                  window.scrollTo({ top: 0, behavior: 'instant' });
                }}
              >
                পরের পাতা
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="listing-empty">
          <ClipboardList size={32} aria-hidden="true" />
          <h2>{data.page > 1 ? 'এই পাতায় কোনো অর্ডার নেই' : 'এখনো কোনো অর্ডার নেই'}</h2>
          <p>
            {user.role === 'farmer'
              ? 'কোনো ক্রেতা অর্ডার দিলে নিজের অংশ এখানে দেখতে পারবেন।'
              : 'ক্রয় চাহিদার সঙ্গে মিলে যাওয়া ফসল থেকে অর্ডার দিন।'}
          </p>
          {data.page > 1 ? (
            <button className="button button-primary" onClick={() => setParams({})}>
              প্রথম পাতায় যান
            </button>
          ) : (
            <Link
              className="button button-primary"
              to={user.role === 'farmer' ? '/account/listings' : '/requirements'}
            >
              {user.role === 'farmer' ? 'আমার বিজ্ঞাপন দেখুন' : 'আমার ক্রয় চাহিদা'}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
export default function Orders() {
  return (
    <OrderAccess>
      <OrdersContent />
    </OrderAccess>
  );
}
