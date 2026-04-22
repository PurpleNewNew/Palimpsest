# Linux Server Only Boundary

Palimpsest should be treated as a browser-first product that targets a Linux
server runtime.

## Intended Boundary

Supported product shape:

- browser client
- Linux server runtime
- multi-user workspace access

Not an intended product identity:

- desktop application line
- TUI runtime
- WSL-first developer product
- multi-platform local app packaging story

## Important Distinction

"Linux server first" does **not** mean users on other operating systems cannot
open the product in a browser.

It means:

- the supported runtime target is a Linux server
- the product should not keep carrying desktop/local-runtime identity as a
  first-class shape

## What Has Already Been Removed

Large obsolete systems such as TUI/ACP have already been pushed out of the main
product path.

That is the right direction and should not be reversed.

## Remaining Cleanup

The remaining gaps are mostly long-tail code and language:

- some `desktop` platform naming in the web app
- some desktop-oriented settings text
- some platform storage naming that still implies desktop privilege

These are not architecture blockers anymore, but they do still muddy the
product identity.

## Practical Rule

When there is a choice between:

- preserving old desktop/local-runtime phrasing
- simplifying around browser + Linux server

prefer the latter unless a concrete runtime requirement still exists.

## Success Condition

This boundary is complete when:

- the product no longer reads as if a desktop line still exists
- the remaining platform code is just browser integration, not product identity
- users understand Palimpsest as "open the web app against a Linux server"
