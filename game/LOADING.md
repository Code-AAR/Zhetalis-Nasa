# Zhetalis loading screen

The loading overlay follows the logo reveal, wordmark and muted gold line of
[zhetalis.com](https://zhetalis.com/). The mark and wordmark are the site's own
Zhetalis assets, saved locally so startup does not depend on that website.

Implementation stays separate in `loading-screen.css` and `src/loading-screen.js`.
The existing engine still signals readiness by hiding `#loading`; the overlay
observes that signal and exits. It has no invented percentage or minimum wait.
Reduced motion shows a static mark and dismisses immediately. Slow startup and
uncaught errors have explanatory status text.

Open `loading-preview.html` to replay the intro without starting a mission.
The original loading text/style remain as the fallback if the new module fails.

Verified in a real browser with an intentionally delayed data response: the
brand layer shows during startup and disappears on readiness, both with normal
motion and reduced motion. The phone preview has no horizontal overflow.
