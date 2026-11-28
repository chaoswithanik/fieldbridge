import { Check } from 'lucide-react';
import { progressStages, progressLabels, progressActions } from '../../../shared/order-progress.js';
import { bangla } from '../lib/registration.js';

export default function PortionProgress({ progress, onAdvance, busy }) {
  const current = progressStages.indexOf(progress);

  return (
    <ol className="portion-progress" aria-label="সরবরাহের ধাপ">
      {progressStages.map((stage, index) => {
        const reached = index <= current;
        const isCurrent = index === current;
        const actionable = onAdvance && index === current + 1;
        const contents = (
          <>
            <span className="progress-point" aria-hidden="true">
              {index < current || (isCurrent && stage === 'completed')
                ? <Check size={16} strokeWidth={3} />
                : bangla(index + 1)}
            </span>
            <span>{progressLabels[stage]}</span>
          </>
        );

        return (
          <li key={stage} className={reached ? 'reached' : undefined} aria-current={isCurrent ? 'step' : undefined}>
            {actionable ? (
              <button type="button" className="progress-node" disabled={busy}
                aria-label={progressActions[stage]} onClick={() => onAdvance(stage)}>
                {contents}
              </button>
            ) : (
              <span className="progress-node">{contents}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
