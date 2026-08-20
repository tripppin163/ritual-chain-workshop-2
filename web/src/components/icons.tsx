/**
 * Small glyphs drawn for this project, one per kind of destination, so a link's target
 * is obvious before reading its label: a repository, a site, documentation, a social
 * account, or another page here.
 *
 * Deliberately geometric rather than brand artwork — the label beside each one already
 * names where it goes.
 */
type IconProps = { className?: string };

const base = "shrink-0";
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Angle brackets: a code repository. */
export const RepoIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} aria-hidden>
    <path d="M5.6 4.6 2.2 8l3.4 3.4M10.4 4.6 13.8 8l-3.4 3.4" {...stroke} />
  </svg>
);

/** A globe: somebody's website. */
export const SiteIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} aria-hidden>
    <circle cx="8" cy="8" r="5.6" {...stroke} />
    <path d="M2.4 8h11.2M8 2.4c1.5 1.6 2.3 3.5 2.3 5.6S9.5 12 8 13.6C6.5 12 5.7 10.1 5.7 8S6.5 4 8 2.4Z" {...stroke} />
  </svg>
);

/** An open book: documentation. */
export const DocsIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} aria-hidden>
    <path d="M8 4.4C6.9 3.6 5.6 3.2 4 3.2H2.4v9.2H4c1.6 0 2.9.4 4 1.2 1.1-.8 2.4-1.2 4-1.2h1.6V3.2H12c-1.6 0-2.9.4-4 1.2Z" {...stroke} />
    <path d="M8 4.4v9.2" {...stroke} />
  </svg>
);

/** A crossed pair of strokes: a social account. */
export const SocialIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} aria-hidden>
    <path d="M3.4 3.4 12.6 12.6M12.6 3.4 3.4 12.6" {...stroke} />
  </svg>
);

/** An arrow into a page of this site. */
export const PageIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} aria-hidden>
    <path d="M3 8h9M8.6 4.6 12 8l-3.4 3.4" {...stroke} />
  </svg>
);

/** A ripple: the Scheduler waking a contract nobody touched. */
export const WakeIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} aria-hidden>
    <circle cx="8" cy="8" r="1.6" fill="currentColor" />
    <path d="M11.3 4.7a4.7 4.7 0 0 1 0 6.6M4.7 11.3a4.7 4.7 0 0 1 0-6.6" {...stroke} />
  </svg>
);

/** A check: an outcome recorded. */
export const SettledIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} aria-hidden>
    <path d="M3.4 8.6 6.4 11.6l6.2-7.2" {...stroke} />
  </svg>
);

/** A struck circle: an attempt that came back empty. */
export const FailedIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} aria-hidden>
    <circle cx="8" cy="8" r="5.4" {...stroke} />
    <path d="M5.6 5.6 10.4 10.4" {...stroke} />
  </svg>
);

/** A returning arrow: stakes going back where they came from. */
export const RefundIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} aria-hidden>
    <path d="M13 9.2a4.6 4.6 0 0 0-4.6-4.6H3.6" {...stroke} />
    <path d="M6 2.2 3.2 4.6 6 7" {...stroke} />
  </svg>
);

/** A chevron for a row that opens. */
export const ChevronIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="12" height="12" className={`${base} ${className}`} aria-hidden>
    <path d="M6 4l4 4-4 4" {...stroke} />
  </svg>
);

/** A left arrow, for the way back. */
export const BackIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="13" height="13" className={`${base} ${className}`} aria-hidden>
    <path d="M13 8H3.6M7 3.6 3 8l4 4.4" {...stroke} />
  </svg>
);

/** A cross, for dismissing. */
export const CloseIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} aria-hidden>
    <path d="M4 4l8 8M12 4l-8 8" {...stroke} />
  </svg>
);

/** A plus that becomes a minus when its row opens. */
export const PlusIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} aria-hidden>
    <path d="M8 3.4v9.2M3.4 8h9.2" {...stroke} />
  </svg>
);

/** A dial mid-turn: something the chain has started but not finished. */
export const PendingIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} aria-hidden>
    <circle cx="8" cy="8" r="5.4" {...stroke} strokeDasharray="3 2.4" />
  </svg>
);

/** An empty ring: a step not reached yet. */
export const StepIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} aria-hidden>
    <circle cx="8" cy="8" r="4.2" {...stroke} />
  </svg>
);

/** A filled ring: the step being worked on. */
export const StepActiveIcon = ({ className = "" }: IconProps) => (
  <svg viewBox="0 0 16 16" width="14" height="14" className={`${base} ${className}`} aria-hidden>
    <circle cx="8" cy="8" r="4.2" {...stroke} />
    <circle cx="8" cy="8" r="1.8" fill="currentColor" />
  </svg>
);
