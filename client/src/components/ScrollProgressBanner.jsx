import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Sprout } from 'lucide-react';

function BannerContent() {
  return (
    <div className="page-container flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-2">
        <Sprout size={12} aria-hidden="true" /> বাংলাদেশের কৃষক ও ক্রেতার জন্য
      </span>
      <span className="announcement-note">একসঙ্গে ফলুক সম্ভাবনা</span>
    </div>
  );
}

export default function ScrollProgressBanner() {
  const banner = useRef(null);
  const { pathname, search } = useLocation();

  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      const root = document.documentElement;
      const distance = root.scrollHeight - root.clientHeight;
      const progress = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
      banner.current?.style.setProperty('--scroll-progress', `${(progress * 100).toFixed(3)}%`);
    };
    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(update);
    };

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('pageshow', schedule);
    // Images, expanded forms and loaded data can change the page's scroll length.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    observer.observe(document.documentElement);
    schedule();

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('pageshow', schedule);
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [pathname, search]);

  return (
    <div className="announcement" ref={banner}>
      <BannerContent />
      <div className="announcement-fill" aria-hidden="true">
        <BannerContent />
      </div>
    </div>
  );
}
