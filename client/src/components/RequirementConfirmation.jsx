import { useEffect, useRef } from 'react';
import { LoaderCircle, Trash2, ClipboardCheck } from 'lucide-react';

export default function RequirementConfirmation({ action, busy, error, onCancel, onConfirm }) {
  const dialog = useRef(null),
    deleting = action.type === 'delete';
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="listing-dialog"
      aria-labelledby="requirement-confirm-title"
      aria-describedby="requirement-confirm-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <span className={`listing-dialog-icon ${deleting ? 'is-danger' : ''}`}>
        {deleting ? (
          <Trash2 size={25} aria-hidden="true" />
        ) : (
          <ClipboardCheck size={25} aria-hidden="true" />
        )}
      </span>
      <h2 id="requirement-confirm-title">
        {deleting ? 'চাহিদাটি মুছে ফেলবেন?' : 'এই চাহিদা পূরণ হয়েছে?'}
      </h2>
      <p id="requirement-confirm-description">
        <strong>{action.requirement.cropName}</strong> —{' '}
        {deleting
          ? 'চাহিদাটি স্থায়ীভাবে মুছে যাবে। এই কাজ ফিরিয়ে আনা যাবে না।'
          : 'চাহিদাটি পূরণ হয়েছে হিসেবে সংরক্ষণ হবে। প্রয়োজন হলে পরে আবার চালু করতে পারবেন।'}
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
          {deleting ? 'মুছে ফেলুন' : 'পূরণ হয়েছে চিহ্নিত করুন'}
        </button>
      </div>
    </dialog>
  );
}
