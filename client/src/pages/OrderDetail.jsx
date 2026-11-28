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
import PortionProgress from '../components/PortionProgress.jsx';
import { progressLabels } from '../../../shared/order-progress.js';

function confirmationCopy({ portion, receipt, progress, decision }) {
  if (receipt) return {
    title: 'এই অংশের পণ্য বুঝে পেয়েছেন?',
    detail: `${portion.farmer.fullName}-এর কাছ থেকে এই অংশের পণ্য বুঝে পেলে নিশ্চিত করুন।`,
    confirm: 'প্রাপ্তি নিশ্চিত করুন',
  };
  if (progress === 'delivered') return {
    title: 'পণ্য পৌঁছে দিয়ে নগদ মূল্য পেয়েছেন?',
    detail: `ক্রেতার নির্ধারিত ঠিকানায় পণ্য পৌঁছে দিয়ে এই অংশের পুরো মূল্য ${formatMoney(portion.totalCost)} নগদ পেলে নিশ্চিত করুন।`,
    confirm: 'ডেলিভারি ও নগদ গ্রহণ নিশ্চিত করুন',
  };
  if (progress) return {
    title: 'সরবরাহের অগ্রগতি বদলাবেন?',
    detail: `পরবর্তী ধাপ — ${progressLabels[progress]}। ক্রেতা এই পরিবর্তনের খবর পাবেন।`,
    confirm: 'ধাপ নিশ্চিত করুন',
  };
  if (decision === 'rejected') return {
    title: 'নিজের অংশ প্রত্যাখ্যান করবেন?',
    detail: 'এই অংশের সব বিজ্ঞাপনের মজুতের সংরক্ষণ ছেড়ে দেওয়া হবে। উত্তর দেওয়ার পর সিদ্ধান্ত বদলানো যাবে না।',
    confirm: 'প্রত্যাখ্যান নিশ্চিত করুন',
  };
  return {
    title: 'নিজের অংশ গ্রহণ করবেন?',
    detail: 'এই পরিমাণ সরবরাহে আপনার সম্মতি সংরক্ষিত হবে। মজুত এই অর্ডারের জন্য সংরক্ষিত থাকবে। উত্তর দেওয়ার পর সিদ্ধান্ত বদলানো যাবে না।',
    confirm: 'গ্রহণ নিশ্চিত করুন',
  };
}

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
  const copy = confirmationCopy(action);
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
      <h2 id="order-response-title">{copy.title}</h2>
      <p>
        <strong>
          {cropName} · {formatAmount(action.portion.quantity)} {unit}
        </strong>
      </p>
      <p>{copy.detail}</p>
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      <div className="listing-dialog-actions">
        <button className="button button-secondary" disabled={busy} onClick={onClose}>
          ফিরে যান
        </button>
        {stale ? (
          <button className="button button-primary" disabled={busy} onClick={onReload}>
            সর্বশেষ অর্ডার দেখুন
          </button>
        ) : (
          <button
            className={`button ${rejecting ? 'button-reject' : 'button-primary'}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy && <LoaderCircle className="spin" size={16} aria-hidden="true" />}
            {copy.confirm}
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
  const { data, loading, error, reload, replaceData } = useApiResource(`orders/${id}`);
  const [action, setAction] = useState(null),
    [busy, setBusy] = useState(false),
    [responseError, setResponseError] = useState(''),
    [stale, setStale] = useState(false),
    [feedback, setFeedback] = useState(null);
  useEffect(() => {
    if ([401, 403].includes(error?.status)) refresh();
  }, [error, refresh]);
  function openAction(next) {
    setResponseError('');
    setStale(false);
    setAction(next);
  }
  async function respond() {
    if (busy) return;
    setBusy(true);
    setResponseError('');
    try {
      const endpoint = action.progress ? 'progress' : 'respond';
      const change = action.progress ? { progress: action.progress } : { decision: action.decision };
      const path = action.receipt
        ? `orders/${id}/portions/${action.portion.id}/receipt`
        : `orders/portions/${action.portion.id}/${endpoint}`;
      const result = await apiRequest(path, {
        method: 'POST',
        body: JSON.stringify({ ...(action.receipt ? {} : change), version: action.portion.version }),
      });
      setAction(null);
      replaceData(result);
      setFeedback({ portionId: action.portion.id, message: result.message });
      notificationsChanged();
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
      </div>
      {location.state?.orderMessage && !feedback && (
        <p className="success-note" role="status">
          {location.state.orderMessage}
        </p>
      )}
      <div className="order-overview">
        <span className={`order-badge order-${order.status}`}>{orderLabels[order.status]}</span>
        {order.completedAt && <p className="field-hint">সম্পন্ন হিসেবে নথিভুক্ত · {orderDate(order.completedAt)}</p>}
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
            {portion.progress && (
              <PortionProgress
                progress={portion.progress}
                busy={busy}
                historicalCompletion={portion.progress === 'completed' && !portion.deliveryConfirmedAt}
                onAdvance={farmer ? (progress) => openAction({ portion, progress }) : undefined}
              />
            )}
            {portion.status === 'accepted' && (
              <section className="portion-cod" aria-label="ডেলিভারি ও নগদ পরিশোধ">
                <h3>ক্যাশ অন ডেলিভারি · {formatMoney(portion.totalCost)}</h3>
                {portion.deliveryConfirmedAt ? (
                  <>
                    <p>কৃষক পণ্য পৌঁছে দিয়ে নগদ মূল্য পেয়েছেন · {orderDate(portion.deliveryConfirmedAt)}</p>
                    <p>{portion.receiptConfirmedAt
                      ? `ক্রেতা পণ্য বুঝে পেয়েছেন · ${orderDate(portion.receiptConfirmedAt)}`
                      : 'ক্রেতার প্রাপ্তি নিশ্চিতকরণের অপেক্ষায়'}</p>
                    {!farmer && !portion.receiptConfirmedAt && (
                      <button className="button button-secondary" disabled={busy}
                        onClick={() => openAction({ portion, receipt: true })}>
                        পণ্য বুঝে পেয়েছি
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p>{portion.progress === 'completed'
                      ? 'এই অংশের ডেলিভারি ও নগদ মূল্য পাওয়ার তথ্য নথিভুক্ত হয়নি।'
                      : 'কৃষক ডেলিভারির ঠিকানায় পণ্য পৌঁছে দিলে ক্রেতা এই মূল্য নগদ দেবেন।'}</p>
                    {farmer && portion.progress === 'completed' && (
                      <button className="button button-secondary" disabled={busy}
                        onClick={() => openAction({ portion, progress: 'delivered' })}>
                        ডেলিভারি ও নগদ মূল্য পাওয়া নথিভুক্ত করুন
                      </button>
                    )}
                  </>
                )}
              </section>
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
            {feedback?.portionId === portion.id && (
              <p className="success-note" role="status">{feedback.message}</p>
            )}
          </article>
        ))}
      </div>
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
          onReload={async () => {
            setBusy(true);
            try {
              replaceData(await apiRequest(`orders/${id}`));
              setAction(null);
              setFeedback(null);
            } catch (failure) {
              setResponseError(failure.message);
              if ([401, 403].includes(failure.status)) refresh();
            } finally {
              setBusy(false);
            }
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
