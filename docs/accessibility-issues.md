# Accessibility Improvements Backlog

These tasks align the site with Google/Lighthouse accessibility expectations (WCAG 2.2 AA). Each section can be copied into a GitHub issue when you are ready. For ready-to-post issue templates, see:

- [Improve global color contrast for accessibility](issues/accessibility/01-color-contrast.md)
- [Guarantee keyboard navigation & visible focus states](issues/accessibility/02-keyboard-focus.md)
- [Add semantic labels, alt text, and accessible names](issues/accessibility/03-semantic-labels.md)
- [Improve form semantics & error messaging](issues/accessibility/04-form-semantics.md)
- [Provide captions, transcripts, and media alternatives](issues/accessibility/05-media-alternatives.md)
- [Introduce skip links, landmarks, and heading hierarchy](issues/accessibility/06-skip-links-landmarks.md)

To file an issue, open the corresponding markdown file above and copy everything from the title downward into a new GitHub issue.

---

## Issue: Improve global color contrast for accessibility

### Context
Lighthouse and WCAG 2.2 AA require text/background contrast ratios of 4.5:1 for body copy and 3:1 for large text. Several cards, gradients, and button states may fall short, reducing readability.

### Tasks
- Audit primary/secondary palettes, gradients, and overlay states across key pages (`app/analyze`, `app/train`, dashboard components).
- Adjust Tailwind tokens or CSS variables so default, hover, and disabled states meet the required contrast ratios.
- Re-test using Lighthouse and a manual contrast checker.

### Acceptance Criteria
- Lighthouse accessibility audit shows no low-contrast warnings.
- Manual sampling confirms ≥4.5:1 for body text and ≥3:1 for large text/icons.

### References
- WCAG 2.2 (1.4.3, 1.4.11)
- https://developer.chrome.com/docs/lighthouse/accessibility/

---

## Issue: Guarantee keyboard navigation & visible focus states

### Context
Interactive elements must be usable via keyboard and expose a visible focus indicator to comply with WCAG 2.1.1/2.4.7 and Lighthouse checks.

### Tasks
- Ensure modals, dropdowns, and carousels (e.g., OpenRouter modal, video cards) trap focus and restore it when closed.
- Add consistent custom focus styles (`outline`, `outline-offset`, `focus-visible`) across buttons, links, nav tabs, and filters.
- Verify keyboard-only navigation reaches all controls without traps.

### Acceptance Criteria
- Keyboard users can access every control and escape modals.
- Focus states remain visible (≥3px outline or equivalent contrast) on all interactive components.

### References
- WCAG 2.1.1, 2.4.7
- https://developer.chrome.com/docs/devtools/accessibility/reference

---

## Issue: Add semantic labels, alt text, and accessible names

### Context
Icons and media controls must expose descriptive labels for assistive tech (WCAG 1.1.1, 4.1.2). Lighthouse flags missing `aria-label`/`alt`.

### Tasks
- Audit `VideoGallery`, `Train`, dashboards to replace purely visual labels with `aria-label`, `aria-labelledby`, or visually hidden text.
- Provide `alt` text for hero/profile images; mark decorative images with empty `alt`.
- Ensure custom video controls expose names such as `aria-label="Play video"`.

### Acceptance Criteria
- No Lighthouse “Image elements do not have alt attributes” or ARIA validation warnings.
- Screen-reader test (NVDA/VoiceOver) announces the purpose of each icon button.

### References
- WCAG 1.1.1, 4.1.2
- https://developers.google.com/search/docs/appearance/images

---

## Issue: Improve form semantics & error messaging

### Context
Forms must expose labels and validation feedback via programmatic associations (WCAG 3.3.x). Google accessibility tooling checks for this.

### Tasks
- Ensure login, profile, mission forms use `<label for>` or `aria-labelledby` and associate helper/error text via `aria-describedby`.
- Surface inline or toast errors with `role="alert"` for async failures (e.g., analysis errors).
- Review `app/login`, `app/auth/callback`, `components/ProfileForm`, and mission capture forms for consistent patterns.

### Acceptance Criteria
- Lighthouse/axe reports no “Form elements do not have labels” failures.
- Screen-reader users hear field context plus error state when validation fails.

### References
- WCAG 3.3.1, 3.3.3, 4.1.3
- https://m3.material.io/foundations/accessibility/overview

---

## Issue: Provide captions, transcripts, and media alternatives

### Context
Multimedia must include captions or transcripts to meet WCAG 1.2.x and Google’s accessibility recommendations.

### Tasks
- Add captions (VTT or equivalent) to instructional or onboarding videos.
- Include transcripts/summaries for AI feedback clips or training videos.
- Document a “media accessibility” checklist for new content.

### Acceptance Criteria
- Each embedded video offers captions or has a documented plan to deliver them.
- Audio-only content (if any) links to transcripts.

### References
- WCAG 1.2.2, 1.2.3
- https://support.google.com/youtube/answer/2734796

---

## Issue: Introduce skip links, landmarks, and heading hierarchy

### Context
Pages without skip links, landmarks, and logical headings fail WCAG 1.3.1/2.4.x and Lighthouse “Document doesn’t have a skip link.”

### Tasks
- Add a “Skip to main content” link at the top of the layout, visible on focus.
- Ensure each page uses semantic landmarks (`<header>`, `<nav>`, `<main>`, `<footer>`) or `role` equivalents.
- Review heading levels to avoid jumps (e.g., `h1` → `h3` without `h2`).

### Acceptance Criteria
- Accessibility pane in dev tools lists all landmarks.
- Screen-reader rotor/headings navigation reveals logical hierarchy.

### References
- WCAG 1.3.1, 2.4.1, 2.4.6
- https://developer.chrome.com/docs/lighthouse/accessibility/skip-links
