import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Sprout,
  MapPin,
  UsersRound,
  Wheat,
  ShoppingBasket,
  ClipboardList,
  Handshake,
  Truck,
  Check,
} from 'lucide-react';
import FieldIllustration from '../components/FieldIllustration.jsx';

const principles = [
  {
    Icon: Sprout,
    title: 'কৃষককে কেন্দ্রে রেখে',
    description: 'ফসল ও পরিশ্রমের যথাযথ মূল্য পাওয়ার সুযোগ',
  },
  {
    Icon: MapPin,
    title: 'সারা বাংলাদেশের জন্য',
    description: 'জেলা ও উপজেলার সীমানা পেরিয়ে সংযোগ',
  },
  {
    Icon: UsersRound,
    title: 'একসঙ্গে বড় সম্ভাবনা',
    description: 'একাধিক কৃষকের ফলনে বড় চাহিদা পূরণের পথ',
  },
];

const steps = [
  {
    Icon: ClipboardList,
    title: 'ফসল ও চাহিদার তথ্য',
    description:
      'কৃষক জানাবেন কী ফসল, কতটুকু ও কবে পাওয়া যাবে। ক্রেতা জানাবেন তাঁর প্রয়োজন ও সরবরাহের ঠিকানা।',
  },
  {
    Icon: Handshake,
    title: 'উপযুক্ত সরবরাহের খোঁজ',
    description:
      'একজন কৃষক বা একাধিক কৃষকের সম্মিলিত সরবরাহ থেকে ক্রেতা বেছে নেবেন উপযুক্ত প্রস্তাব।',
  },
  {
    Icon: Truck,
    title: 'সমন্বিত অর্ডার ও সরবরাহ',
    description: 'কৃষক অর্ডার গ্রহণ করে ফসল পৌঁছে দেবেন। ক্রেতা ফসল হাতে পেয়ে মূল্য পরিশোধ করবেন।',
  },
];

export default function About() {
  return (
    <>
      <section className="about-intro">
        <div className="page-container">
          <nav aria-label="অবস্থান" className="breadcrumb">
            <Link to="/">প্রথম পাতা</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">আমাদের সম্পর্কে</span>
          </nav>
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="eyebrow-line" /> আমাদের গল্প, আমাদের উদ্দেশ্য
              </span>
              <h1>
                মাঠ থেকে বাজারে,
                <br />
                <span>আস্থার সেতুবন্ধন।</span>
              </h1>
              <p className="hero-description">
                কৃষকের ফলন আর ক্রেতার প্রয়োজন—এই দুইয়ের মাঝে সহজ সংযোগ গড়তেই ফিল্ডব্রিজ। বাংলাদেশের
                কৃষিপণ্য কেনাবেচায় আরও স্বচ্ছতা ও সমন্বয় আনাই আমাদের লক্ষ্য।
              </p>
              <a href="#our-purpose" className="button button-primary">
                আমাদের ভাবনা জানুন
              </a>
              <span className="hero-footnote">
                <Sprout size={17} aria-hidden="true" /> কৃষির সঙ্গে, মানুষের পাশে
              </span>
            </div>
            <FieldIllustration />
          </div>
          <div className="principles-grid">
            {principles.map(({ Icon, title, description }) => (
              <div className="principle" key={title}>
                <span className="principle-icon">
                  <Icon size={23} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <div>
                  <h2>{title}</h2>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="our-purpose" className="purpose-section page-container section-space">
        <div className="purpose-heading">
          <span className="eyebrow">কেন ফিল্ডব্রিজ</span>
          <h2 className="section-title">
            ছোট ছোট ফলন মিলেই
            <br />
            বড় সুযোগের শুরু।
          </h2>
        </div>
        <div className="purpose-copy">
          <p>
            একজন কৃষকের কাছে হয়তো বড় অর্ডার পূরণের মতো পর্যাপ্ত ফসল নেই। অন্যদিকে, একজন ক্রেতার
            প্রয়োজন মেটাতে একাধিক কৃষকের সঙ্গে যোগাযোগ ও সরবরাহের সময় মেলানো কঠিন হতে পারে।
          </p>
          <p>
            ফিল্ডব্রিজ এই দূরত্ব কমানোর উদ্যোগ। ফসলের পরিমাণ, দাম, সংগ্রহের সময় ও অবস্থানের তথ্য এক
            জায়গায় এনে কৃষক এবং ক্রেতাকে সিদ্ধান্ত নিতে সাহায্য করাই আমাদের পরিকল্পনা।
          </p>
        </div>
      </section>

      <section className="people-section page-container" aria-labelledby="people-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">যাঁদের জন্য এই উদ্যোগ</span>
            <h2 id="people-title" className="section-title">
              দুই প্রান্তের মানুষ, একই সংযোগ।
            </h2>
          </div>
          <span className="section-note">পরিকল্পিত সুবিধা</span>
        </div>
        <div className="people-grid">
          <article className="person-card">
            <div className="person-card-header">
              <span className="person-icon">
                <Wheat size={28} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="card-label">উৎপাদনের প্রান্তে</span>
            </div>
            <h3>কৃষকের জন্য</h3>
            <p>
              নিজের ফসলের খবর পৌঁছে দেওয়ার এবং উপযুক্ত ক্রেতার সঙ্গে যুক্ত হওয়ার একটি সহজ জায়গা।
            </p>
            <ul>
              <li>
                <Check size={17} aria-hidden="true" /> ফসলের পরিমাণ, দাম ও প্রাপ্যতার তথ্য প্রকাশ
              </li>
              <li>
                <Check size={17} aria-hidden="true" /> একসঙ্গে বড় চাহিদা পূরণে অংশ নেওয়ার সুযোগ
              </li>
              <li>
                <Check size={17} aria-hidden="true" /> নিজের অর্ডার ও সরবরাহের অগ্রগতি জানানো
              </li>
            </ul>
          </article>
          <article className="person-card buyer-card">
            <div className="person-card-header">
              <span className="person-icon">
                <ShoppingBasket size={28} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="card-label">প্রয়োজনের প্রান্তে</span>
            </div>
            <h3>ক্রেতার জন্য</h3>
            <p>
              প্রয়োজন অনুযায়ী ফসল খোঁজা এবং এক বা একাধিক কৃষকের সরবরাহ সমন্বয়ের একটি নির্ভরযোগ্য পথ।
            </p>
            <ul>
              <li>
                <Check size={17} aria-hidden="true" /> ফসল, অবস্থান ও প্রাপ্যতা অনুযায়ী খোঁজ
              </li>
              <li>
                <Check size={17} aria-hidden="true" /> নিজের ক্রয় চাহিদার সঙ্গে মানানসই সরবরাহ দেখা
              </li>
              <li>
                <Check size={17} aria-hidden="true" /> সরবরাহের অগ্রগতি দেখা ও হাতে পেয়ে মূল্য
                পরিশোধ
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section
        className="process-section page-container section-space"
        aria-labelledby="process-title"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">সংযোগ যেভাবে গড়ে উঠবে</span>
            <h2 id="process-title" className="section-title">
              তথ্য থেকে সমন্বয়, সমন্বয় থেকে সরবরাহ।
            </h2>
          </div>
        </div>
        <ol className="process-grid">
          {steps.map(({ Icon, title, description }) => (
            <li key={title}>
              <span className="process-icon">
                <Icon size={25} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
        <div className="development-note">
          <Sprout size={21} aria-hidden="true" />
          <p>
            <strong>শুরুটা হোক সহজ ও স্বচ্ছ।</strong> ফিল্ডব্রিজ ধাপে ধাপে তৈরি হচ্ছে। কৃষক ও
            ক্রেতার নিবন্ধন, প্রবেশ, ক্রেতার আবেদন পর্যালোচনা, ফসলের বিজ্ঞাপন, বাজারে ফসল খোঁজা এবং
            ক্রেতার ক্রয় চাহিদা পরিচালনা এবং একক ও একাধিক কৃষকের সরবরাহ মেলানো এখন চালু আছে। মিল
            থেকে অর্ডার দেওয়া, মজুত সংরক্ষণ, কৃষকের গ্রহণ বা প্রত্যাখ্যান এবং অ্যাপের নোটিফিকেশনও
            চালু আছে। প্রত্যাখ্যাত সরবরাহের জন্য ক্রেতা পরামর্শ থেকে বা নিজে বিকল্প কৃষক বেছে নিয়ে
            একই অর্ডারে যোগ করতে পারেন। সরবরাহের অগ্রগতি ও প্রাপ্তি নিশ্চিতকরণ পরবর্তী ধাপে যুক্ত
            হবে।
          </p>
        </div>
      </section>
    </>
  );
}
