# Tex-Trak: Feature plan and verification

What each feature does, what has been checked, and what still needs a real device or a person to confirm. "Checked" means a test was run and the result seen. Nothing here is marked done on assumption.

**Key**
- **Verified**: automated or direct test against the live system, with the result seen.
- **Built, needs device test**: code is complete and compiles, but only a real phone, reader or tracker can confirm it.
- **Needs your action**: a step only the owner can do (a secret, a hardware setting, a dashboard switch).

## A. Accounts and access

| Feature | Status | How it was checked |
|---|---|---|
| Sign-in with username and password, show password | Verified (UI) | Browser |
| Super Admin, client admin, staff levels; staff can never exceed the client | Verified (database) | Rolled-back tests: roles, cross-client blocking, staff limits |
| Create client, create staff, reset password, switch off | Built, needs your test | Form and server rules reviewed; validation messages now shown next to the button. Please create one account of each kind |
| Features switched on or off per client and per person | Verified (database) | Tests for access checks in every table's rules |
| Offline sign-in and quick PIN (phone) | Built, needs device test | Logic compiled; PIN hashing and lock screen not run on a phone |

## B. Curtains (QR), Synergy

| Feature | Status | How it was checked |
|---|---|---|
| Locations, hospitals, CSV import and export | Verified (database), UI built | 49 bays loaded; import function tested |
| Generate label codes, never reused, up to 50,000 | Verified (database) | 1,000 generated and registered; numbering carries on |
| Register, install, take down, swap, retire | Verified (database) | Bay clash, already-installed, wrong client, staff without the feature all refused correctly |
| Same data on web and phone | Verified (design and database) | One shared database; both apps call the same functions |
| Offline queue, local checks, send later, no doubles | Verified (logic in browser), needs device test | Offline simulation: results, queue persistence, safe retry. Replaying a saved scan applies once (database) |
| Scan log with Saved / Waiting / Not saved | Built, needs device test | |
| Camera scanning (QR and barcodes) | Built, needs device test | Camera cannot run in the test environment |
| Hardware scanners that type codes | Built, needs device test | Works when a scan box is on screen, or anywhere on the page |
| Print label sheet | Built, needs your test | Print preview not seen |

## C. RFID (linen and tagged items)

| Feature | Status | How it was checked |
|---|---|---|
| Sites, zones and readers added by Super Admin | Verified (database) | Permissions: only Super Admin writes; clients read their own |
| Item list: add, CSV import, barcodes | Built, needs your test | Database rules verified; screens compiled |
| Reader endpoint: per-reader address and key, platform token, Super Admin | **Verified end to end on the live system** | Sent reads to the live endpoint: Impinj-style JSON, plain text, repeated read ignored, unknown tag logged once, wrong key refused, heartbeat accepted. Item moved to the right zone and state; a missing item was marked found. Test data then removed |
| Understands many reader formats | Verified | 9 parser tests: own format, Impinj, Zebra, string lists, text lines, seconds / milliseconds / microseconds, junk, short tags |
| State rules by zone kind, wash count on finishing a wash | Verified | Parser tests; database test for wash count |
| Live Inventory, Facilities and Laundry arrivals | Built, needs your test | Compiled; rendered with no data |
| Your own scanner's exact format | **Needs your action** | The repository you shared (`rfid-tracking`) is an empty Next.js starter with no scanner code, so the exact format could not be taken from it. Point your scanner's config page at a reader's address and send one tag; if it does not register, send me the sample body |
| Hardware reader on site | Needs your action | Reader must be configured with its address |

## D. Vehicle tracking (Teltonika TAT240)

| Feature | Status | How it was checked |
|---|---|---|
| Codec 8 / 8 Extended decoding, acknowledgements, CRC | Verified | Gateway self-test and end-to-end test against a mock server |
| Only registered, active IMEIs accepted | Verified (design) | Test refuses an unknown IMEI at the gateway; server also checks |
| Gateway hosted on Fly.io | **Needs your action** | App `textrak-gateway` created; needs the shared secret set and `fly deploy` |
| Positions stored and shown on Live map | Built, needs device test | Phone positions verified in the database; real tracker not seen |
| Real device configuration (server, port 5027, TCP, 360 s) | Needs your action | See the training guide |

## E. Phones and browsers as trackers

| Feature | Status | How it was checked |
|---|---|---|
| Device named after the signed-in user; renamed for the next user | Verified (database) | Register and rename tested; another user cannot report for it |
| Positions saved, de-duplicated, trimmed after 90 days | Verified (database) | |
| Background tracking with screen off (Android) | Built, **needs device test** | Uses a foreground service and notification. Depends on the phone's battery settings |
| Saved on phone when offline, sent later | Built, needs device test | |
| Browser tracking while page is open | Built, needs your test | |
| Live map of phones and trackers | Built, needs your test | |

## F. Shipments

| Feature | Status | How it was checked |
|---|---|---|
| Book, dispatch, update, receive, problem, resolve | Verified (database) | Full flow; out-of-order steps refused; other clients blocked |
| Scan to dispatch or receive | Built, needs your test | |

## G. Reporting

| Feature | Status | How it was checked |
|---|---|---|
| Recycling proof certificate (print only the certificate) | Verified (UI) | Certificate renders outside the page; print preview not seen |
| Alerts, Intelligence, Impact, Daily flow, Community assets | Demonstration data | Not yet fed by live readers and trackers |

## H. Platform

| Feature | Status | How it was checked |
|---|---|---|
| Android app (signed, version 1.2+) | Built, needs device test | Package, permissions and signature checked; not installed on a phone |
| Security | Verified | Database advisor clean apart from expected warnings; public read access removed |
| Reader keys hidden from everyone except Super Admin | Verified | |
| Backups, uptime monitoring | **Needs your action** | Enable daily backups in Supabase; turn on leaked-password protection (Authentication → Password security) |

## I. Acceptance test (about one hour)

Do these in order on real equipment. Each should pass before you rely on that area.

1. Create a client, its admin, and one staff account. Sign in as each. Staff should only see their features.
2. Curtains: import locations, generate 20 labels, register them, install 3, take one down and swap it. Check the dashboard and history on the web.
3. Phone: install the app, sign in, allow location, set a PIN. Turn on airplane mode, install and take down, turn it off, check scans send and appear on the web.
4. Phone location: lock the phone and walk for 10 minutes. Check the trail on Live map and the device name under Trackers.
5. RFID: add a site, zones and a reader; import 5 items; connect the reader; read a tag; check the item moves and the state is right.
6. Tracker: register the TAT240, deploy the gateway, configure the device, take it outside, check the position appears within about 10 minutes.
7. Shipments: book, dispatch, receive with a different count, resolve.
8. Print a recycling proof certificate.

## J. Known limits

- Background tracking resumes when the app is next opened if Android closes it.
- No offline mode for generating labels, importing, or managing accounts.
- Demo pages are not yet connected to live data.
- Reader support is by network address (HTTP). Readers that only speak MQTT or raw TCP need a small bridge.
