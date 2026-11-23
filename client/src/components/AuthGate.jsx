import { Navigate, Link, useLocation } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthGate({ role, approvedBuyer = false, children }) {
  const { user, loading, loadError, refresh } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <section className="page-container account-loading" role="status">
        <LoaderCircle className="spin" size={23} aria-hidden="true" /> অ্যাকাউন্ট যাচাই করা হচ্ছে…
      </section>
    );
  if (loadError)
    return (
      <section className="page-container account-loading">
        <p role="alert">{loadError}</p>
        <button className="button button-primary" onClick={refresh}>
          আবার চেষ্টা করুন
        </button>
      </section>
    );
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  if (role && user.role !== role)
    return (
      <section className="page-container account-loading">
        <h1 className="section-title">এখানে প্রবেশের অনুমতি নেই।</h1>
        <Link className="button button-primary" to="/account">
          নিজের অ্যাকাউন্টে ফিরুন
        </Link>
      </section>
    );
  if (approvedBuyer && user.buyerProfile?.status !== 'approved')
    return (
      <section className="page-container account-loading">
        <h1 className="section-title">ক্রয় চাহিদা পরিচালনার জন্য অনুমোদন প্রয়োজন।</h1>
        <p>আবেদনের অবস্থা নিজের অ্যাকাউন্টে দেখুন। এর মধ্যে ফসলের বাজার ঘুরে দেখতে পারবেন।</p>
        <div className="requirement-gate-actions">
          <Link className="button button-primary" to="/account">
            আবেদনের অবস্থা দেখুন
          </Link>
          <Link className="button button-secondary" to="/marketplace">
            ফসলের বাজার দেখুন
          </Link>
          <button type="button" className="text-button" onClick={refresh}>
            অনুমোদন হালনাগাদ করুন
          </button>
        </div>
      </section>
    );
  return children;
}
