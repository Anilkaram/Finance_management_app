# Changelog

Notable changes to Paisa Book. Versions follow [semantic versioning](https://semver.org):
`MAJOR.MINOR.PATCH` in `versionName`, with `versionCode` incremented by one per release.

## [1.0.0] — 2026-09-01

First tagged release. Everything below was built before the repository existed, so it
arrives as one commit rather than as separate history.

### Spends
- Log expenses and income with category, source (cash, bank/UPI, or a specific credit
  card), date and note.
- Monthly total, per-day average, category breakdown, six-month trend.
- Separate category sets for money in and money out. Income types: Salary, Business &
  Freelance, Interest & Dividends, Refund & Cashback, Rent received, Gift, Other income.
- Month/year picker on the month label, showing each month's spend, so any month of any
  year is one tap away rather than a run of arrow presses.

### Credit cards
- Amount due, unbilled, and total outstanding tracked as three distinct figures.
- Amount due either entered from the statement (authoritative) or derived from the
  statement day and logged transactions. The card screen always states which.
- "Mark ₹X as paid" clears the bill in one tap; the card then shows as paid and stays that
  way — later spends add to unbilled without resurrecting the due amount.
- Interest and fees are entered exactly as the bank charged them; nothing is estimated.
- Card scanning: on-device OCR (CameraX + bundled ML Kit) fills in the last four digits,
  network and expiry. Requires a Luhn-valid read agreeing across two consecutive frames.
  **The full card number is never stored and never reaches the web layer.**

### Friends
- Per-person ledger across lent / borrowed / repaid-to-me / repaid-by-me, with a net
  balance and one-tap settle up.

### Bills & EMIs
- Recurring bills, subscriptions and loan EMIs with due days and payment sources.
- Marking a month paid records a real transaction and can be undone.
- EMIs track installments paid against the total and the amount remaining.

### Data
- Everything stored on-device. No account, no server, no analytics, no network requests.
- JSON export/import for backup, written to Documents and shareable.

[1.0.0]: https://github.com/Anilkaram/Finance_management_app/releases/tag/v1.0.0
