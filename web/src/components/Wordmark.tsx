import Link from "next/link";

/**
 * The site's name, and the way back to the board from anywhere.
 *
 * Set as a lockup rather than as a title. "Ritual" is the chain this runs on — context,
 * and so it stays quiet; "Predict" is what this app does with it, and carries the ink.
 * Weight 500 rather than 600 because type on a near-black field optically gains about
 * half a step, and the open tracking is what keeps two words from fusing into a slab.
 */
export function Wordmark() {
  return (
    <Link
      href="/"
      aria-label="Ritual Predict — back to the markets"
      className="text-[15px] font-medium tracking-[0.01em] whitespace-nowrap transition-opacity hover:opacity-80 sm:text-[16px]"
    >
      <span className="text-ink-soft">Ritual</span>
      <span className="text-ink"> Predict</span>
    </Link>
  );
}
