import { Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Brand({ footer = false }) {
  return (
    <Link className={`brand ${footer ? 'brand-footer' : ''}`} to="/" aria-label="ফিল্ডব্রিজ প্রথম পাতা">
      <span className="brand-mark"><Sprout size={27} strokeWidth={1.6} aria-hidden="true" /></span>
      <span className="brand-name">ফিল্ডব্রিজ<span className="brand-tagline">মাঠ ও বাজারের সংযোগ</span></span>
    </Link>
  );
}
