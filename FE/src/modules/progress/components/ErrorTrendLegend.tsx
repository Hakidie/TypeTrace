import { errorLabels } from '@/modules/typing/typing.config';
import type { SessionErrorType } from '@/shared/lib/typing-language';
import { ERROR_TREND_STYLES } from '../lib/error-trend';

/** The legend of the error rate chart, centered under it: a sample of the line and the name of each type whose line shows. */
export const ErrorTrendLegend = ({ types }: { types: readonly SessionErrorType[] }) => (
  <ul aria-label="Error types shown" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-base">
    {types.map((type) => (
      <li key={type} className="inline-flex h-10 items-center gap-2 whitespace-nowrap">
        <svg width="24" height="4" aria-hidden className="shrink-0">
          <line x1="0" x2="24" y1="2" y2="2" stroke={ERROR_TREND_STYLES[type].color} strokeWidth="2" strokeDasharray={ERROR_TREND_STYLES[type].dash} />
        </svg>
        {errorLabels[type]}
      </li>
    ))}
  </ul>
);
