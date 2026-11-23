import { Link } from 'react-router-dom';
import { LoaderCircle, UsersRound } from 'lucide-react';
import { useApiResource } from '../lib/resource.js';
import { bangla } from '../lib/registration.js';
import { formatAmount, unitLabels } from '../lib/listings.js';
export default function ReplacementSuggestions({ order }) {
  const { data, loading, error } = useApiResource(`orders/${order.id}/replacements`);
  return (
    <section className="replacement-hint" aria-labelledby="replacement-hint-title">
      <div>
        <h2 id="replacement-hint-title">
          <UsersRound size={18} aria-hidden="true" /> বিকল্প কৃষকের সরবরাহ
        </h2>
        <p>
          অর্ডারের বাকি অংশের জন্য প্রয়োজন {formatAmount(order.replacementNeededQuantity)}{' '}
          {unitLabels[order.unit]}।
        </p>
        {loading ? (
          <p role="status">
            <LoaderCircle className="spin" size={16} aria-hidden="true" /> উপযুক্ত সরবরাহের পরামর্শ
            খোঁজা হচ্ছে…
          </p>
        ) : error ? (
          <p>পরামর্শ এখন দেখা যাচ্ছে না। বিকল্প সরবরাহের পাতায় নিজে খুঁজে বেছে নিতে পারবেন।</p>
        ) : (
          <p>
            {data.recommendations.length
              ? `${bangla(data.recommendations.length)}টি সরবরাহের পরামর্শ পাওয়া গেছে।`
              : 'এখন কোনো উপযুক্ত পরামর্শ নেই। নতুন মজুত এলে আবার দেখুন।'}{' '}
            আপনার নিশ্চিতকরণ ছাড়া কোনো কৃষক যুক্ত হবেন না।
          </p>
        )}
      </div>
      <Link className="button button-primary" to={`/orders/${order.id}/replacements`}>
        বিকল্প সরবরাহ বেছে নিন
      </Link>
    </section>
  );
}
