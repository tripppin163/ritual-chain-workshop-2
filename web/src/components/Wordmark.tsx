import Link from "next/link";

/**
 * The site's name, and the way back to the board from anywhere.
 *
 * Plain type on purpose. The molten field was cut into these letters and it worked
 * mechanically, but at 21px the material is too fine to read as metal — the wordmark
 * only lost contrast against the flat white it replaced. The effect stayed on the two
 * primary buttons, where the surface is big enough to show it.
 */
export function Wordmark() {
  return (
    <Link
      href="/"
      aria-label="Ritual Predict — back to the markets"
      className="text-[19px] font-semibold tracking-[-0.02em] whitespace-nowrap text-ink transition-opacity hover:opacity-80 sm:text-[21px]"
    >
      Ritual Predict
    </Link>
  );
}
