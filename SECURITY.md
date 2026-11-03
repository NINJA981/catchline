# Security policy

## Supported versions

Only the latest release receives fixes. Catchline is at 0.1.x.

## Reporting a vulnerability

Please report privately through GitHub: on the repository page, open **Security**, then
**Report a vulnerability** (private vulnerability reporting). Do not open a public issue for a
security problem.

Include what an attacker can do, the browser and version, and the smallest page or steps that show
it. A fictional page is fine; do not send copies of third-party sites.

You should get a first reply within 7 days. When a fix ships, the release notes credit you unless
you ask otherwise.

## What counts

Catchline runs a content script on every page and injects an overlay on request, so the interesting
cases are:

- a web page that can read, change or trigger Catchline's UI or storage (the overlay lives in a
  Shadow DOM root; messages from content scripts are validated in `src/entrypoints/background.ts`);
- a page that can learn the user has Catchline installed beyond what any extension with
  `web_accessible_resources` reveals;
- any network request made by the extension or the web app (there should be none);
- script injection through footnote or claim text (the overlay renders text, never HTML).

Matching mistakes (the wrong footnote, a missing chip) are bugs, not vulnerabilities; please open a
normal issue for those.
