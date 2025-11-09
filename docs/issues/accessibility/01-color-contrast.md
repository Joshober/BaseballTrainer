# Improve Global Color Contrast for Accessibility

## Context
Lighthouse and WCAG 2.2 AA require text/background contrast ratios of 4.5:1 for body copy and 3:1 for large text. Several cards, gradients, and button states may fall short, reducing readability across the experience.

## Tasks
- Audit primary/secondary palettes, gradients, and overlay states across key pages (`app/analyze`, `app/train`, dashboard components).
- Adjust Tailwind tokens or CSS variables so default, hover, and disabled states meet the required contrast ratios.
- Re-test using Lighthouse and a manual contrast checker to confirm compliance.

## Acceptance Criteria
- Lighthouse accessibility audit shows no low-contrast warnings.
- Manual sampling confirms ≥4.5:1 for body text and ≥3:1 for large text/icons in default, hover, and disabled states.

## References
- WCAG 2.2 (1.4.3, 1.4.11)
- https://developer.chrome.com/docs/lighthouse/accessibility/

---

_To publish this issue on GitHub: copy everything from the title downward into a new issue and assign appropriate labels/milestones as needed._
