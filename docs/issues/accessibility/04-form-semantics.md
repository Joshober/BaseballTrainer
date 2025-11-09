# Improve Form Semantics & Error Messaging

## Context
Forms must expose labels, helper text, and validation feedback programmatically (WCAG 3.3.x). Some login, profile, and mission forms may lack proper label associations or accessible error handling, leading to Lighthouse violations and usability gaps for assistive tech users.

## Tasks
- Ensure login, profile, and mission-related forms use `<label for>` or `aria-labelledby` for every input and pair helper/error text via `aria-describedby`.
- Surface inline or toast errors with `role="alert"` (or equivalent live region) for asynchronous failures such as analysis errors.
- Review `app/login`, `app/auth/callback/page.tsx`, `components/ProfileForm`, and mission capture flows for consistent semantics.

## Acceptance Criteria
- Lighthouse/axe reports no “Form elements do not have labels” or related form accessibility failures.
- Screen-reader users hear field context plus validation/error messaging immediately after it appears.

## References
- WCAG 3.3.1, 3.3.3, 4.1.3
- https://m3.material.io/foundations/accessibility/overview

---

_To publish this issue on GitHub: copy everything from the title downward into a new issue and assign appropriate labels/milestones as needed._
