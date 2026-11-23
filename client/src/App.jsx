import { useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import About from './pages/About.jsx';
import NotFound from './pages/NotFound.jsx';
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import Account from './pages/Account.jsx';
import BuyerRegister from './pages/BuyerRegister.jsx';
import AdminBuyers from './pages/AdminBuyers.jsx';
import MyListings from './pages/MyListings.jsx';
import ListingForm from './pages/ListingForm.jsx';
import Marketplace from './pages/Marketplace.jsx';
import MarketListing from './pages/MarketListing.jsx';
import Requirements from './pages/Requirements.jsx';
import RequirementForm from './pages/RequirementForm.jsx';
import RequirementMatches from './pages/RequirementMatches.jsx';
import CollectiveMatches from './pages/CollectiveMatches.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import OrderReplacements from './pages/OrderReplacements.jsx';
import Notifications from './pages/Notifications.jsx';

export default function App() {
  const { pathname } = useLocation();
  const main = useRef(null);
  const previousPath = useRef(pathname);

  useEffect(() => {
    const titles = {
      '/about': 'আমাদের সম্পর্কে',
      '/marketplace': 'ফসলের বাজার',
      '/requirements': 'আমার ক্রয় চাহিদা',
      '/requirements/new': 'নতুন ক্রয় চাহিদা',
      '/orders': 'আমার অর্ডার',
      '/notifications': 'নোটিফিকেশন',
      '/register': 'কৃষক নিবন্ধন',
      '/register/buyer': 'ক্রেতা নিবন্ধন',
      '/admin/buyers': 'ক্রেতার আবেদন পর্যালোচনা',
      '/login': 'প্রবেশ',
      '/account': 'আমার অ্যাকাউন্ট',
      '/account/listings': 'আমার ফসলের বিজ্ঞাপন',
      '/account/listings/new': 'নতুন ফসলের বিজ্ঞাপন',
    };
    document.title = `${titles[pathname] || (/^\/orders\/[^/]+\/replacements$/.test(pathname) ? 'বিকল্প কৃষক বেছে নিন' : /^\/orders\/[^/]+$/.test(pathname) ? 'অর্ডারের বিস্তারিত' : /^\/account\/listings\/[^/]+\/edit$/.test(pathname) ? 'বিজ্ঞাপন সম্পাদনা' : /^\/requirements\/[^/]+\/edit$/.test(pathname) ? 'ক্রয় চাহিদা সম্পাদনা' : /^\/requirements\/[^/]+\/combinations$/.test(pathname) ? 'কৃষকদের সম্মিলিত সরবরাহ' : /^\/requirements\/[^/]+\/matches$/.test(pathname) ? 'চাহিদার সঙ্গে মিলে যাওয়া ফসল' : /^\/marketplace\/[^/]+$/.test(pathname) ? 'ফসলের বিস্তারিত' : 'পাতা পাওয়া যায়নি')} | ফিল্ডব্রিজ`;
    if (previousPath.current !== pathname) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      main.current?.focus({ preventScroll: true });
      previousPath.current = pathname;
    }
  }, [pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        মূল বিষয়ে যান
      </a>
      <Navbar />
      <main id="main-content" ref={main} tabIndex={-1}>
        <Routes>
          <Route path="/about" element={<About />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/marketplace/:id" element={<MarketListing />} />
          <Route path="/requirements" element={<Requirements />} />
          <Route path="/requirements/new" element={<RequirementForm />} />
          <Route path="/requirements/:id/edit" element={<RequirementForm />} />
          <Route path="/requirements/:id/matches" element={<RequirementMatches />} />
          <Route path="/requirements/:id/combinations" element={<CollectiveMatches />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/orders/:id/replacements" element={<OrderReplacements />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/buyer" element={<BuyerRegister />} />
          <Route path="/admin/buyers" element={<AdminBuyers />} />
          <Route path="/login" element={<Login />} />
          <Route path="/account" element={<Account />} />
          <Route path="/account/listings" element={<MyListings />} />
          <Route path="/account/listings/new" element={<ListingForm />} />
          <Route path="/account/listings/:id/edit" element={<ListingForm />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
