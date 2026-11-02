## What and why
<!-- What does this change, and why is it needed? Link the issue/ticket. -->

## How it was tested
<!-- Steps you ran, pages you checked, accounts/roles you used. -->

## Checklist
- [ ] CI is green (type-check, build, audit, secret scan)
- [ ] Tested locally against the real Hospital API
- [ ] No patient data, keys or `.env` values in the diff, screenshots or logs
- [ ] Access rules respected: new data routes go through `forwardToBackend` (scoped + audited)
- [ ] No invented clinical figures; demo data is labelled with `DemoDataBanner`
- [ ] New environment variables are listed here and added in Vercel (Production + Preview)

## Screenshots (UI changes)
