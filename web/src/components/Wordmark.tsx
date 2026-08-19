import Link from "next/link";

/** The site's name, and the way back to the board from anywhere. */
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
