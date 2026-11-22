import { Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
import Brand from './Brand.jsx';

export default function Footer() {
  const year = new Intl.NumberFormat('bn-BD', { useGrouping: false }).format(new Date().getFullYear());
  return (
    <footer className="site-footer">
      <div className="page-container footer-top">
        <Brand footer />
        <p>কৃষকের পরিশ্রম ও ক্রেতার প্রয়োজনের মাঝে<br />সহজ, স্বচ্ছ সংযোগ গড়ার উদ্যোগ।</p>
        <Link to="/about" className="text-link">আমাদের সম্পর্কে জানুন</Link>
      </div>
      <div className="page-container footer-bottom">
        <span>© {year} ফিল্ডব্রিজ। সর্বস্বত্ব সংরক্ষিত।</span>
        <span className="inline-flex items-center gap-2"><Sprout size={15} aria-hidden="true" /> বাংলাদেশের কৃষির জন্য</span>
      </div>
    </footer>
  );
}
