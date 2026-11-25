import { CropSuggestions } from '../components/CropPicker.jsx';
import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  Sprout,
  Search,
  SlidersHorizontal,
  RotateCcw,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import FormField from '../components/FormField.jsx';
import MarketAccessNotice from '../components/MarketAccessNotice.jsx';
import MarketCropCard from '../components/MarketCropCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { bangla } from '../lib/registration.js';
import { unitLabels } from '../lib/listings.js';
import { emptyMarketFilters, marketFilterKeys, useMarketResource } from '../lib/marketplace.js';

export default function Marketplace() {
  const { user } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const [form, setForm] = useState(() => ({
    ...emptyMarketFilters,
    ...Object.fromEntries(marketFilterKeys.map((key) => [key, params.get(key) || ''])),
  }));
  const { data, loading, error, reload } = useMarketResource(
    `marketplace/listings${query ? `?${query}` : ''}`,
  );
  const fullAccess =
    error?.status === 403
      ? false
      : (data?.access.canViewPrices ??
        (user?.role === 'admin' ||
          (user?.role === 'buyer' && user.buyerProfile?.status === 'approved')));
  useEffect(() => {
    const current = new URLSearchParams(query);
    setForm(Object.fromEntries(marketFilterKeys.map((key) => [key, current.get(key) || ''])));
  }, [query]);
  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }
  function apply(event) {
    event.preventDefault();
    const next = Object.fromEntries(
      Object.entries(form).filter(
        ([key, value]) => value.trim() && (fullAccess || !['minPrice', 'maxPrice'].includes(key)),
      ),
    );
    const sort = params.get('sort');
    if (
      sort &&
      (form.unit || !['quantity_desc', 'price_asc', 'price_desc'].includes(sort)) &&
      (fullAccess || !sort.startsWith('price_'))
    )
      next.sort = sort;
    setParams(next);
  }
  function clear() {
    setForm({ ...emptyMarketFilters });
    setParams({});
  }
  function page(number) {
    const next = new URLSearchParams(params);
    next.set('page', String(number));
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const fieldErrors = error?.fields || {};
  const unitOptions = [
    { value: '', label: 'সব একক' },
    ...Object.entries(unitLabels).map(([value, label]) => ({ value, label })),
  ];
  const activeFilters = marketFilterKeys.filter((key) => Boolean(params.get(key))).length;
  return (
    <section className="page-container market-page">
      <div className="market-heading">
        <div>
          <span className="eyebrow">
            <Sprout size={17} aria-hidden="true" /> মাঠ থেকে বাজারে
          </span>
          <h1>ফসলের বাজার</h1>
        </div>
        {user?.role === 'farmer' && (
          <Link className="button button-secondary" to="/account/listings">
            আমার বিজ্ঞাপন
          </Link>
        )}
      </div>
      <MarketAccessNotice access={data?.access} />
      <form className="market-search" onSubmit={apply} noValidate>
        <div className="market-search-main">
          <FormField
            name="q"
            list="market-crop-suggestions"
            label="ফসলের নাম"
            placeholder="বাংলা বা ইংরেজিতে খুঁজুন"
            value={form.q}
            onChange={change}
            maxLength={100}
            error={fieldErrors.q}
            optional
          />
          <CropSuggestions id="market-crop-suggestions" query={form.q} />
          <FormField
            name="district"
            label="জেলা"
            placeholder="যেমন: বগুড়া"
            value={form.district}
            onChange={change}
            maxLength={80}
            error={fieldErrors.district}
            optional
          />
          <FormField
            name="upazila"
            label="উপজেলা"
            placeholder="যেমন: শিবগঞ্জ"
            value={form.upazila}
            onChange={change}
            maxLength={80}
            error={fieldErrors.upazila}
            optional
          />
          <FormField
            name="unit"
            label="একক"
            value={form.unit}
            onChange={change}
            options={unitOptions}
            error={fieldErrors.unit}
            optional
          />
          <button className="button button-primary" type="submit">
            <Search size={17} aria-hidden="true" /> ফসল খুঁজুন
          </button>
        </div>
        <details
          className="market-more-filters"
          open={
            Object.keys(fieldErrors).some(
              (key) => !['q', 'district', 'upazila', 'unit', 'page', 'sort'].includes(key),
            )
              ? true
              : undefined
          }
        >
          <summary>
            <SlidersHorizontal size={16} aria-hidden="true" /> আরও ফিল্টার{' '}
            <span>পরিমাণ, তারিখ{fullAccess ? ' ও দাম' : ''}</span>
          </summary>
          <p className="field-hint">দাম বা পরিমাণ দিয়ে খুঁজতে আগে একক বেছে নিন।</p>
          <div className="market-filter-sections">
            <fieldset>
              <legend>মজুতের পরিমাণ</legend>
              <div className="market-range">
                <FormField
                  name="minQuantity"
                  label="সর্বনিম্ন পরিমাণ"
                  inputMode="decimal"
                  value={form.minQuantity}
                  onChange={change}
                  maxLength={13}
                  error={fieldErrors.minQuantity}
                  optional
                />
                <FormField
                  name="maxQuantity"
                  label="সর্বোচ্চ পরিমাণ"
                  inputMode="decimal"
                  value={form.maxQuantity}
                  onChange={change}
                  maxLength={13}
                  error={fieldErrors.maxQuantity}
                  optional
                />
              </div>
            </fieldset>
            <fieldset>
              <legend>ফসল কাটার সময়</legend>
              <div className="market-range">
                <FormField
                  name="harvestFrom"
                  label="শুরুর তারিখ"
                  type="date"
                  value={form.harvestFrom}
                  onChange={change}
                  error={fieldErrors.harvestFrom}
                  optional
                />
                <FormField
                  name="harvestTo"
                  label="শেষ তারিখ"
                  type="date"
                  value={form.harvestTo}
                  onChange={change}
                  error={fieldErrors.harvestTo}
                  optional
                />
              </div>
            </fieldset>
            <fieldset>
              <legend>সরবরাহ শুরুর সময়</legend>
              <div className="market-range">
                <FormField
                  name="availableFrom"
                  label="শুরুর তারিখ"
                  type="date"
                  value={form.availableFrom}
                  onChange={change}
                  error={fieldErrors.availableFrom}
                  optional
                />
                <FormField
                  name="availableTo"
                  label="শেষ তারিখ"
                  type="date"
                  value={form.availableTo}
                  onChange={change}
                  error={fieldErrors.availableTo}
                  optional
                />
              </div>
            </fieldset>
            {fullAccess && (
              <fieldset>
                <legend>প্রতি এককের দাম (টাকা)</legend>
                <div className="market-range">
                  <FormField
                    name="minPrice"
                    label="সর্বনিম্ন দাম"
                    inputMode="decimal"
                    value={form.minPrice}
                    onChange={change}
                    maxLength={13}
                    error={fieldErrors.minPrice}
                    optional
                  />
                  <FormField
                    name="maxPrice"
                    label="সর্বোচ্চ দাম"
                    inputMode="decimal"
                    value={form.maxPrice}
                    onChange={change}
                    maxLength={13}
                    error={fieldErrors.maxPrice}
                    optional
                  />
                </div>
              </fieldset>
            )}
          </div>
          <button className="button button-secondary market-filter-apply" type="submit">
            ফিল্টার প্রয়োগ করুন
          </button>
        </details>
        {(activeFilters > 0 || query) && (
          <div className="market-filter-reset">
            <span>{bangla(activeFilters)}টি ফিল্টার চালু</span>
            <button className="text-button" type="button" onClick={clear}>
              <RotateCcw size={14} aria-hidden="true" /> সব ফিল্টার মুছুন
            </button>
          </div>
        )}
      </form>
      <div className="market-results-toolbar">
        <p role="status">
          {loading
            ? 'ফসল খোঁজা হচ্ছে…'
            : data
              ? `${bangla(data.total)}টি বিজ্ঞাপন পাওয়া গেছে`
              : 'ফলাফল দেখা যাচ্ছে না'}
        </p>
        <div className="market-sort">
          <label htmlFor="market-sort">সাজান</label>
          <select
            id="market-sort"
            value={params.get('sort') || 'newest'}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              next.set('sort', event.target.value);
              next.delete('page');
              setParams(next);
            }}
          >
            <option value="newest">নতুন বিজ্ঞাপন আগে</option>
            <option value="available_asc">আগে সরবরাহ হবে</option>
            <option value="harvest_asc">আগে ফসল কাটা হবে</option>
            {params.get('unit') && <option value="quantity_desc">বেশি মজুত আগে</option>}
            {fullAccess && params.get('unit') && (
              <>
                <option value="price_asc">কম দাম আগে</option>
                <option value="price_desc">বেশি দাম আগে</option>
              </>
            )}
          </select>
          <button
            type="button"
            className="market-reload"
            onClick={reload}
            disabled={loading}
            aria-label="বাজারের তালিকা হালনাগাদ করুন"
          >
            <RefreshCw size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      {loading ? (
        <div className="admin-loading" role="status">
          <LoaderCircle className="spin" size={22} aria-hidden="true" /> ফসলের বিজ্ঞাপনগুলো দেখা
          হচ্ছে…
        </div>
      ) : error ? (
        <div className="market-error">
          <p className="form-alert" role="alert">
            {error.message}
          </p>
          <button className="button button-secondary" onClick={reload}>
            আবার চেষ্টা করুন
          </button>
        </div>
      ) : data?.listings.length ? (
        <>
          <div className="listing-grid">
            {data.listings.map((listing) => (
              <MarketCropCard
                key={listing.id}
                listing={listing}
                from={location.pathname + location.search}
              />
            ))}
          </div>
          {data.pages > 1 && (
            <nav className="review-pagination" aria-label="বাজারের পাতা">
              <button
                className="button button-secondary"
                disabled={data.page <= 1}
                onClick={() => page(data.page - 1)}
              >
                আগের পাতা
              </button>
              <span>
                পাতা {bangla(data.page)} / {bangla(data.pages)}
              </span>
              <button
                className="button button-secondary"
                disabled={data.page >= data.pages}
                onClick={() => page(data.page + 1)}
              >
                পরের পাতা
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="listing-empty">
          <span className="listing-empty-icon">
            <Search size={30} aria-hidden="true" />
          </span>
          <h2>
            {activeFilters ? 'এই খোঁজে কোনো ফসল পাওয়া যায়নি' : 'বাজারে এখন কোনো ফসলের বিজ্ঞাপন নেই'}
          </h2>
          <p>
            {activeFilters
              ? 'অন্য নাম বা অবস্থান দিয়ে খুঁজুন, অথবা ফিল্টার মুছে আবার দেখুন।'
              : 'কৃষকের নতুন বিজ্ঞাপন প্রকাশ হলে এখানে দেখা যাবে।'}
          </p>
          {data?.page > 1 ? (
            <button className="button button-secondary" onClick={() => page(1)}>
              প্রথম পাতায় যান
            </button>
          ) : (
            activeFilters > 0 && (
              <button className="button button-secondary" onClick={clear}>
                সব ফিল্টার মুছুন
              </button>
            )
          )}
        </div>
      )}
    </section>
  );
}
