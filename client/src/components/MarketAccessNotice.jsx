import { Link, useLocation } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function MarketAccessNotice({ access }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!access || access.canViewPrices) return null;
  const buyer = user?.role === 'buyer';
  return (
    <aside className="market-access-note">
      <LockKeyhole size={19} aria-hidden="true" />
      <div>
        <strong>
          {buyer
            ? 'দাম ও কৃষকের তথ্য দেখতে ক্রেতার অনুমোদন নেই।'
            : 'কৃষকের নাম, ফোন ও খামারের পূর্ণ ঠিকানা অনুমোদিত ক্রেতাদের জন্য।'}
        </strong>
      </div>
      {!user ? (
        <Link
          className="text-link"
          to="/login"
          state={{ from: location.pathname + location.search }}
        >
          প্রবেশ করুন
        </Link>
      ) : (
        <Link className="text-link" to={buyer ? '/account' : '/account/listings'}>
          {buyer ? 'আবেদনের অবস্থা দেখুন' : 'নিজের বিজ্ঞাপন দেখুন'}
        </Link>
      )}
    </aside>
  );
}
