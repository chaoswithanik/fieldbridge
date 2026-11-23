import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  Plus,
  RefreshCw,
  MapPin,
  Pencil,
  Pause,
  Play,
  ClipboardCheck,
  Trash2,
  LockKeyhole,
  LoaderCircle,
  SearchCheck,
  UsersRound,
} from 'lucide-react';
import AuthGate from '../components/AuthGate.jsx';
import RequirementConfirmation from '../components/RequirementConfirmation.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApiResource } from '../lib/resource.js';
import { apiRequest } from '../lib/api.js';
import { bangla } from '../lib/registration.js';
import { formatAmount, unitLabels } from '../lib/listings.js';
import { requirementLabels } from '../lib/requirements.js';

function RequirementsContent() {
  const { refresh } = useAuth(),
    location = useLocation();
  const [params, setParams] = useSearchParams();
  const status = Object.hasOwn(requirementLabels, params.get('status'))
    ? params.get('status')
    : 'all';
  const requestedPage = Number(params.get('page') || 1),
    page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000
        ? requestedPage
        : 1;
  const {
    data,
    loading,
    error: loadError,
    reload,
  } = useApiResource(`buyer/requirements?status=${status}&page=${page}`);
  const [message, setMessage] = useState(location.state?.requirementMessage || ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [action, setAction] = useState(null),
    [dialogError, setDialogError] = useState('');
  const alert = useRef(null);
  useEffect(() => {
    if ([401, 403].includes(loadError?.status)) refresh();
  }, [loadError, refresh]);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  function changePage(number, state = status) {
    setParams({
      ...(state !== 'all' ? { status: state } : {}),
      ...(number > 1 ? { page: String(number) } : {}),
    });
    setMessage('');
    setError('');
  }
  async function mutate(requirement, type, nextStatus) {
    setBusy(true);
    setError('');
    setDialogError('');
    setMessage('');
    try {
      const result = await apiRequest(
        `buyer/requirements/${requirement.id}${type === 'delete' ? '' : '/status'}`,
        {
          method: type === 'delete' ? 'DELETE' : 'PATCH',
          body: JSON.stringify({
            version: requirement.version,
            ...(type === 'delete' ? {} : { status: nextStatus }),
          }),
        },
      );
      setAction(null);
      if (
        (type === 'delete' || (status !== 'all' && nextStatus !== status)) &&
        data.requirements.length === 1 &&
        page > 1
      )
        changePage(page - 1);
      else reload();
      setMessage(result.message);
    } catch (failure) {
      if (action) setDialogError(failure.message);
      else setError(failure.message);
      if ([401, 403].includes(failure.status)) refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-container listings-page">
      <Link className="text-link listing-back" to="/account">
        আমার অ্যাকাউন্ট
      </Link>
      <div className="listing-page-heading">
        <div>
          <span className="eyebrow">
            <ClipboardList size={17} aria-hidden="true" /> ক্রেতার আঙিনা
          </span>
          <h1>আমার ক্রয় চাহিদা</h1>
          <p>কোন ফসল কতটুকু প্রয়োজন, তার তথ্য ও অবস্থা পরিচালনা করুন।</p>
        </div>
        <Link className="button button-primary" to="/requirements/new">
          <Plus size={17} aria-hidden="true" /> নতুন চাহিদা
        </Link>
      </div>
      <div className="listing-toolbar">
        <nav className="listing-filters" aria-label="চাহিদার অবস্থা">
          {Object.entries({ all: 'সব চাহিদা', ...requirementLabels }).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={status === key}
              disabled={busy || loading}
              onClick={() => changePage(1, key)}
            >
              {label}{' '}
              {data && (
                <span>
                  {bangla(
                    key === 'all'
                      ? Object.values(data.counts).reduce((sum, value) => sum + value, 0)
                      : data.counts[key],
                  )}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="listing-refresh"
          disabled={loading || busy}
          onClick={reload}
        >
          <RefreshCw size={16} aria-hidden="true" /> হালনাগাদ
        </button>
      </div>
      {message && (
        <p className="success-note" role="status">
          {message}
        </p>
      )}
      {(error || loadError) && (
        <div className="form-alert listing-error" role="alert" ref={alert} tabIndex={-1}>
          <p>{error || loadError.message}</p>
          <button
            type="button"
            className="text-button"
            disabled={loading || busy}
            onClick={() => {
              setError('');
              reload();
            }}
          >
            সর্বশেষ তথ্য আনুন
          </button>
        </div>
      )}
      {loading ? (
        <div className="admin-loading" role="status">
          <LoaderCircle className="spin" size={22} aria-hidden="true" /> চাহিদাগুলো দেখা হচ্ছে…
        </div>
      ) : (
        data &&
        (data.requirements.length ? (
          <>
            <div className="requirement-grid">
              {data.requirements.map((requirement) => (
                <article
                  className="requirement-card"
                  key={requirement.id}
                  aria-label={`${requirement.cropName} চাহিদা`}
                >
                  <div className="requirement-card-heading">
                    <h2>{requirement.cropName}</h2>
                    <span className={`listing-status requirement-status-${requirement.status}`}>
                      {requirementLabels[requirement.status]}
                    </span>
                  </div>
                  <dl className="requirement-quantity">
                    <dt>প্রয়োজনীয় পরিমাণ</dt>
                    <dd>
                      {formatAmount(requirement.quantity)}{' '}
                      <span>{unitLabels[requirement.unit]}</span>
                    </dd>
                  </dl>
                  <div className="requirement-address">
                    <MapPin size={17} aria-hidden="true" />
                    <div>
                      <h3>ডেলিভারির ঠিকানা</h3>
                      <p>{requirement.deliveryAddress}</p>
                    </div>
                  </div>
                  {requirement.instructions && (
                    <details className="requirement-notes">
                      <summary>অতিরিক্ত নির্দেশনা দেখুন</summary>
                      <p>{requirement.instructions}</p>
                    </details>
                  )}
                  <p
                    className={`requirement-edit-count ${requirement.editsRemaining === 0 ? 'is-exhausted' : ''}`}
                  >
                    {requirement.editsRemaining === 0 && (
                      <LockKeyhole size={15} aria-hidden="true" />
                    )}{' '}
                    সম্পাদনা {bangla(requirement.editCount)}/২ · বাকি{' '}
                    {bangla(requirement.editsRemaining)} বার
                  </p>
                  <div className="requirement-match-actions">
                    <Link
                      className="button button-primary requirement-match-link"
                      to={`/requirements/${requirement.id}/matches`}
                    >
                      <SearchCheck size={17} aria-hidden="true" /> মিলে যাওয়া ফসল দেখুন
                    </Link>
                    <Link
                      className="button button-secondary requirement-match-link"
                      to={`/requirements/${requirement.id}/combinations`}
                    >
                      <UsersRound size={17} aria-hidden="true" /> সম্মিলিত সরবরাহ দেখুন
                    </Link>
                  </div>
                  <div className="requirement-actions">
                    {requirement.editsRemaining > 0 ? (
                      <Link
                        className="button button-secondary"
                        to={`/requirements/${requirement.id}/edit`}
                      >
                        <Pencil size={15} aria-hidden="true" /> সম্পাদনা
                      </Link>
                    ) : (
                      <button type="button" className="button button-secondary" disabled>
                        <LockKeyhole size={15} aria-hidden="true" /> সম্পাদনা শেষ
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() =>
                        mutate(
                          requirement,
                          'status',
                          requirement.status === 'active' ? 'inactive' : 'active',
                        )
                      }
                    >
                      {requirement.status === 'active' ? (
                        <Pause size={15} aria-hidden="true" />
                      ) : (
                        <Play size={15} aria-hidden="true" />
                      )}
                      {requirement.status === 'active' ? 'বন্ধ রাখুন' : 'চালু করুন'}
                    </button>
                    {requirement.status !== 'fulfilled' && (
                      <button
                        type="button"
                        className="crop-action-text"
                        disabled={busy}
                        onClick={() => {
                          setDialogError('');
                          setAction({ requirement, type: 'fulfilled' });
                        }}
                      >
                        <ClipboardCheck size={15} aria-hidden="true" /> পূরণ হয়েছে
                      </button>
                    )}
                    <button
                      type="button"
                      className="crop-action-text crop-delete"
                      disabled={busy}
                      onClick={() => {
                        setDialogError('');
                        setAction({ requirement, type: 'delete' });
                      }}
                    >
                      <Trash2 size={15} aria-hidden="true" /> মুছুন
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {data.pages > 1 && (
              <nav className="review-pagination" aria-label="চাহিদার পাতা">
                <button
                  className="button button-secondary"
                  disabled={page <= 1 || busy}
                  onClick={() => changePage(page - 1)}
                >
                  আগের পাতা
                </button>
                <span>
                  পাতা {bangla(page)} / {bangla(data.pages)}
                </span>
                <button
                  className="button button-secondary"
                  disabled={page >= data.pages || busy}
                  onClick={() => changePage(page + 1)}
                >
                  পরের পাতা
                </button>
              </nav>
            )}
          </>
        ) : (
          <div className="listing-empty">
            <span className="listing-empty-icon">
              <ClipboardList size={32} aria-hidden="true" />
            </span>
            <h2>
              {status === 'all'
                ? 'আপনার প্রথম ক্রয় চাহিদা তৈরি করুন'
                : 'এই অবস্থায় কোনো চাহিদা নেই'}
            </h2>
            <p>ফসলের নাম, পরিমাণ ও ডেলিভারির ঠিকানা দিয়ে শুরু করুন।</p>
            {page > 1 ? (
              <button className="button button-secondary" onClick={() => changePage(1)}>
                প্রথম পাতায় ফিরুন
              </button>
            ) : (
              <Link className="button button-primary" to="/requirements/new">
                <Plus size={17} aria-hidden="true" /> নতুন চাহিদা
              </Link>
            )}
          </div>
        ))
      )}
      {action && (
        <RequirementConfirmation
          action={action}
          busy={busy}
          error={dialogError}
          onCancel={() => setAction(null)}
          onConfirm={() =>
            mutate(action.requirement, action.type === 'delete' ? 'delete' : 'status', 'fulfilled')
          }
        />
      )}
    </section>
  );
}

export default function Requirements() {
  return (
    <AuthGate role="buyer" approvedBuyer>
      <RequirementsContent />
    </AuthGate>
  );
}
