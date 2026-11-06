/**
 * The small pen that marks a cocktail as the user's own: written by hand, or
 * changed from the recipe it came from. An inline SVG rather than the ✎
 * character, which some phones swap for a colour emoji.
 */
export default function CustomMark({ title = 'Your own version' }: { title?: string }) {
  return (
    <svg className="custom-mark" viewBox="0 0 12 12" width="11" height="11" role="img" aria-label={title}>
      <title>{title}</title>
      <path
        d="M8.6 1.4l2 2-6.4 6.4-2.6.6.6-2.6 6.4-6.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}
