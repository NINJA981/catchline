Subset (Latin-1, general punctuation, dagger, double dagger, bullet, arrows, minus, euro) of the
Fontsource files bundled by the extension, OFL-1.1 (see the LICENSE files here). Rebuild with:

  pyftsubset <source>.woff2 --unicodes="U+0020-007E,U+00A0-00FF,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2020,U+2021,U+2022,U+2026,U+2212,U+00D7,U+20AC,U+2190-2193" --flavor=woff2 --layout-features="kern,tnum,ccmp,locl,mark,mkmk,case,zero" --output-file=<name>.woff2

Sources: @fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2 and
@fontsource/commit-mono/files/commit-mono-latin-400-normal.woff2 (both 5.3.0).
