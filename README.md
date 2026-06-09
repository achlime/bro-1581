# [BRO] Brotherhood — Kingshot Server #1581

The Brotherhood alliance site for Kingshot. Currently soft-launched with the
**Bear Trap Battle Guide** as the landing page; the rest of the site is in progress.

## Live site
Once GitHub Pages is enabled, the guide is served at the repository's Pages URL
(the root `index.html`).

## Structure
| File | Purpose |
|------|---------|
| `index.html` | **Bear Trap guide** (the live landing page) |
| `home.html` | Alliance home page — *work in progress* |
| `guides.html` | Guides hub — *work in progress* |
| `recruitment.html` | Recruitment / Join Us — *work in progress* |
| `style.css` | Shared design system |
| `app.js` | Nav, i18n, Bear Trap countdown, scroll-spy, application helper |
| `img/` | Hero art, widget/skill icons, tier list |

## Notes
- On the guide page, the top nav links, language switcher and Apply button are
  commented out for the soft launch — search `TODO: re-enable` to restore them.
- Bear Trap schedule (every second day, UTC 08:00 & 13:00) is anchored in
  `app.js` via `ANCHOR_DAY` — shift by one day if the cadence is ever off.

Built for the Brotherhood, for the Brotherhood. Not affiliated with the
developers of Kingshot.
