import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, CheckCheck, LoaderCircle, RefreshCw } from 'lucide-react';
import OrderAccess from '../components/OrderAccess.jsx';
import { useApiResource } from '../lib/resource.js';
import { apiRequest } from '../lib/api.js';
import { orderDate, notificationsChanged } from '../lib/orders.js';
import { bangla } from '../lib/registration.js';
import { useAuth } from '../context/AuthContext.jsx';
function NotificationsContent() {
  const { refresh } = useAuth();
  const [params, setParams] = useSearchParams(),
    navigate = useNavigate();
  const query = params.toString(),
    { data, loading, error, reload } = useApiResource(`notifications${query ? `?${query}` : ''}`);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (error?.status === 401) refresh();
  }, [error, refresh]);
  async function mark(id, open = false) {
    setBusy(true);
    setMessage('');
    try {
      await apiRequest(id ? `notifications/${id}/read` : 'notifications/read-all', {
        method: 'POST',
        body: '{}',
      });
      notificationsChanged();
      if (open) navigate(`/orders/${open}`);
      else reload();
    } catch (failure) {
      setMessage(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-container market-page">
      <div className="market-heading">
        <div>
          <span className="eyebrow">
            <Bell size={17} aria-hidden="true" /> অর্ডারের সর্বশেষ খবর
          </span>
          <h1>নোটিফিকেশন</h1>
        </div>
        <div className="order-response-actions">
          <button
            className="button button-primary"
            disabled={busy || !data?.unreadCount}
            onClick={() => mark()}
          >
            <CheckCheck size={16} aria-hidden="true" /> সব পড়া হয়েছে
          </button>
        </div>
      </div>
      {message && (
        <p className="form-alert" role="alert">
          {message}
        </p>
      )}
      {loading ? (
        <p className="order-loading" role="status">
          <LoaderCircle className="spin" size={20} aria-hidden="true" /> নোটিফিকেশন আনা হচ্ছে…
        </p>
      ) : error ? (
        <div className="form-alert" role="alert">
          <p>{error.message}</p>
          <button className="text-link" onClick={() => setParams({})}>
            প্রথম পাতায় ফিরুন
          </button>
        </div>
      ) : (
        <>
          <p className="notification-unread" role="status">
            পড়া বাকি {bangla(data.unreadCount)}টি
          </p>
          {data.notifications.length ? (
            <div className="notification-list">
              {data.notifications.map((notice) => (
                <article
                  className={`notification-card ${notice.readAt ? '' : 'is-unread'}`}
                  key={notice.id}
                >
                  <div>
                    <div className="order-list-top">
                      <h2>{notice.title}</h2>
                      {!notice.readAt && <span className="order-badge order-pending">পড়া বাকি</span>}
                    </div>
                    <p>{notice.message}</p>
                    <p className="field-hint">{orderDate(notice.createdAt)}</p>
                  </div>
                  <div className="notification-actions">
                    <button
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => mark(notice.id, notice.orderId)}
                    >
                      অর্ডার দেখুন
                    </button>
                    {!notice.readAt && (
                      <button className="text-link" disabled={busy} onClick={() => mark(notice.id)}>
                        পড়া হয়েছে
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="listing-empty">
              <Bell size={32} aria-hidden="true" />
              <h2>{data.page > 1 ? 'এই পাতায় কোনো নোটিফিকেশন নেই' : 'এখনো কোনো নোটিফিকেশন নেই'}</h2>
              {data.page > 1 ? (
                <button className="button button-primary" onClick={() => setParams({})}>
                  প্রথম পাতায় যান
                </button>
              ) : (
                <Link className="button button-primary" to="/orders">
                  আমার অর্ডার দেখুন
                </Link>
              )}
            </div>
          )}
          {data.pages > 1 && (
            <nav className="review-pagination" aria-label="নোটিফিকেশনের পাতা">
              <button
                className="button button-secondary"
                disabled={data.page <= 1}
                onClick={() => setParams({ page: String(data.page - 1) })}
              >
                আগের পাতা
              </button>
              <span>
                পাতা {bangla(data.page)} / {bangla(data.pages)}
              </span>
              <button
                className="button button-secondary"
                disabled={data.page >= data.pages}
                onClick={() => setParams({ page: String(data.page + 1) })}
              >
                পরের পাতা
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
export default function Notifications() {
  return (
    <OrderAccess approval={false}>
      <NotificationsContent />
    </OrderAccess>
  );
}
