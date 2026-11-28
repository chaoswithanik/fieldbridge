import { useState } from 'react';
import { Link, NavLink, Outlet, useParams, useSearchParams } from 'react-router-dom';
import { LayoutDashboard, ClipboardCheck, Users, Sprout, ListChecks, Package, Tags, ArrowUpRight, RefreshCw } from 'lucide-react';
import AuthGate from '../components/AuthGate.jsx';
import { useApiResource } from '../lib/resource.js';
import { apiRequest, mediaUrl } from '../lib/api.js';
import { formatMoney, orderDate, orderLabels, responseLabels } from '../lib/orders.js';
import { formatAmount, formatDate, statusLabels, unitLabels } from '../lib/listings.js';
import { progressLabels } from '../../../shared/order-progress.js';
import { bangla } from '../lib/registration.js';
import { cropCatalog } from '../../../shared/crop-catalog.js';
import '../admin.css';

const links = [
  ['', 'সারসংক্ষেপ', LayoutDashboard], ['buyers', 'ক্রেতার আবেদন', ClipboardCheck],
  ['users', 'ব্যবহারকারী', Users], ['listings', 'ফসলের বিজ্ঞাপন', Sprout],
  ['requirements', 'ক্রয় চাহিদা', ListChecks], ['orders', 'অর্ডার', Package],
  ['categories', 'ফসলের শ্রেণি', Tags],
];
const names = Object.fromEntries(links.map(([key, label]) => [key, label]));
const statuses = { ...statusLabels, ...orderLabels, fulfilled: 'পূরণ হয়েছে', open: 'চলমান',
  hidden: 'আড়াল করা', farmer: 'কৃষক', buyer: 'ক্রেতা', blocked: 'প্রবেশ বন্ধ' };
const filters = {
  users: ['farmer', 'buyer', 'blocked'], listings: ['active', 'inactive', 'sold_out', 'hidden'],
  requirements: ['active', 'inactive', 'fulfilled'], orders: ['open', 'completed'],
};

export function AdminLayout() {
  return <AuthGate role="admin"><div className="page-container admin-layout">
    <aside className="admin-sidebar">
      <h2>অ্যাডমিন প্যানেল</h2>
      <nav aria-label="অ্যাডমিন প্যানেল">{links.map(([path, label, Icon]) =>
        <NavLink key={path} end to={path ? `/admin/${path}` : '/admin'}>
          <Icon size={18} aria-hidden="true" />{label}
        </NavLink>)}</nav>
    </aside>
    <div className="admin-main"><Outlet /></div>
  </div></AuthGate>;
}

function Resource({ resource, children }) {
  if (resource.loading) return <p className="admin-state" role="status">তথ্য আনা হচ্ছে…</p>;
  if (resource.error) return <div className="form-alert" role="alert">{resource.error.message}{' '}
    <button className="text-link" onClick={resource.reload}>আবার চেষ্টা করুন</button></div>;
  return children(resource.data);
}

const metrics = [
  ['pending', 'অপেক্ষমাণ আবেদন', 'buyers'], ['farmers', 'নিবন্ধিত কৃষক', 'users?filter=farmer'],
  ['buyers', 'নিবন্ধিত ক্রেতা', 'users?filter=buyer'], ['listings', 'ফসলের বিজ্ঞাপন', 'listings'],
  ['requirements', 'ক্রয় চাহিদা', 'requirements'], ['orders', 'মোট অর্ডার', 'orders'],
];
export function AdminOverview() {
  const [days, setDays] = useState('30');
  const resource = useApiResource(`admin/overview?days=${days}`);
  return <><header className="admin-heading"><h1>প্ল্যাটফর্মের সারসংক্ষেপ</h1>
    <button className="button button-secondary" onClick={resource.reload} aria-label="তথ্য হালনাগাদ"><RefreshCw size={17}/></button></header>
    <Resource resource={resource}>{({ totals, report }) => <>
      <div className="admin-metrics">{metrics.map(([key, label, path]) =>
        <Link key={key} to={`/admin/${path}`}><span>{label}<ArrowUpRight size={15}/></span><strong>{bangla(totals[key])}</strong></Link>)}</div>
      <section className="admin-sheet"><header className="admin-heading"><h2>কার্যক্রমের রিপোর্ট</h2>
        <select aria-label="রিপোর্টের সময়সীমা" value={days} onChange={e => setDays(e.target.value)}>
          {[7, 30, 90].map(n => <option key={n} value={n}>গত {bangla(n)} দিন</option>)}</select></header>
        <dl className="admin-facts">{[['নতুন ব্যবহারকারী', report.newUsers], ['নতুন অর্ডার', report.newOrders],
          ['সম্পন্ন অর্ডার', report.completed], ['ডেলিভারি দেওয়া অংশ', report.deliveries],
          ['কৃষকদের নিশ্চিত করা নগদ মূল্য', formatMoney(report.cash)]].map(([label, value]) =>
            <div key={label}><dt>{label}</dt><dd>{bangla(value)}</dd></div>)}</dl>
      </section>
    </>}</Resource></>;
}

function Details({ row, section }) {
  if (section === 'users') return <p>{row.email || 'ইমেইল দেওয়া হয়নি'} · নিবন্ধন {orderDate(row.createdAt)}</p>;
  if (section === 'orders') return <>
    <p>{row.deliveryAddress} · {bangla(row.buyerPhone)}</p>
    {row.portions.map(p => <p key={p.id}>{p.farmer.fullName} · {formatAmount(p.quantity)} {unitLabels[row.unit]} · {formatMoney(p.totalCost)}
      {' · '}{progressLabels[p.progress] || responseLabels[p.status]}{p.isReplacement && ' · বিকল্প সরবরাহ'}
      {p.deliveryConfirmedAt && ' · নগদ মূল্য গৃহীত'}{p.receiptConfirmedAt && ' · প্রাপ্তি নিশ্চিত'}</p>)}
  </>;
  if (section === 'requirements') return <p>ডেলিভারি · {row.deliveryAddress}{row.instructions && ` · ${row.instructions}`} · সম্পাদনা {bangla(row.editCount)}/২</p>;
  return <><p>{row.description}</p><p>{row.farmAddress} · {row.upazila}, {row.district}</p>
    <p>ফসল কাটা {formatDate(row.harvestDate)} · সরবরাহ {formatDate(row.availableDate)} · সংরক্ষিত {formatAmount(row.reservedQuantity)} {unitLabels[row.unit]}</p>
    <div className="admin-photos">{row.photos.map(url => <a href={mediaUrl(url)} key={url} target="_blank" rel="noreferrer"><img alt={row.cropName} loading="lazy" src={mediaUrl(url)}/></a>)}</div></>;
}

function Directory({ section }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const resource = useApiResource(`admin/${section}?${params}`);
  const change = (key, value) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };
  async function toggle(row) {
    const user = section === 'users';
    const label = user ? (row.blocked ? 'প্রবেশ চালু' : 'প্রবেশ বন্ধ') : (row.hiddenByAdmin ? 'বাজারে ফেরত' : 'বাজার থেকে আড়াল');
    if (!window.confirm(`${row.fullName || row.cropName} — ${label} করবেন?`)) return;
    setBusy(true); setMessage('');
    try {
      await apiRequest(`admin/${section}/${row.id}/${user ? 'access' : 'visibility'}`, {
        method: 'PATCH', body: JSON.stringify(user ? { blocked: !row.blocked } : { hidden: !row.hiddenByAdmin, version: row.version }),
      });
      setMessage('পরিবর্তন সংরক্ষিত হয়েছে।'); resource.reload();
    } catch (error) { setMessage(error.message); resource.reload(); }
    finally { setBusy(false); }
  }
  return <><header className="admin-heading"><h1>{names[section]}</h1>
    <button className="button button-secondary" onClick={resource.reload} aria-label="তালিকা হালনাগাদ"><RefreshCw size={17}/></button></header>
    <form className="admin-controls" onSubmit={e => { e.preventDefault(); change('q', search.trim()); }}>
      <input aria-label="তালিকায় খুঁজুন" placeholder={{ users:'নাম, ফোন বা ইমেইল', listings:'ফসল বা জেলা', requirements:'ফসল বা ঠিকানা', orders:'অর্ডার নম্বর' }[section]}
        maxLength={100} value={search} onChange={e => setSearch(e.target.value)}/>
      <button className="button button-primary">খুঁজুন</button>
      <select aria-label="তালিকা বাছাই" value={params.get('filter') || ''} onChange={e => change('filter', e.target.value)}>
        <option value="">সব দেখুন</option>{filters[section].map(v => <option key={v} value={v}>{statuses[v]}</option>)}</select>
    </form>
    {message && <p role="status">{message}</p>}
    <Resource resource={resource}>{({ records, total, page, pages }) => <>
      <p className="field-hint">মোট {bangla(total)}টি</p>
      <div className="admin-records">{records.map(row => {
        const person = row.farmer || row.buyer;
        const title = row.fullName || row.cropName;
        const status = section === 'users' ? (row.blocked ? 'প্রবেশ বন্ধ' : 'সক্রিয়') :
          row.hiddenByAdmin ? statuses.hidden : statuses[row.status];
        return <article key={row.id} className="admin-record"><header><div><h2>{title}</h2>
          <p>{section === 'users' ? `${statuses[row.role]} · ${bangla(row.phone)}` :
            section === 'orders' ? `#${row.id.slice(0,8)} · ${row.buyerName} · ${formatMoney(row.currentCost)}` :
            `${person.fullName} · ${formatAmount(row.quantity)} ${unitLabels[row.unit]}`}
            {section === 'listings' && ` · ${formatMoney(row.pricePerUnit)}/${unitLabels[row.unit]}`}</p></div>
          <span className="order-badge">{status}</span></header>
          <footer><details><summary>বিস্তারিত দেখুন</summary><Details section={section} row={row}/></details>
            {['users','listings'].includes(section) && <button className="text-link" disabled={busy} onClick={() => toggle(row)}>
              {section === 'users' ? (row.blocked ? 'প্রবেশ চালু করুন' : 'প্রবেশ বন্ধ করুন') : (row.hiddenByAdmin ? 'আড়াল সরান' : 'বিজ্ঞাপন আড়াল করুন')}</button>}
          </footer>
        </article>;
      })}</div>{!records.length && <p className="admin-state">কোনো তথ্য পাওয়া যায়নি।</p>}
      {pages > 1 && <nav className="review-pagination" aria-label="পাতা নির্বাচন">
        <button className="text-link" disabled={page <= 1} onClick={() => change('page', page-1)}>আগের পাতা</button>
        <span>{bangla(page)} / {bangla(pages)}</span><button className="text-link" disabled={page >= pages} onClick={() => change('page', page+1)}>পরের পাতা</button></nav>}
    </>}</Resource></>;
}
export function AdminDirectory() {
  const { section } = useParams();
  if (!Object.hasOwn(filters, section)) return <Link to="/admin">সারসংক্ষেপে ফিরুন</Link>;
  return <Directory key={section} section={section}/>;
}

export function AdminCategories() {
  const resource = useApiResource('admin/categories');
  const blank = { name: '', cropIds: [] };
  const [form, setForm] = useState(blank), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function save(row, remove = false) {
    if (remove && !window.confirm(`‘${row.name}’ শ্রেণিটি সরাবেন?`)) return;
    setBusy(true); setMessage('');
    try {
      const { name, cropIds, version } = row;
      await apiRequest(`admin/categories${row.id ? '/'+row.id : ''}`, {
        method: remove ? 'DELETE' : row.id ? 'PUT' : 'POST',
        body: JSON.stringify(remove ? { version } : { name, cropIds, version }),
      });
      setForm(blank); setMessage(remove ? 'শ্রেণি সরানো হয়েছে।' : 'শ্রেণি সংরক্ষিত হয়েছে।'); resource.reload();
    } catch (error) { setMessage(error.message); if (error.status === 409) resource.reload(); }
    finally { setBusy(false); }
  }
  return <><header className="admin-heading"><h1>ফসলের শ্রেণি</h1></header>
    <form className="admin-sheet" onSubmit={e => { e.preventDefault(); save(form); }}>
      <fieldset disabled={busy}><legend>{form.id ? 'শ্রেণি সম্পাদনা' : 'নতুন শ্রেণি'}</legend>
        <label>শ্রেণির নাম<input required maxLength={80} value={form.name} onChange={e => setForm({...form,name:e.target.value})}/></label>
        <p className="field-hint">বাজারে এই শ্রেণি দিয়ে কোন ফসলগুলো খুঁজে পাওয়া যাবে?</p>
        <div className="admin-crops">{cropCatalog.map(c => <label key={c.id}><input type="checkbox" checked={form.cropIds.includes(c.id)}
          onChange={e => setForm({...form, cropIds: e.target.checked ? [...form.cropIds,c.id] : form.cropIds.filter(id => id !== c.id)})}/>{c.name}</label>)}</div>
        <button className="button button-primary" disabled={!form.name.trim() || !form.cropIds.length}>সংরক্ষণ করুন</button>{' '}
        {form.id && <button type="button" className="button button-secondary" onClick={() => setForm(blank)}>বাতিল</button>}
      </fieldset></form>
    {message && <p role="status">{message}</p>}
    <Resource resource={resource}>{({categories}) => categories.length ? categories.map(c =>
      <article className="admin-record" key={c.id}><h2>{c.name}</h2><p>{cropCatalog.filter(x => c.cropIds.includes(x.id)).map(x => x.name).join(' · ')}</p>
        <footer><button className="text-link" disabled={busy} onClick={() => setForm(c)}>সম্পাদনা</button>
          <button className="text-link" disabled={busy} onClick={() => save(c,true)}>সরান</button></footer></article>) :
      <p className="admin-state">এখনো কোনো শ্রেণি যোগ করা হয়নি।</p>}</Resource>
  </>;
}
