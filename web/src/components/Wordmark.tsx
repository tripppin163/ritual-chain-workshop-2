import Link from "next/link";

/**
 * The site's name, with Ritual's knot standing in for the "a".
 *
 * The visible pieces are hidden from assistive tech and the whole link carries one
 * label instead, so it is announced as a name rather than spelled out around a gap.
 */
export function Wordmark() {
  return (
    <Link
      href="/"
      aria-label="Ritual Predict — back to the markets"
      className="group inline-flex items-baseline text-[19px] font-semibold tracking-[-0.02em] whitespace-nowrap text-ink transition-opacity hover:opacity-80 sm:text-[21px]"
    >
      <span aria-hidden>Ritu</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ritual-mark.png"
        alt=""
        aria-hidden
        width={192}
        height={192}
        className="mx-[0.08em] inline-block h-[0.82em] w-[0.82em] translate-y-[0.06em]"
      />
      <span aria-hidden>l Predict</span>
    </Link>
  );
}
