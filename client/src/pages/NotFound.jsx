import { Link, useLocation } from 'react-router-dom';
import { MapPinOff, Sprout } from 'lucide-react';

const plannedPages = {
  '/': 'প্রথম পাতা',
  '/marketplace': 'ফসলের বাজার',
  '/requirements': 'ক্রয় চাহিদা',
};

export default function NotFound() {
  const { pathname } = useLocation();
  const page = plannedPages[pathname];
  return (
    <section className="not-found page-container" aria-labelledby="not-found-title">
      <div className="not-found-art" aria-hidden="true">
        <span className="error-code">৪০৪</span>
        <span className="lost-sign">
          <MapPinOff size={45} strokeWidth={1.4} />
        </span>
        <Sprout className="lost-sprout" size={37} strokeWidth={1.3} />
      </div>
      <span className="eyebrow">{page ? `${page} · শিগগিরই আসছে` : 'পথটা এখানে শেষ হয়েছে'}</span>
      <h1 id="not-found-title">
        {page ? 'এই পাতায় এখনো চারা লাগানো হয়নি।' : 'পাতাটি খুঁজে পাওয়া গেল না।'}
      </h1>
      <p>
        {page
          ? `“${page}” পাতাটি আমরা পরবর্তী ধাপে তৈরি করব। আপাতত ফিল্ডব্রিজের গল্প, উদ্দেশ্য ও পরিকল্পনা জানতে আমাদের সম্পর্কে পাতাটি ঘুরে দেখুন।`
          : 'ঠিকানাটি ভুল হতে পারে, অথবা পাতাটি এখনো তৈরি হয়নি। আমাদের সম্পর্কে পাতা থেকে ফিল্ডব্রিজের সঙ্গে পরিচিত হতে পারেন।'}
      </p>
      <div className="not-found-actions">
        <Link to="/about" className="button button-primary">
          আমাদের সম্পর্কে জানুন
        </Link>
        {pathname !== '/' && (
          <Link to="/" className="button button-secondary">
            প্রথম পাতায় ফিরুন
          </Link>
        )}
      </div>
      <span className="not-found-caption">মাঠ ও বাজারের সংযোগ গড়ে উঠছে, ধাপে ধাপে।</span>
    </section>
  );
}
