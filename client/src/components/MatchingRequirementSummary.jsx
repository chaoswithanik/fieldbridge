import { ClipboardList, MapPin } from 'lucide-react';
import { formatAmount, unitLabels } from '../lib/listings.js';
import { requirementLabels } from '../lib/requirements.js';

export default function MatchingRequirementSummary({ requirement }) {
  return (
    <>
      <section className="matching-requirement" aria-label="আপনার ক্রয় চাহিদার তথ্য">
        <div className="matching-requirement-main">
          <span className="matching-requirement-icon">
            <ClipboardList size={23} aria-hidden="true" />
          </span>
          <div>
            <span className="field-hint">আপনার চাহিদা</span>
            <h2>{requirement.cropName}</h2>
          </div>
          <span className={`listing-status requirement-status-${requirement.status}`}>
            {requirementLabels[requirement.status]}
          </span>
        </div>
        <p className="matching-required-quantity">
          প্রয়োজন{' '}
          <strong>
            {formatAmount(requirement.quantity)} {unitLabels[requirement.unit]}
          </strong>
        </p>
        <p className="matching-delivery">
          <MapPin size={16} aria-hidden="true" />
          <span>{requirement.deliveryAddress}</span>
        </p>
      </section>
      {requirement.status !== 'active' && (
        <p className="listing-info">
          চাহিদাটি এখন “{requirementLabels[requirement.status]}” অবস্থায় আছে। এখানে বর্তমান মজুতের
          সঙ্গে মিল দেখানো হচ্ছে। অর্ডার দিতে চাহিদাটি চালু করুন।
        </p>
      )}
    </>
  );
}
