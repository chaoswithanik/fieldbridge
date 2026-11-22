import { useEffect, useRef } from 'react';
import { LoaderCircle, Trash2, PackageCheck } from 'lucide-react';

export default function ListingConfirmation({ action, busy, error, onCancel, onConfirm }) {
  const dialog = useRef(null);
  const deleting = action.type === 'delete';
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="listing-dialog"
      aria-labelledby="listing-confirm-title"
      aria-describedby="listing-confirm-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <span className={`listing-dialog-icon ${deleting ? 'is-danger' : ''}`}>
        {deleting ? (
          <Trash2 size={25} aria-hidden="true" />
        ) : (
          <PackageCheck size={25} aria-hidden="true" />
        )}
      </span>
      <h2 id="listing-confirm-title">
        {deleting ? 'বিজ্ঞাপনটি মুছে ফেলবেন?' : 'সব ফসল বিক্রি হয়ে গেছে?'}
      </h2>
      <p id="listing-confirm-description">
        <strong>{action.listing.cropName}</strong> —{' '}
        {deleting
          ? 'বিজ্ঞাপন ও এর ছবিগুলো মুছে যাবে। এই কাজ ফিরিয়ে আনা যাবে না।'
          : 'মজুতের পরিমাণ শূন্য হবে এবং বিজ্ঞাপনটি বন্ধ থাকবে। পরে নতুন পরিমাণ দিয়ে আবার চালু করতে পারবেন।'}
      </p>
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      <div className="listing-dialog-actions">
        <button
          type="button"
          className="button button-secondary"
          disabled={busy}
          onClick={onCancel}
          autoFocus
        >
          ফিরে যান
        </button>
        <button
          type="button"
          className={`button ${deleting ? 'button-reject' : 'button-primary'}`}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy && <LoaderCircle className="spin" size={17} aria-hidden="true" />}
          {deleting ? 'মুছে ফেলুন' : 'বিক্রি শেষ করুন'}
        </button>
      </div>
    </dialog>
  );
}
