import { Navigate, Link, useLocation } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthGate({ role, children }) {
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
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (role && user.role !== role)
    return (
      <section className="page-container account-loading">
        <h1 className="section-title">এখানে প্রবেশের অনুমতি নেই।</h1>
        <Link className="button button-primary" to="/account">
          নিজের অ্যাকাউন্টে ফিরুন
        </Link>
      </section>
    );
  return children;
}
