# Media Accessibility Resources

This document tracks caption and transcript coverage for the BaseballTrainer project. Update the table below whenever new media is added or accessibility assets change.

| Media Asset | Location / Route | Caption File | Transcript | Notes |
| --- | --- | --- | --- | --- |
| Demo swing analysis (sample) | `app/analyze` (demo sessions) | `public/captions/demo-analysis.vtt` (add existing file or placeholder) | `/docs/transcripts/demo-analysis.md` | Uploads are user provided. Provide instructions to coaches for supplying captions when sharing recordings. |
| Blast Off walkthrough (demo) | `app/blast-off` | Pending | Pending | Record short instructional clip; prepare captions before publishing. |
| Dashboard video cards (saved sessions) | `components/Dashboard/VideoGallery.tsx` | Coach/player provided | Coach/player provided | Each session owner is responsible for uploading caption file and transcript via admin tools (coming soon). |

## Implementation Checklist

- [ ] For every published video, ensure a WebVTT caption file lives in `public/captions/` and is referenced by the frontend.
- [ ] Store plain-text transcripts in `/docs/transcripts/` or an accessible CMS. Link them from the UI when available.
- [ ] Document any known gaps above and assign ownership for closing them.

## Future Work

1. Build tooling to upload caption files alongside videos.
2. Automate transcript generation for new swing uploads and store results in a searchable location.
3. Add dynamic UI badges when captions/transcripts are available to students.
