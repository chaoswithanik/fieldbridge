import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBasket, LoaderCircle, RefreshCw } from 'lucide-react';
import { apiRequest } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatAmount, unitLabels } from '../lib/listings.js';
import { formatMoney, notificationsChanged } from '../lib/orders.js';
function OrderPreview({ requirementId, listingIds, onClose }) {
  const dialog = useRef(null),
    navigate = useNavigate(),
    { refresh } = useAuth();
  const [revision, setRevision] = useState(0),
    [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [quote, setQuote] = useState(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [stale, setStale] = useState(false);
  const ids = listingIds.join(':');
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setQuote(null);
    setStale(false);
    apiRequest('orders/quote', {
      method: 'POST',
      body: JSON.stringify({ requirementId, listingIds: ids.split(':') }),
    })
      .then((result) => {
        if (active) setQuote(result);
      })
      .catch((failure) => {
        if (active) {
          setError(failure.message);
          if ([401, 403].includes(failure.status)) refresh();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requirementId, ids, revision, refresh]);
  async function confirm() {
    if (!quote || busy || stale) return;
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest('orders', {
        method: 'POST',
        body: JSON.stringify({ quoteToken: quote.quoteToken, requestId }),
      });
      notificationsChanged();
      navigate(`/orders/${result.order.id}`, { state: { orderMessage: result.message } });
    } catch (failure) {
      setError(failure.message);
      if (failure.status === 409) setStale(true);
      if ([401, 403].includes(failure.status)) refresh();
    } finally {
      setBusy(false);
    }
  }
  const preview = quote?.preview,
    unit = preview && unitLabels[preview.unit];
  return (
    <dialog
      ref={dialog}
      className="listing-dialog order-preview"
      aria-labelledby="order-preview-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id="order-preview-title">অর্ডার নিশ্চিত করার আগে</h2>
      <p>সর্বশেষ দাম ও পরিমাণ দেখে নিশ্চিত করুন। এখনো কোনো মজুত সংরক্ষণ হয়নি।</p>
      {loading && (
        <p role="status" className="order-loading">
          <LoaderCircle className="spin" size={20} aria-hidden="true" /> সর্বশেষ তথ্য আনা হচ্ছে…
        </p>
      )}
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <div className="order-preview-body">
          <div className="order-preview-total">
            <div>
              <span>{preview.cropName}</span>
              <strong>
                {formatAmount(preview.totalQuantity)} {unit}
              </strong>
            </div>
            <div>
              <span>মোট পণ্যমূল্য</span>
              <strong>{formatMoney(preview.totalCost)}</strong>
            </div>
          </div>
          {Number(preview.totalQuantity) !== Number(preview.requestedQuantity) && (
            <p className="listing-info">
              আপনার চাহিদা {formatAmount(preview.requestedQuantity)} {unit}। এই অর্ডারটি{' '}
              {Number(preview.totalQuantity) < Number(preview.requestedQuantity)
                ? 'আংশিক পরিমাণের'
                : 'চাহিদার চেয়ে অতিরিক্ত পরিমাণের'}
              ।
            </p>
          )}
          <div className="order-preview-items">
            {preview.items.map((item) => (
              <div key={item.listingId}>
                <strong>{item.snapshot.farmerName}</strong>
                <p>
                  {formatAmount(item.quantity)} {unit} × {formatMoney(item.snapshot.pricePerUnit)} ·
                  উপমোট {formatMoney(item.subtotal)}
                </p>
              </div>
            ))}
          </div>
          <h3>ডেলিভারির ঠিকানা</h3>
          <p className="order-preserve-text">{preview.deliveryAddress}</p>
          {preview.instructions && (
            <>
              <h3>কৃষকের জন্য নির্দেশনা</h3>
              <p className="order-preserve-text">{preview.instructions}</p>
            </>
          )}
          <p className="field-hint">
            নিশ্চিত করলে মজুত এই অর্ডারের জন্য সংরক্ষিত থাকবে। কৃষকের উত্তর দেওয়ার সময়সীমা নেই;
            প্রত্যাখ্যান করলে সংশ্লিষ্ট মজুতের সংরক্ষণ ছেড়ে দেওয়া হবে। পণ্যমূল্যে পরিবহন খরচ
            অন্তর্ভুক্ত নয়।
          </p>
        </div>
      )}
      <div className="listing-dialog-actions">
        <button className="button button-secondary" onClick={onClose} disabled={busy} autoFocus>
          ফিরে যান
        </button>
        {!loading && (!quote || stale) ? (
          <button
            className="button button-primary"
            onClick={() => {
              setRequestId(crypto.randomUUID());
              setRevision((value) => value + 1);
            }}
          >
            <RefreshCw size={16} aria-hidden="true" /> সর্বশেষ তথ্য আনুন
          </button>
        ) : (
          <button
            className="button button-primary"
            onClick={confirm}
            disabled={loading || busy || !quote}
          >
            {busy && <LoaderCircle className="spin" size={16} aria-hidden="true" />}অর্ডার নিশ্চিত
            করুন
          </button>
        )}
      </div>
    </dialog>
  );
}
export default function OrderButton({ requirement, listingIds, collective = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="button button-primary matching-order-button"
        disabled={requirement.status !== 'active'}
        onClick={() => setOpen(true)}
      >
        <ShoppingBasket size={17} aria-hidden="true" />
        {collective ? 'এই সমন্বয় থেকে অর্ডার দিন' : 'এই ফসল থেকে অর্ডার দিন'}
      </button>
      {open && (
        <OrderPreview
          requirementId={requirement.id}
          listingIds={listingIds}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
