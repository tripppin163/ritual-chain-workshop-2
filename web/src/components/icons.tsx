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
