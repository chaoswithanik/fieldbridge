import { useEffect, useRef, useState } from 'react';
import { Check, CircleX, RefreshCw, ClipboardList, FileText, LoaderCircle } from 'lucide-react';
import AuthGate from '../components/AuthGate.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest, mediaUrl } from '../lib/api.js';
import { bangla } from '../lib/registration.js';
import { documentLabels } from '../lib/buyer-documents.js';

const labels = { pending: 'অপেক্ষমাণ', approved: 'অনুমোদিত', rejected: 'প্রত্যাখ্যাত', all: 'সব আবেদন' };
const date = (value) =>
  new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' }).format(
    new Date(value),
  );

function AdminBuyerContent() {
  const { refresh } = useAuth();
  const [status, setStatus] = useState('pending'),
    [business, setBusiness] = useState(''),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState(null),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [reasonError, setReasonError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const details = useRef(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiRequest(`admin/buyers?status=${status}&page=${page}&business=${encodeURIComponent(business)}`)
      .then((result) => {
        if (active) {
          setData(result);
          setSelected(null);
        }
      })
      .catch((failure) => {
        if (active) {
          setError(failure.message);
          if (failure.status === 401 || failure.status === 403) refresh();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status, business, page, revision, refresh]);
  function choose(buyer) {
    setSelected(buyer);
    setReason('');
    setReasonError('');
    setError('');
    setMessage('');
    requestAnimationFrame(() => {
      details.current?.focus({ preventScroll: true });
      if (window.innerWidth < 768)
        details.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  async function review(decision) {
    if (decision === 'rejected' && (reason.trim().length < 5 || reason.trim().length > 500)) {
      setReasonError('প্রত্যাখ্যানের কারণ ৫ থেকে ৫০০ অক্ষরে লিখুন।');
      return;
    }
    setBusy(true);
    setError('');
    setReasonError('');
    setMessage('');
    try {
      const result = await apiRequest(`admin/buyers/${selected.userId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, reason, version: selected.version }),
      });
      setMessage(result.message);
      setSelected(null);
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(failure.message);
      setReasonError(failure.fields?.reason || '');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-container admin-page">
      <div className="buyer-page-heading">
        <div>
          <span className="eyebrow">
            <ClipboardList size={17} aria-hidden="true" /> অ্যাডমিন প্যানেল
          </span>
          <h1 className="section-title">ক্রেতার আবেদন পর্যালোচনা</h1>
          <p className="account-intro">
            আবেদনের তথ্য যাচাই করে অনুমোদন দিন অথবা প্রত্যাখ্যানের কারণ জানান।
          </p>
        </div>
        <button
          className="button button-secondary"
          disabled={loading || busy}
          onClick={() => setRevision((value) => value + 1)}
        >
          <RefreshCw size={16} aria-hidden="true" /> তালিকা হালনাগাদ
        </button>
      </div>
      <form className="admin-controls" onSubmit={e => {
        e.preventDefault();
        setBusiness(e.currentTarget.elements.business.value.trim());
        setPage(1);
        setSelected(null);
      }}>
        <input name="business" maxLength={100} aria-label="প্রতিষ্ঠানের নাম বা ব্যবসার ধরন" placeholder="প্রতিষ্ঠানের নাম বা ব্যবসার ধরন" />
        <button disabled={busy} className="button button-secondary">খুঁজুন</button>
        <button type="reset" className="text-link" onClick={() => {
          setBusiness(''); setPage(1); setSelected(null);
        }}>খোঁজ মুছুন</button>
      </form>
      <nav className="review-filters" aria-label="আবেদনের অবস্থা">
        {Object.entries(labels).map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={status === key}
            disabled={busy}
            onClick={() => {
              setStatus(key);
              setPage(1);
              setSelected(null);
            }}
          >
            {label} {data && key !== 'all' && <span>{bangla(data.counts[key])}</span>}
          </button>
        ))}
      </nav>
      {message && (
        <p className="success-note" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="admin-loading" role="status">
          <LoaderCircle className="spin" size={22} aria-hidden="true" /> আবেদনগুলো দেখা হচ্ছে…
        </div>
      ) : (
        data && (
          <>
            <div className={`review-grid ${!data.buyers.length ? 'review-grid-empty' : ''}`}>
              <div className="application-list" aria-label="ক্রেতার আবেদন তালিকা">
                {data.buyers.length ? (
                  data.buyers.map((buyer) => (
                    <button
                      type="button"
                      className={`application-item ${selected?.userId === buyer.userId ? 'selected' : ''}`}
                      key={buyer.userId}
                      disabled={busy}
                      onClick={() => choose(buyer)}
                    >
                      <span className="application-item-top">
                        <strong>{buyer.businessName}</strong>
                        <span className={`approval-tag tag-${buyer.status}`}>
                          {labels[buyer.status]}
                        </span>
                      </span>
                      <span>{buyer.fullName}</span>
                      <span className="application-item-meta">
                        {bangla(buyer.phone)} · {date(buyer.submittedAt)}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="review-empty">
                    <ClipboardList size={28} aria-hidden="true" />
                    <p>এই অবস্থায় কোনো আবেদন নেই।</p>
                  </div>
                )}
              </div>
              {data.buyers.length > 0 && (
                <article
                  className="account-card review-details"
                  ref={details}
                  tabIndex={-1}
                  aria-label="নির্বাচিত আবেদনের বিস্তারিত"
                >
                  {selected ? (
                    <>
                      <div className="application-item-top">
                        <h2>{selected.businessName}</h2>
                        <span className={`approval-tag tag-${selected.status}`}>
                          {labels[selected.status]}
                        </span>
                      </div>
                      <dl className="account-details buyer-details">
                        {[
                          ['পুরো নাম', selected.fullName],
                          ['মোবাইল নম্বর', bangla(selected.phone)],
                          ['ইমেইল', selected.email || 'যোগ করা হয়নি'],
                          ['ব্যবসার ধরন', selected.businessType],
                          ['পূর্ণ ঠিকানা', selected.address],
                          ['নিবন্ধনের তারিখ', date(selected.registeredAt)],
                          ['আবেদনের তারিখ', date(selected.submittedAt)],
                        ].map(([key, value]) => (
                          <div key={key}>
                            <dt>{key}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <section className="buyer-application-documents" aria-label="ব্যবসায়িক নথি">
                        <h3>
                          <FileText size={18} aria-hidden="true" /> ব্যবসায়িক নথি
                        </h3>
                        {selected.documents?.length ? (
                          <ul>
                            {selected.documents.map((document) => (
                              <li key={document.id}>
                                <a
                                  className="text-link"
                                  href={mediaUrl(document.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {documentLabels[document.documentType] || 'নথি'} দেখুন
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>কোনো নথি পাওয়া যায়নি।</p>
                        )}
                      </section>
                      {selected.rejectionReason && (
                        <p className="rejection-reason">
                          <strong>প্রত্যাখ্যানের কারণ:</strong> {selected.rejectionReason}
                        </p>
                      )}
                      {selected.status === 'pending' && (
                        <form
                          className="review-actions"
                          onSubmit={(event) => {
                            event.preventDefault();
                            review('rejected');
                          }}
                          noValidate
                        >
                          <fieldset disabled={busy}>
                            <FormField
                              name="reason"
                              label="প্রত্যাখ্যানের কারণ"
                              multiline
                              rows={3}
                              maxLength={500}
                              value={reason}
                              onChange={(event) => {
                                setReason(event.target.value);
                                setReasonError('');
                              }}
                              error={reasonError}
                              hint="প্রত্যাখ্যান করতে কারণ লেখা আবশ্যক। অনুমোদনের জন্য এটি প্রয়োজন নেই।"
                            />
                            <div className="review-buttons">
                              <button
                                type="button"
                                className="button button-primary"
                                disabled={busy}
                                onClick={() => review('approved')}
                              >
                                <Check size={17} aria-hidden="true" /> অনুমোদন দিন
                              </button>
                              <button className="button button-reject" disabled={busy}>
                                <CircleX size={17} aria-hidden="true" /> প্রত্যাখ্যান করুন
                              </button>
                            </div>
                          </fieldset>
                        </form>
                      )}
                    </>
                  ) : (
                    <div className="review-empty">
                      <ClipboardList size={32} aria-hidden="true" />
                      <p>তথ্য দেখতে তালিকা থেকে একটি আবেদন বেছে নিন।</p>
                    </div>
                  )}
                </article>
              )}
            </div>
            {data.pagination.totalPages > 1 && (
              <nav className="review-pagination" aria-label="আবেদনের পাতা">
                <button
                  className="button button-secondary"
                  disabled={page === 1 || busy}
                  onClick={() => setPage(page - 1)}
                >
                  আগের পাতা
                </button>
                <span>
                  পাতা {bangla(page)} / {bangla(data.pagination.totalPages)}
                </span>
                <button
                  className="button button-secondary"
                  disabled={page >= data.pagination.totalPages || busy}
                  onClick={() => setPage(page + 1)}
                >
                  পরের পাতা
                </button>
              </nav>
            )}
          </>
        )
      )}
    </section>
  );
}

export default function AdminBuyers() {
  return (
    <AuthGate role="admin">
      <AdminBuyerContent />
    </AuthGate>
  );
}
