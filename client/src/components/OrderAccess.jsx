import AuthGate from './AuthGate.jsx';
import { useAuth } from '../context/AuthContext.jsx';
export default function OrderAccess({ children, approval = true }) {
  const { user } = useAuth();
  return (
    <AuthGate
      role={user?.role === 'farmer' ? 'farmer' : 'buyer'}
      approvedBuyer={approval && user?.role !== 'farmer'}
      approvalTitle="অর্ডার পরিচালনার জন্য অনুমোদন প্রয়োজন।"
    >
      {children}
    </AuthGate>
  );
}
