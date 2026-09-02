# Changelog

Notable changes to Paisa Book. Versions follow [semantic versioning](https://semver.org):
`MAJOR.MINOR.PATCH` in `versionName`, with `versionCode` incremented by one per release.

## [1.2.0] — 2026-09-02

### Added
- **Gym & Fitness** category, available for spends, bills and EMIs.

### Changed
- **Statement date, payment due date and bill due date are now calendar pickers** instead of
  a number to type. Pick any date and the app takes the day from it — these repeat monthly,
  so the day is what is stored. Each field says what it means underneath, e.g. "Repeats on
  the 8th of every month", and a date after the 28th adds "shorter months use their last
  day". Reopening a card prefills the picker with the next occurrence rather than a stale
  date.
- Categories added in future versions are backfilled into existing saves automatically, and
  slotted in before "Other" so it stays at the end of the list.

## [1.1.0] — 2026-09-02

### Added
- **Card details on the card screen.** Each card can now store its full number and CVV
  alongside the expiry, for looking up when paying online.
  - Shown masked (`•••• •••• •••• 1111`) with a **Reveal** button, and re-hidden
    automatically after 30 seconds so nothing is left on screen.
  - **Copy number** puts the digits on the clipboard.
  - The number is formatted as you type (4-6-5 for Amex, fours otherwise), the last 4 and
    the network are derived from it, and a failing Luhn checksum is flagged as a likely
    typo without blocking the save.
  - Both fields are optional — fill in only the last 4 by hand and nothing else is stored.
- Exporting a backup now warns, naming the cards involved, when the file would contain full
  numbers or CVVs. The backup is plain unencrypted JSON.

### Changed
- The card scanner now returns the full number it read, so scanning fills the whole field
  rather than just the last four digits. It is still validated by Luhn across two
  consecutive frames before being accepted.

### Security note
Card details are stored unencrypted in the app's local storage, and the app has no passcode
of its own — it inherits the phone's lock screen. Anyone holding the unlocked phone can
reveal them. Storing a CVV in particular means the phone holds everything needed for an
online payment.

## [1.0.1] — 2026-09-01

### Fixed
- **A card bill paid on the same day as its statement stayed due.** Payments were only
  counted against the amount due if dated *strictly after* the statement date, so entering a
  statement and clearing it the same day left the bill showing as owed and kept the
  "Mark as paid" button on screen. Payments dated on or after the statement date now count
  against it; payments before it are already inside the bank's total and are left alone.
  The same rule now applies to the derived cycle.
- A statement entry dated in the future was being added to the derived balance as though it
  were a charge.
- Marking a bill paid re-reads the amount due at the moment of the tap and disables the
  button while it works, so a double tap cannot record two payments.
- Card expiry typed without a separator ("1232") stayed unparseable and could never be
  flagged as expired. Input is now normalised to MM/YY as you type, and values already
  stored are repaired on load.

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

[1.2.0]: https://github.com/Anilkaram/Finance_management_app/releases/tag/v1.2.0
[1.1.0]: https://github.com/Anilkaram/Finance_management_app/releases/tag/v1.1.0
[1.0.1]: https://github.com/Anilkaram/Finance_management_app/releases/tag/v1.0.1
[1.0.0]: https://github.com/Anilkaram/Finance_management_app/releases/tag/v1.0.0
