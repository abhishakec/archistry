# Security policy

Archistry runs locally: it reads your specs and writes files on your machine,
and its HTML output makes no network requests. The areas that matter most are
the HTML viewer (what it does with a diagram file it is given), the converters
that read `.drawio` and `.html` files, and the generators that read your SFDX or
CSV files.

## Reporting a vulnerability

Please report privately, not in a public issue: use
[GitHub private vulnerability reporting](https://github.com/abhishakec/archistry/security/advisories/new).
Include what you found, how to reproduce it and the impact. You will get a reply
as soon as possible, and a fix or a clear answer before anything is made public.

## Supported versions

Fixes go into the latest release. Please update first with
`npx skills add abhishakec/archistry` or `git pull`.
