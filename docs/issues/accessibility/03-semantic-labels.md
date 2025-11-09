# Add Semantic Labels, Alt Text, and Accessible Names

## Context
Icons, imagery, and media controls must expose descriptive labels to assistive technologies (WCAG 1.1.1, 4.1.2). Lighthouse often flags missing `aria-label` or `alt` attributes, so we need to ensure all visual-only affordances are announced correctly by screen readers.

## Tasks
- Audit `components/Dashboard/VideoGallery`, `app/train`, and other dashboards to replace purely visual labels with `aria-label`, `aria-labelledby`, or visually hidden text.
- Provide meaningful `alt` text for hero/profile images; mark decorative imagery with empty `alt` attributes.
- Ensure custom video controls and icon-only buttons expose accessible names (e.g., `aria-label="Play video"`).

## Acceptance Criteria
- Lighthouse/axe shows no “Image elements do not have alt attributes” or ARIA validation warnings.
- Screen-reader smoke test (NVDA/VoiceOver) announces the purpose of each icon button and media control.

## References
- WCAG 1.1.1, 4.1.2
- https://developers.google.com/search/docs/appearance/images

---

_To publish this issue on GitHub: copy everything from the title downward into a new issue and assign appropriate labels/milestones as needed._
