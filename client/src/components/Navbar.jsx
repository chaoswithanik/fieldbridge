import { useEffect, useRef, useState } from 'react';
import { Menu, X, LogIn, LogOut, UserRound, Bell } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Brand from './Brand.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import ScrollProgressBanner from './ScrollProgressBanner.jsx';
import { useNotificationCount } from '../lib/notification-count.js';
import { bangla } from '../lib/registration.js';

const links = [
  { to: '/', label: 'প্রথম পাতা' },
  { to: '/marketplace', label: 'ফসলের বাজার' },
  { to: '/requirements', label: 'ক্রয় চাহিদা' },
  { to: '/about', label: 'আমাদের সম্পর্কে' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const unreadCount = useNotificationCount(user);
  const trader = ['buyer', 'farmer'].includes(user?.role);
  const navigation = trader
    ? [...links.slice(0, 3), { to: '/orders', label: 'আমার অর্ডার' }, ...links.slice(3)]
    : links;
  const [leaving, setLeaving] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const toggle = useRef(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const close = (event) => {
      if (event.key === 'Escape' && open) {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  async function leave() {
    setLeaving(true);
    setLogoutError('');
    try {
      await logout();
      navigate('/login');
      setOpen(false);
    } catch (error) {
      setLogoutError(error.message);
    } finally {
      setLeaving(false);
    }
  }
  const accountLinks = user ? (
    <>
      {trader && (
        <NavLink
          to="/notifications"
          className="notification-nav"
          aria-label={`নোটিফিকেশন, না-পড়া ${bangla(unreadCount)}টি`}
          title="নোটিফিকেশন"
        >
          <Bell size={20} aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="notification-count">
              {bangla(unreadCount > 99 ? '99+' : unreadCount)}
            </span>
          )}
        </NavLink>
      )}
      <NavLink to={user.role === 'admin' ? '/admin/buyers' : '/account'} className="login-link">
        <UserRound size={17} aria-hidden="true" />{' '}
        {user.role === 'admin' ? 'অ্যাডমিন প্যানেল' : 'আমার অ্যাকাউন্ট'}
      </NavLink>
      <button
        type="button"
        className="button button-secondary button-small"
        disabled={leaving}
        onClick={leave}
      >
        <LogOut size={17} aria-hidden="true" />
        {leaving ? 'অপেক্ষা করুন…' : 'বের হোন'}
      </button>
    </>
  ) : loading ? (
    <span className="nav-loading" role="status">
      অপেক্ষা করুন…
    </span>
  ) : (
    <>
      <NavLink to="/login" className="login-link">
        <LogIn size={17} aria-hidden="true" /> প্রবেশ করুন
      </NavLink>
      <NavLink to="/register" className="button button-primary button-small">
        নিবন্ধন করুন
      </NavLink>
    </>
  );

  return (
    <>
      <ScrollProgressBanner />
      <header className="site-header">
        <div className="page-container navbar">
          <Brand />
          <nav className="desktop-nav" aria-label="প্রধান নেভিগেশন">
            {navigation.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="desktop-actions">{accountLinks}</div>
          <button
            ref={toggle}
            type="button"
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? 'মেনু বন্ধ করুন' : 'মেনু খুলুন'}
            onClick={() => setOpen(!open)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        <nav
          id="mobile-navigation"
          hidden={!open}
          className="mobile-nav page-container"
          aria-label="মোবাইল নেভিগেশন"
        >
          {navigation.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
          <div className="mobile-actions">{accountLinks}</div>
        </nav>
        {logoutError && (
          <div className="page-container form-alert" role="alert">
            {logoutError}
          </div>
        )}
      </header>
    </>
  );
}
