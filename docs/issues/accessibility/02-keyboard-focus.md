# Guarantee Keyboard Navigation & Visible Focus States

## Context
Interactive elements must be usable via keyboard and expose visible focus indicators to comply with WCAG 2.1.1/2.4.7 and Lighthouse accessibility checks. Current modals, icon buttons, and navigation controls need review to ensure they are fully operable without a mouse.

## Tasks
- Ensure modals, dropdowns, and carousels (e.g., OpenRouter modal, video cards) trap focus appropriately and restore it to the triggering element when closed.
- Add consistent custom focus styles (`outline`, `outline-offset`, `focus-visible`) across buttons, links, navigation tabs, and pill filters.
- Verify keyboard-only users can reach and operate every control (Tab/Shift+Tab, arrow keys where appropriate) without becoming trapped.

## Acceptance Criteria
- Keyboard users can access every interactive element and escape modal dialogs using only the keyboard.
- Focus states remain visible (e.g., ≥3px outline or high-contrast indicator) for all actionable components in default, hover, and active states.
- Lighthouse/axe reports no keyboard navigation or focus visibility issues.

## References
- WCAG 2.1.1, 2.4.7
- https://developer.chrome.com/docs/devtools/accessibility/reference

---

_To publish this issue on GitHub: copy everything from the title downward into a new issue and assign appropriate labels/milestones as needed._
