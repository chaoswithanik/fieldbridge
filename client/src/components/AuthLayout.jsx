import { Link } from 'react-router-dom';
import { Sprout, ShieldCheck, Wheat, ChevronRight } from 'lucide-react';

export default function AuthLayout({ children, login = false, buyer = false }) {
  return (
    <div className={`page-container auth-page ${login ? 'auth-page-login' : ''}`}>
      <nav className="breadcrumb" aria-label="অবস্থান">
        <Link to="/about">ফিল্ডব্রিজ</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{login ? 'প্রবেশ' : buyer ? 'ক্রেতা নিবন্ধন' : 'কৃষক নিবন্ধন'}</span>
      </nav>
      <div className="auth-grid">
        <aside className="auth-story">
          <span className="eyebrow">
            <span className="eyebrow-line" /> কৃষির সঙ্গে, মানুষের পাশে
          </span>
          <h1>
            {login ? (
              <>
                আবার স্বাগতম,
                <br />
                <span>আপনার নিজের আঙিনায়।</span>
              </>
            ) : buyer ? (
              <>
                আপনার চাহিদা,
                <br />
                <span>বিশ্বস্ত সংযোগ।</span>
              </>
            ) : (
              <>
                আপনার ফলন,
                <br />
                <span>নতুন সম্ভাবনা।</span>
              </>
            )}
          </h1>
          <p>
            {login
              ? 'আপনার অ্যাকাউন্টে প্রবেশ করুন। মাঠ ও বাজারের সংযোগ গড়ার এই যাত্রায় আমরা আছি আপনার পাশে।'
              : buyer
                ? 'ফিল্ডব্রিজে ক্রেতা হিসেবে যুক্ত হোন। নিজের পরিচয় ও ব্যবসার তথ্য দিয়ে শুরু করুন কৃষকের সঙ্গে সংযোগ গড়ার যাত্রা।'
                : 'ফিল্ডব্রিজে কৃষক হিসেবে যুক্ত হোন। নিজের পরিচয় ও খামারের তথ্য দিয়ে শুরু করুন মাঠ থেকে বাজারে পৌঁছানোর যাত্রা।'}
          </p>
          <div className="auth-story-notes">
            <div>
              <span>
                <Sprout size={21} aria-hidden="true" />
              </span>
              <p>
                <strong>
                  {buyer
                    ? 'ব্যবসার নিজস্ব পরিচয়'
                    : login
                      ? 'আপনার নিজস্ব অ্যাকাউন্ট'
                      : 'কৃষকের নিজস্ব পরিচয়'}
                </strong>
                {buyer
                  ? 'আপনার নাম, ব্যবসা ও ঠিকানা এক জায়গায়।'
                  : login
                    ? 'কৃষক, ক্রেতা ও অ্যাডমিনের জন্য আলাদা প্রবেশাধিকার।'
                    : 'আপনার নাম, খামার ও অবস্থান এক জায়গায়।'}
              </p>
            </div>
            <div>
              <span>
                <ShieldCheck size={21} aria-hidden="true" />
              </span>
              <p>
                <strong>
                  {buyer ? 'অনুমোদন নিয়ে শুরু' : login ? 'নিরাপদে প্রবেশ করুন' : 'ফোন যাচাই করে শুরু'}
                </strong>
                {buyer
                  ? 'অ্যাডমিন আপনার আবেদন পর্যালোচনা করবেন।'
                  : login
                    ? 'ফোন বা ইমেইল এবং নিজের পাসওয়ার্ড ব্যবহার করুন।'
                    : 'আপনার মোবাইল নম্বর যাচাই করেই অ্যাকাউন্ট তৈরি হবে।'}
              </p>
            </div>
          </div>
          <div className="auth-story-seal">
            <Wheat size={29} strokeWidth={1.4} aria-hidden="true" />
            <span>
              পরিশ্রম আপনার।
              <br />
              <strong>সংযোগের সেতু ফিল্ডব্রিজ।</strong>
            </span>
          </div>
        </aside>
        <section
          className="auth-card"
          aria-label={login ? 'প্রবেশ ফর্ম' : buyer ? 'ক্রেতার নিবন্ধন ফর্ম' : 'কৃষকের নিবন্ধন ফর্ম'}
        >
          {children}
        </section>
      </div>
    </div>
  );
}
