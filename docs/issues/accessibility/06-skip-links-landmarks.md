# Introduce Skip Links, Landmarks, and Heading Hierarchy

## Context
Pages without skip links, semantic landmarks, and logical heading levels fail WCAG 1.3.1/2.4.x guidance and trigger Lighthouse warnings such as “Document doesn’t have a skip link.” We need consistent navigation aids for screen readers and keyboard users.

## Tasks
- Add a “Skip to main content” link at the top of the layout that becomes visible on focus.
- Ensure each page template uses semantic landmarks (`<header>`, `<nav>`, `<main>`, `<footer>`) or equivalent ARIA roles.
- Review heading levels across key views to avoid jumps (e.g., ensure `h1` → `h2` → `h3` order without skipping levels).

## Acceptance Criteria
- DevTools accessibility tree displays the expected landmarks for every page template.
- Screen-reader rotor/headings navigation reveals a logical, sequential hierarchy.
- Lighthouse/axe reports no missing skip-link or landmark issues.

## References
- WCAG 1.3.1, 2.4.1, 2.4.6
- https://developer.chrome.com/docs/lighthouse/accessibility/skip-links

---

_To publish this issue on GitHub: copy everything from the title downward into a new issue and assign appropriate labels/milestones as needed._
