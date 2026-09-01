# Paisa Book

> Managing all your credit card amounts, bills, EMIs and spends in one place, to get a
> clear picture of your finances.

An offline Android app for tracking personal money: daily spends, credit-card outstanding
and interest, money lent to and borrowed from friends, and recurring bills / EMIs.

Currency is **INR (₹)** with Indian digit grouping (`₹1,23,456`); dates are **DD/MM/YYYY**.

## What it does

**Spends** — log every expense or income with a category, a source (cash, bank/UPI or a
specific credit card), a date and a note. Monthly total, per-day average, category
breakdown, and a six-month trend.

Money in and money out have separate category sets. Switching the entry to **Received**
swaps the list to income types (Salary, Business & Freelance, Interest & Dividends, Refund
& Cashback, Rent received, Gift, Other income) and relabels the source field to
"Received in". Only expense categories appear in the spend breakdown and on bills.

**Credit cards** — one entry per card with limit, statement day and payment due day.

Three different numbers, kept apart the way the bank keeps them apart:

- **Amount due** — what was billed on the last statement and must be paid by the due date.
- **Unbilled** — spent since that statement. Real debt, but it rolls into the *next* bill.
- **Total outstanding** — everything owed right now, i.e. amount due + unbilled.

Paying ₹15,000 when the statement said ₹15,000 clears the bill even if you have since spent
another ₹6,000 — the app reflects that, and the card drops off "Coming up" once the due
amount is settled while still showing the unbilled balance.

There are two ways the amount due is arrived at, and the card screen always says which:

1. **You enter it** — "Enter statement amount due" on the card screen. Type the total from
   the bill and that figure is authoritative: it is what must be cleared by the due date,
   and payments recorded afterwards count against it. Entering a statement does **not** add
   to the outstanding; your logged spends already account for the debt. Anything charged
   after the statement date is counted as unbilled on top.
2. **Derived** — with no statement entered but a statement day set, the app works the cycle
   out from your logged transactions.

A payment made after the statement date reduces the amount due; a spend made after it adds
to unbilled and leaves the amount due alone. A card with neither a statement entry nor a
statement day has no cycle to divide on, so everything is treated as due.

An opening balance given when adding a card is dated to the last statement, since existing
debt is money already billed — dating it to today would park it all in "unbilled" and show
nothing due.

**Paying the bill** — when something is due, the card screen leads with
**"Mark ₹X as paid"**. One tap records a payment for exactly the amount due, dated today,
after a confirmation. The card then reads "Bill cleared", its tile shows a green **✓ Paid**
with nothing due, and it drops out of "Coming up" and the card-dues total. Spending on the
card afterwards adds to unbilled — it does not resurrect the amount due, which stays at zero
until the next statement.

Use "Record payment" instead when you paid a different amount, such as a part payment.

Each card also shows utilisation, days to due date, spends this month, **interest charged
this month**, and interest + fees all-time.

Interest is never estimated. You enter the exact finance charge the bank applied, from your
statement — "Add interest" on the card screen. Fees and late charges work the same way.

**Scan a card** — "Scan card with camera" on the add-card screen reads a physical card with
on-device OCR (CameraX + ML Kit's bundled Latin recogniser) and fills in the last four
digits, the network (Visa / Mastercard / RuPay / Amex / …) and the expiry.

The scanner accepts a number only once it passes the Luhn checksum and reads the same on two
consecutive frames, so a half-focused frame cannot produce a wrong number. Everything is
still editable by hand afterwards, and typing the fields in yourself works exactly as before.

**Friends** — a running ledger per person covering four cases: you lent, you borrowed,
they repaid you, you repaid them. Each person shows a net balance (they owe you / you owe
them) and a one-tap **Settle up**. The home screen totals what you have to collect and
what you have to pay back.

**Bills & EMIs** — rent, subscriptions, insurance, loan EMIs. Each has an amount, a due
day of the month and a payment source. "Mark paid" for a month records a real transaction
so the spend shows up in your monthly totals, and can be undone. EMIs additionally track
installments paid against the total (e.g. 7 of 24) and the amount remaining.

**Choosing a month** — the arrows either side of the month label step one month at a time.
Tapping the label itself opens a month/year picker: step through years, then tap any month.
Each month shows what you spent in it, so you can find the one you want without hunting.

**Home** — spend, income and net for the month; card dues, pending bills and friend
balances; everything falling due in the next 21 days, overdue items included, with the
earliest unpaid occurrence per bill.

## How the numbers relate

A few deliberate choices, so the totals don't double-count:

- A **credit-card spend** counts as a spend for the month it happened, on the card it was
  charged to. **Paying the card bill later is not a second spend** — it is a payment that
  reduces the outstanding.
- **Interest and fees** raise the card outstanding but are not monthly-category spends.
  They are reported separately, per month and all-time, on the card screen.
- **Amount due is not the same as outstanding.** Home and "Coming up" show the amount due,
  because that is the number with a deadline; the outstanding total sits beside it.
- **Lending money to a friend is not an expense** — it is an amount owed back to you, so it
  lives in the friend ledger and not in the monthly spend total. Same for borrowing.
- **Marking a bill paid** does create a transaction, because that money really left.

## Data and privacy

Everything is stored in the app's own local storage on the phone. There is no account, no
server, no analytics, and the app makes no network requests. Nothing leaves the device.

**The full card number is never stored, and never even reaches the app's web layer.** The
scanner activity holds it in native memory only long enough to run the Luhn check and work
out the network, then hands back the last four digits. No photo is taken, kept or uploaded —
frames are analysed in memory and discarded. The camera permission is requested the first
time you tap Scan, and the app works fully without granting it.

The flip side: uninstalling the app, or clearing its data, erases everything. Use
**Export backup** (bottom of the Home screen) to write a timestamped JSON file to
Documents and share it wherever you like. **Import** restores from that file, replacing
what is on the device.

## Building

Requires the Temurin JDK 17 toolchain — Android Studio's bundled JBR on this machine is
broken and JDK 22 is too new for the Gradle 8.2.1 wrapper that Capacitor 6 ships.

```bash
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-17.0.20.101-hotspot"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
npm install
npx cap sync android
cd android && ./gradlew.bat assembleDebug
```

The APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`.

`npm run deploy` installs it to a connected device (`gradlew installDebug`).

### Editing the app

The whole UI is plain HTML/CSS/JS in `www/` — no build step, no framework.

| File | Contents |
|---|---|
| `www/index.html` | shell: top bar, view container, tab bar, bottom sheet |
| `www/styles.css` | dark theme, all component styles |
| `www/app.js` | state, calculations, screen renderers, forms |

Native (Android only):

| File | Contents |
|---|---|
| `CardScannerPlugin.java` | Capacitor bridge + camera permission handling |
| `CardScanActivity.java` | CameraX preview, ML Kit analysis loop, frame confirmation |
| `CardTextParser.java` | Luhn check, network from BIN prefix, expiry extraction |

`CardTextParser` deliberately has no Android imports, so it can be compiled and exercised on
a plain JVM without a device or emulator.

To iterate without rebuilding the APK, serve `www/` and open it in a browser:

```bash
python -m http.server 5178 --directory www
```

After changing anything under `www/`, run `npx cap sync android` before rebuilding.

## Versioning and releases

Semantic versioning. Two numbers must move together for every release:

| Where | Field | Example |
|---|---|---|
| `android/app/build.gradle` | `versionName` | `1.1.0` |
| `android/app/build.gradle` | `versionCode` | `2` (must increase by 1, never repeat) |
| `package.json` | `version` | `1.1.0` |

Android refuses to install an APK whose `versionCode` is not higher than the installed one,
so bumping `versionName` alone will silently fail to update the app on the phone.

To cut a release:

```bash
npm run release -- 1.1.0
```

That bumps all three fields, then prints the remaining steps: update `CHANGELOG.md`, commit,
tag `v1.1.0`, push with `--follow-tags`, and attach the built APK to the GitHub Release.

APKs are **not** committed — the bundled ML Kit model makes each one ~20MB. They belong on
the [Releases page](https://github.com/Anilkaram/Finance_management_app/releases), where the
tag, changelog entry and downloadable APK sit together.

## Known limits

- Debug-signed APK. For a Play Store or long-lived install, generate a release keystore and
  run `assembleRelease`.
- The bundled ML Kit OCR model is what makes scanning work offline, and it accounts for
  almost all of the ~20MB APK (the app itself is under 4MB). `abiFilters` in
  `app/build.gradle` already drops the 32-bit x86 build; removing `x86_64` as well takes it
  to ~14MB but stops the app running in an emulator. Swapping to
  `com.google.android.gms:play-services-mlkit-text-recognition` would shrink it much further,
  at the cost of a one-time model download over the network.
- Scanning reads flat-printed and embossed cards well in decent light; a worn or heavily
  patterned card may need a hand-typed last 4.
- The launcher icon is an adaptive icon (Android 8.0+). On Android 7 and older the stock
  Capacitor icon still shows.
- No notifications — due dates surface when you open the app, not as reminders.
