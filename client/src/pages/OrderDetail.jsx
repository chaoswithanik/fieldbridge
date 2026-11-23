import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ClipboardCheck, LoaderCircle, RefreshCw, MapPin, Phone } from 'lucide-react';
import OrderAccess from '../components/OrderAccess.jsx';
import ReplacementSuggestions from '../components/ReplacementSuggestions.jsx';
import { useApiResource } from '../lib/resource.js';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../lib/api.js';
import { bangla } from '../lib/registration.js';
import { formatAmount, formatDate, unitLabels } from '../lib/listings.js';
import {
  responseLabels,
  orderLabels,
  orderDate,
  formatMoney,
  notificationsChanged,
} from '../lib/orders.js';
function ResponseDialog({
  action,
  cropName,
  unit,
  busy,
  error,
  stale,
  onClose,
  onConfirm,
  onReload,
}) {
  const dialog = useRef(null),
    rejecting = action.decision === 'rejected';
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="listing-dialog"
      aria-labelledby="order-response-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id="order-response-title">
        {rejecting ? 'নিজের অংশ প্রত্যাখ্যান করবেন?' : 'নিজের অংশ গ্রহণ করবেন?'}
      </h2>
      <p>
        <strong>
          {cropName} · {formatAmount(action.portion.quantity)} {unit}
        </strong>
      </p>
      <p>
        {rejecting
          ? 'এই অংশের সব বিজ্ঞাপনের মজুতের সংরক্ষণ ছেড়ে দেওয়া হবে। উত্তর দেওয়ার পর সিদ্ধান্ত বদলানো যাবে না।'
          : 'এই পরিমাণ সরবরাহে আপনার সম্মতি সংরক্ষিত হবে। মজুত এই অর্ডারের জন্য সংরক্ষিত থাকবে। উত্তর দেওয়ার পর সিদ্ধান্ত বদলানো যাবে না।'}
      </p>
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      <div className="listing-dialog-actions">
        <button className="button button-secondary" disabled={busy} onClick={onClose} autoFocus>
          ফিরে যান
        </button>
        {stale ? (
          <button className="button button-primary" onClick={onReload}>
            সর্বশেষ অর্ডার দেখুন
          </button>
        ) : (
          <button
            className={`button ${rejecting ? 'button-reject' : 'button-primary'}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy && <LoaderCircle className="spin" size={16} aria-hidden="true" />}
            {rejecting ? 'প্রত্যাখ্যান নিশ্চিত করুন' : 'গ্রহণ নিশ্চিত করুন'}
          </button>
        )}
      </div>
    </dialog>
  );
}
function OrderContent() {
  const { id } = useParams(),
    { user, refresh } = useAuth(),
    location = useLocation();
  const { data, loading, error, reload } = useApiResource(`orders/${id}`);
  const [action, setAction] = useState(null),
    [busy, setBusy] = useState(false),
    [responseError, setResponseError] = useState(''),
    [stale, setStale] = useState(false),
    [message, setMessage] = useState(location.state?.orderMessage || '');
  useEffect(() => {
    if ([401, 403].includes(error?.status)) refresh();
  }, [error, refresh]);
  async function respond() {
    if (busy) return;
    setBusy(true);
    setResponseError('');
    try {
      const result = await apiRequest(`orders/portions/${action.portion.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ decision: action.decision, version: action.portion.version }),
      });
      setAction(null);
      setMessage(result.message);
      notificationsChanged();
      reload();
    } catch (failure) {
      setResponseError(failure.message);
      if (failure.status === 409) setStale(true);
      if ([401, 403].includes(failure.status)) refresh();
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <section className="page-container account-loading" role="status">
        <LoaderCircle className="spin" size={22} aria-hidden="true" /> অর্ডারের তথ্য আনা হচ্ছে…
      </section>
    );
  if (error)
    return (
      <section className="page-container account-loading">
        <h1 className="section-title">
          {error.status === 404 ? 'অর্ডারটি খুঁজে পাওয়া যায়নি।' : 'অর্ডারের তথ্য দেখা যাচ্ছে না।'}
        </h1>
        <p className="form-alert" role="alert">
          {error.message}
        </p>
        <div className="requirement-gate-actions">
          <button className="button button-secondary" onClick={reload}>
            আবার চেষ্টা করুন
          </button>
          <Link className="button button-primary" to="/orders">
            আমার অর্ডারে ফিরুন
          </Link>
        </div>
      </section>
    );
  const order = data.order,
    unit = unitLabels[order.unit],
    farmer = user.role === 'farmer';
  return (
    <section className="page-container market-page">
      <Link className="text-link listing-back" to="/orders">
        আমার অর্ডার
      </Link>
      <div className="market-heading">
        <div>
          <span className="eyebrow">
            <ClipboardCheck size={17} aria-hidden="true" />{' '}
            {farmer ? 'আপনার অর্ডারের অংশ' : 'অর্ডারের বিস্তারিত'}
          </span>
          <h1>{order.cropName}</h1>
          <p>
            {orderDate(order.createdAt)} · অর্ডার #{order.id.slice(0, 8)}
          </p>
        </div>
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={() => {
            setMessage('');
            reload();
          }}
        >
          <RefreshCw size={16} aria-hidden="true" /> তথ্য হালনাগাদ করুন
        </button>
      </div>
      {message && (
        <p className="success-note" role="status">
          {message}
        </p>
      )}
      <div className="order-overview">
        <span className={`order-badge order-${order.status}`}>{orderLabels[order.status]}</span>
        <dl className="combination-figures">
          <div>
            <dt>{farmer ? 'আপনার সরবরাহ' : 'বর্তমান সরবরাহ'}</dt>
            <dd>
              {formatAmount(farmer ? order.totalQuantity : order.currentQuantity)}{' '}
              <span>{unit}</span>
            </dd>
          </div>
          <div>
            <dt>{farmer ? 'আপনার পণ্যমূল্য' : 'বর্তমান পণ্যমূল্য'}</dt>
            <dd>{formatMoney(farmer ? order.totalCost : order.currentCost)}</dd>
          </div>
          <div>
            <dt>গ্রহণ করেছেন</dt>
            <dd>
              {formatAmount(order.acceptedQuantity)} <span>{unit}</span>
            </dd>
          </div>
          <div>
            <dt>উত্তরের অপেক্ষায়</dt>
            <dd>
              {formatAmount(order.pendingQuantity)} <span>{unit}</span>
            </dd>
          </div>
        </dl>
        <p className="field-hint">
          প্রত্যাখ্যানের ইতিহাসে {formatAmount(order.rejectedQuantity)} {unit}
          {!farmer && (
            <>
              {' '}
              · চাহিদার মধ্যে এখনো গৃহীত হওয়া বাকি {formatAmount(order.unfulfilledQuantity)} {unit}
            </>
          )}
        </p>
        {!farmer && (
          <p className="field-hint order-original-total">
            অর্ডার শুরুর পরিমাণ {formatAmount(order.totalQuantity)} {unit} · শুরুর পণ্যমূল্য{' '}
            {formatMoney(order.totalCost)}। বর্তমান সরবরাহ ও মূল্যে পুরোনো প্রত্যাখ্যাত অংশ নেই।
          </p>
        )}
        {!farmer && Number(order.totalQuantity) !== Number(order.requestedQuantity) && (
          <p className="listing-info">
            মূল চাহিদা {formatAmount(order.requestedQuantity)} {unit}; অর্ডারটি{' '}
            {Number(order.totalQuantity) < Number(order.requestedQuantity) ? 'আংশিক' : 'অতিরিক্ত'}{' '}
            পরিমাণের।
          </p>
        )}
      </div>
      <section className="order-delivery" aria-label="ডেলিভারির তথ্য">
        <h2>
          <MapPin size={18} aria-hidden="true" /> ডেলিভারির ঠিকানা
        </h2>
        <p className="order-preserve-text">{order.deliveryAddress}</p>
        <p>
          {order.buyerName}
          {order.businessName && <> · {order.businessName}</>} ·{' '}
          <a href={`tel:+88${order.buyerPhone}`}>
            <Phone size={14} aria-hidden="true" /> {bangla(order.buyerPhone)}
          </a>
        </p>
        {order.instructions && (
          <p className="order-preserve-text">
            <strong>নির্দেশনা:</strong> {order.instructions}
          </p>
        )}
      </section>
      {!farmer && Number(order.replacementNeededQuantity) > 0 && (
        <ReplacementSuggestions key={order.version} order={order} />
      )}
      <div className="order-portions">
        {order.portions.map((portion) => (
          <article className="order-portion" key={portion.id}>
            <div className="order-list-top">
              <div>
                <h2>{farmer ? 'আপনার সরবরাহের বিবরণ' : portion.farmer.fullName}</h2>
                {portion.isReplacement && (
                  <p className="field-hint replacement-portion-label">বিকল্প কৃষকের অংশ</p>
                )}
                {!farmer && (
                  <a className="combination-phone" href={`tel:+88${portion.farmer.phone}`}>
                    <Phone size={15} aria-hidden="true" />
                    {bangla(portion.farmer.phone)}
                  </a>
                )}
              </div>
              <span className={`order-badge order-${portion.status}`}>
                {responseLabels[portion.status]}
              </span>
            </div>
            <p className="order-portion-total">
              <strong>
                {formatAmount(portion.quantity)} {unit}
              </strong>{' '}
              · {formatMoney(portion.totalCost)}
            </p>
            <div className="order-item-list">
              {portion.items.map((item) => (
                <section className="order-item" key={item.id}>
                  <h3>{item.cropName}</h3>
                  <p>
                    {formatAmount(item.quantity)} {unit} × {formatMoney(item.pricePerUnit)} · উপমোট{' '}
                    {formatMoney(item.subtotal)}
                  </p>
                  <p>
                    ফসল কাটা {formatDate(item.harvestDate)} · সরবরাহ শুরু{' '}
                    {formatDate(item.availableDate)}
                  </p>
                  <p className="order-preserve-text">
                    {item.farmAddress} · {item.upazila}, {item.district}
                  </p>
                </section>
              ))}
            </div>
            {portion.respondedAt && (
              <p className="field-hint">উত্তর দিয়েছেন {orderDate(portion.respondedAt)}</p>
            )}
            {farmer && portion.status === 'pending' && (
              <div className="order-response-actions">
                <button
                  className="button button-primary"
                  disabled={busy}
                  onClick={() => {
                    setResponseError('');
                    setStale(false);
                    setAction({ portion, decision: 'accepted' });
                  }}
                >
                  নিজের অংশ গ্রহণ করুন
                </button>
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => {
                    setResponseError('');
                    setStale(false);
                    setAction({ portion, decision: 'rejected' });
                  }}
                >
                  নিজের অংশ প্রত্যাখ্যান করুন
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="matching-rules">
        কৃষকের উত্তর দেওয়ার সময়সীমা নেই। অপেক্ষমাণ ও গৃহীত অংশের মজুত এই অর্ডারের জন্য সংরক্ষিত
        থাকে। প্রত্যাখ্যান করলে সংশ্লিষ্ট মজুতের সংরক্ষণ ছেড়ে দেওয়া হয়। পণ্যমূল্যে পরিবহন খরচ
        অন্তর্ভুক্ত নয়।
      </p>
      {action && (
        <ResponseDialog
          action={action}
          cropName={order.cropName}
          unit={unit}
          busy={busy}
          error={responseError}
          stale={stale}
          onClose={() => setAction(null)}
          onConfirm={respond}
          onReload={() => {
            setAction(null);
            reload();
          }}
        />
      )}
    </section>
  );
}
export default function OrderDetail() {
  return (
    <OrderAccess>
      <OrderContent />
    </OrderAccess>
  );
}
