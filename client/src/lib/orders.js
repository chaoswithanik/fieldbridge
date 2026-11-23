import { bangla } from './registration.js';
export const responseLabels = {
  pending: 'উত্তরের অপেক্ষায়',
  accepted: 'গ্রহণ করেছেন',
  rejected: 'প্রত্যাখ্যান করেছেন',
};
export const orderLabels = {
  awaiting_response: 'কৃষকের উত্তরের অপেক্ষায়',
  accepted: 'সব অংশ গৃহীত',
  partially_accepted: 'কিছু অংশ গৃহীত',
  rejected: 'সব অংশ প্রত্যাখ্যাত',
};
export const formatMoney = (value) => {
  const [whole, fraction = ''] = String(value).split('.');
  return `৳${new Intl.NumberFormat('bn-BD').format(BigInt(whole))}.${bangla(fraction.padEnd(2, '0'))}`;
};
export const orderDate = (value) =>
  new Intl.DateTimeFormat('bn-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
    timeZone: 'Asia/Dhaka',
  }).format(new Date(value));
export const notificationsChanged = () =>
  window.dispatchEvent(new Event('fieldbridge:notifications'));
