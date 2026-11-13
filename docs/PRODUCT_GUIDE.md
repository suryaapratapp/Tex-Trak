# Tex-Trak: the complete product guide

*Track · Trace · Prove. Developed by CIRCAI LTD.*

This guide explains the whole product in plain words: what it is, what each part does, how it works behind the scenes, what has been tested, and what is still to do. You do not need a technical background to read it.

---

## 1. What Tex-Trak is

Tex-Trak is one platform that answers three questions about physical things:

- **Where is it?** (tracking)
- **What happened to it?** (tracing)
- **Can we prove it?** (an audit trail nobody can quietly edit)

It does this by reading **QR codes, barcodes, RFID tags and GPS trackers**, and putting everything into one place that works on a computer, a phone (web) and an Android app.

It started for one client, **Synergy** (hospital curtains and linen), and has grown into a platform with several **modules**. Each client only gets the modules they need.

---

## 2. Who uses it

There are three kinds of account.

| Account | Who | What they can do |
|---|---|---|
| **Super Admin** | CIRCAI (you) | Sees every client. Creates clients, switches features on or off, adds sites, readers, trackers and vehicles, edits everything, can preview what a client sees. |
| **Client admin** | The client's manager | Sees only their own client. Creates and manages their own staff, and chooses what each person can do. |
| **Staff** | Fitters, warehouse operators, drivers | Sees only the screens the admin gave them. A staff member can never have more than their client has. |

Two safety rules apply everywhere:
- A client can never see another client's data.
- A feature that is switched off is blocked in the database itself, not just hidden on screen.

Sign-in is by username and password. The phone app also has a **quick PIN** and can sign in again without a connection.

---

## 3. The modules at a glance

| Module | In one line | Uses |
|---|---|---|
| **Curtains (QR)** | Label, install and take down hospital curtains and know when each is due for change | QR codes |
| **Laundry (RFID)** | Follow tagged linen through the laundry day | RFID readers |
| **Vehicles and devices** | See trackers and phones on a live map, with route history | GPS trackers, phones |
| **Shipments** | Any delivery or collection, from booking to receipt | Scans |
| **Warehouse** | Stock for any product: goods in and out, packing, counts, and smart insights | QR, barcode, RFID |
| **Scan station** | One place to scan anything in the field | Camera, scanners |
| **Home, Alerts, Device status** | What needs attention, and whether devices are alive | All of the above |
| **Administration** | Clients, people, sites, readers, trackers, vehicles | n/a |

Super Admin switches modules on per client, and can go further and choose individual screens per client and per person.

---

## 4. Curtains (QR), for Synergy

**The problem.** Hospital curtains must be changed on a schedule (the default is every 7 days). Paper records get lost. Nobody can prove a curtain was changed.

**How it works.**
1. **Labels.** Make a batch of QR labels (up to 50,000 at a time). Codes follow a pattern like `RZC-MVN191-AAA001` and are **never reused**. Print them on a sheet.
2. **Register.** Scan labels to say "this curtain exists". They show as *In stock*.
3. **Install.** Pick the hospital, floor, ward and bay, then scan the new curtain. The system starts a due-date clock.
4. **Take down.** Scan the old curtain and give a reason: expired, soiled or damaged. It can swap in a new one at the same time.
5. **Retire.** A curtain that is finished for good.

**Guards built in.** The system refuses an install if the bay already has a curtain, if the curtain is already installed, if it belongs to another client, or if the person lacks the permission.

**Screens.** Dashboard (in use, due soon, overdue), Products, Install, Take down, Register labels, Labels (print), Locations (hospitals, floors, wards, bays, with CSV import), Reports with history.

**Scan log.** Every scan shows as *Saved*, *Waiting* or *Not saved*, so a fitter always knows.

**Works with no signal.** See section 12.

---

## 5. Laundry (RFID)

**The problem.** Reusable linen goes out, gets used, comes back, and is washed. Without tracking, items go missing and nobody knows where.

**How it works.**
- **Sites, zones and readers.** Super Admin describes a site (for example a laundry), its zones (dirty side, clean side, loading bay) and the RFID readers at each.
- **Readers send reads to Tex-Trak.** Each reader has its own web address and key. The system understands many reader formats (Impinj-style, Zebra, plain text lists, and more) and many time formats.
- **State by zone.** When a tag is read in a zone, its state updates automatically (for example *soiled*, *in dirty cage*, *processing*, *clean*, *in transit*, *missing*). Finishing a wash adds one to its wash count.
- **Unknown tags** are logged once, so you can see what was read but not registered.
- **Missing items.** An item marked missing that is read again is marked found.

**Screens.** Inventory (live items, add, CSV import, barcodes), Facilities and floors, Laundry arrivals (planning), plus a journey page for each item.

**Honest status.** The reader address was tested end to end on the live system with test data. A real reader on site has not been connected yet, and your own scanner's exact message format still needs one sample sent to confirm.

---

## 6. Vehicles, trackers and phones

### 6.1 Teltonika TAT240 trackers

**The path of the data**
```
TAT240 (SIM, mobile network)  →  Gateway on Fly.io (London)  →  Tex-Trak database  →  Live map
```
- The tracker speaks Teltonika's own binary language over the mobile network. The **gateway** understands it (Codec 8 and Codec 8 Extended), checks it is not corrupted, tells the tracker "got it" so it can clear its memory, and passes the positions on.
- Only trackers whose **IMEI** (the device's 15-digit ID) is registered and switched on are accepted.
- The tracker reports every **6 minutes** to save battery.

**What was fixed along the way.** A switched-off IMEI was refused (it is now on). A reading of position 0,0 turned out to be "no GPS fix yet", not a bug, so maps now ignore those and show "waiting for GPS". Duplicate readings are stored once. A wrong device clock is replaced by the receive time. The tracker's battery value is no longer wiped by a reading that has none.

**Proven.** Your real tracker (IMEI ending 5066) produced a valid fix and battery reading through the whole chain.

### 6.2 Phones and browsers as trackers
A signed-in phone (Android app) reports its location in the background and appears as a named tracker. A browser tab can also report while the page is open. Phones save positions when offline and send them later.

### 6.3 Live map and route history
- The map shows every tracker and phone with name, last seen and battery.
- **Click a device and choose a day.** You see its route for that day with a start and end marker, plus distance, time moving, first and last point and top speed. Pick any of the last **30 days**, step day by day, or download a CSV.

### 6.4 The 30-day rule
- **For 30 days:** full detail is kept (speed, satellites, signal, battery and so on).
- **After 30 days:** only time and coordinates are kept, and readings that never had a GPS fix are removed.
- This runs by itself every night.

### 6.5 Device status page (Super Admin)
One list of every tracker, phone and RFID reader with a simple state:

| State | Meaning |
|---|---|
| Online | Heard recently (tracker within 15 minutes, phone within 10, reader within 15) |
| Quiet | A reader that has seen no tags for a while but is not gone |
| Offline | Not heard for too long (a reader: over a day) |
| Never seen | Registered, but has never reported |

Each row shows last heard, GPS state, battery and signal, with a **Route** button.

### 6.6 Vehicles
Super Admin keeps a real vehicle table (registration, driver, role, which tracker is fitted, which client). It can be edited, switched out of service, or deleted, and the system stops one tracker being fitted to two vehicles.

---

## 7. Shipments
Any delivery or collection: **book, dispatch, update, receive, report a problem, resolve.** Steps out of order are refused. Other clients are blocked. Scanning can dispatch or receive. A shipment in *exception* shows up in Alerts.

---

## 8. Warehouse: stock for any product

A general stock system, separate from Synergy's curtains. It follows the same idea as your IQMS project: stock is tracked **per shelf**, and every movement is recorded.

### 8.1 Set-up
1. **Locations**: warehouses, zones, shelves, bins, docks. Each has a short code and an optional capacity. Import from CSV.
2. **Items**: SKU, name, barcode, category, unit, cost, reorder level, usual order size, supplier lead time, and whether it has an expiry date. Extra codes (case barcodes, RFID tags) can point to the same item. Import from CSV, and import opening stock.
3. **Labels**: print QR labels for shelves and items (three sizes).

### 8.2 Daily work
| Screen | What it does |
|---|---|
| **Smart scan** | Scan anything. An item shows stock by shelf, lot and expiry, with advice. A shelf shows its contents. An order slip opens the order. Unknown codes offer to add them. |
| **Goods in** | Scan items, pick the shelf, lot, expiry and condition (good, hold, to repair, beyond repair). Suggests where to put things. New items can be added on the spot. |
| **Goods out** | Sale, production, sample, disposal or return to supplier. |
| **Pack order** | Pick items for a customer. Stock leaves the shelf and is held against the order. |
| **Orders** | Packing slip (with QR), dispatch, unpack. |
| **Unpack** | Take items back out. Each goes back to its original shelf, or on hold, or to repair. Dispatched orders cannot be unpacked. |
| **Move** | Shelf to shelf, keeping lot and expiry. |
| **Damage and repair** | Damaged (repairable or not), hold and release, repaired, write off, correct a quantity. Write-offs and corrections need a reason. |
| **Cycle count** | Count a shelf and correct differences. Suggests which shelf to count next. |
| **Ledger** | Every movement with who and when. Cannot be edited. Export to CSV. |

### 8.3 The intelligent parts
- **Soonest-expiry-first picking** is automatic. Expired, held and damaged stock is never picked.
- **Smart scan advice**: low stock, a lot about to expire, stock on hold, and the best place to pick from.
- **Insights**, in plain words with the reason for each point:
  - *Today's focus*: a short ranked to-do list.
  - *Suggested reorders*: from how fast each item is used, how long the supplier takes, and what is on the shelf.
  - *Expiry watch* and the value at risk.
  - *What moves and what sits*: items graded A, B, C by value leaving, and items not used for 90 days.
  - *Space*: shelves that are nearly full or over capacity.
  - *Accuracy*: shelves where counts keep disagreeing, and unusually large adjustments.
  - *Housekeeping*: stock stuck in repair or quarantine, packed orders waiting over 3 days, suggested counts.
- **Understands codes**: our own QR labels (starting `WH:`), barcodes with or without leading zeros, and any extra code attached to an item. An RFID handheld that types into a box works like a keyboard scanner.

### 8.4 Safety
- Stock can only change through checked database functions, never by editing tables directly.
- Saving the same screen twice cannot double-count.
- The ledger cannot be edited or deleted.

### 8.5 Offline
See section 12.

---

## 9. Scan station, Home, Alerts

- **Scan station** is a single place to scan anything in the field (camera, Bluetooth or USB scanner).
- **Home** and **Alerts** show real, live problems. Alerts come from: a tracker offline or never reporting, a tracker with no GPS fix for over an hour, a reader silent for a day (Super Admin), open alert rows (such as a tracker entering a restricted site), shipments in exception, items marked missing, and unknown tag reads in the last 24 hours.
- **Geofences.** If a tracker enters a restricted site (port, incinerator, landfill), a critical alert is raised, at most once every 6 hours per tracker and site.

---

## 10. Administration (Super Admin)

- **Clients**: create, edit details, switch features on or off, switch a client off.
- **Team**: client admins create and edit their own staff, with presets (for example *Fitter*, *Supervisor*, *Warehouse operator*, *View only*), reset passwords and switch people off.
- **Sites, zones, readers, trackers, vehicles**: every list has add, edit and delete, and **Add** and **Close** buttons look clearly different.
- **Preview as a client**: see exactly what their users see.
- **Help and training**: the training guide is built into the app.

---

## 11. Live data and Demo data

The two are completely separate.
- **Live data** is your real information. Only Super Admin can switch; clients are always on Live.
- **Demo data** is a built-in example day, clearly labelled with an amber "Demo data" badge.
- In Live mode the pages that exist only as examples are hidden: **Intelligence, Daily flow, Community assets, Recycling proof and Impact.** Connecting them to live data is future work.

---

## 12. Working with no signal

| Module | Offline |
|---|---|
| **Curtains** | Install, take down, register and retire are saved on the phone, checked locally, and sent later. Replaying a saved scan applies once. |
| **Warehouse** | Goods in, Goods out, Pack order, Move, Damage and repair, and Cycle count work offline. The screen shows the result straight away and a banner lists what is waiting. If the server refuses one, you can try again or discard it. |
| **Phones as trackers** | Positions are saved and sent later. |
| **Sign-in** | A phone that signed in before can sign in again offline. |

Needs a connection: Warehouse orders, ledger, unpack, dispatch, imports and edits; creating accounts; generating labels.

**One rule:** the device must connect once first, so it can download the lists it will need.

---

## 13. How it works behind the scenes (simple version)

```
Web app + Android app  ──►  Supabase (database, sign-in, rules, small server functions)
                                    ▲
RFID readers ───────────────────────┤  (reader address + key)
GPS trackers ──► Gateway (Fly.io) ──┘  (shared secret)
```

- **Front end:** React with Tailwind. The Android app is the same app wrapped with Capacitor (currently version 1.3).
- **Database:** Postgres on Supabase with **row-level security**. The rules live in the database, so even a buggy screen cannot show someone else's data.
- **Small server functions:** account administration, RFID intake, tracker intake.
- **Gateway:** a small program in London that speaks the tracker's language and forwards positions over a secure link.
- **Nightly job:** keeps tracker history tidy (section 6.4).
- **Duplicates:** every position has a unique device-and-time, and every saved action carries a unique id, so retries are harmless.

---

## 14. Security in plain words

- Everyone signs in. Staff only see what an admin gave them.
- Clients cannot see each other's data, enforced in the database.
- Reader keys are visible only to Super Admin.
- Tracker and reader intake are protected by secrets.
- The security checker reports no real gaps. Two items remain on your list: turn on **leaked-password protection** and enable **daily backups** in Supabase.

---

## 15. What has been tested, and what has not

**Checked directly**
- Database rules for roles, clients and features.
- Curtain flows, shipments, retention job, de-duplication.
- RFID intake on the live system (with test data, since removed).
- Warehouse flows in a rolled-back test: expiry-first picking, refusals, retries, counts, insights.
- Every warehouse screen in a browser with sample data, including phone width.
- The offline logic for the warehouse in a browser.
- The tracker path with your real TAT240.
- The type checker and build pass.

**Not yet checked (needs a person or device)**
- Most new screens with your real data and sign-in (Device status, editing, route history, Live vs Demo).
- Camera scanning, hardware scanners, RFID handhelds, label and slip printing.
- The Android app on a real phone, especially background tracking and offline.
- A real RFID reader on site.
- The map menu fix on a real phone.

---

## 16. Things you still need to do

1. Redeploy the gateway: `cd gateway && fly deploy`.
2. Assign your tracker to a client in Super Admin, and add its vehicle.
3. Turn on leaked-password protection and daily backups in Supabase.
4. Switch the **Warehouse** module on for a client (Super Admin, Clients).
5. Run the acceptance test in `docs/FEATURE_PLAN.md` on real equipment.

---

## 17. Known limits and what comes next

**Limits today**
- Android may close background tracking; it resumes when the app is opened.
- Tracker low-battery alerts are not built, because the voltage levels for the TAT240 are not confirmed.
- Reader support is HTTP only; readers that speak only MQTT or raw TCP need a small bridge.
- Client colour cannot be edited yet.
- Only Codec 8 and 8 Extended are decoded; there is no UDP gateway.

**Good next steps**
- Connect the demo-only pages (Intelligence, Daily flow, Community assets, Recycling proof, Impact) to live data.
- Warehouse: purchase orders and expected deliveries, serial numbers, multi-order picking waves, offline unpack and dispatch.
- Tracker battery and low-signal alerts once thresholds are confirmed.
- Code-splitting to make the app load faster.

---

## 18. Glossary

| Word | Meaning |
|---|---|
| **QR code / barcode** | A printed pattern a camera or scanner reads |
| **RFID** | A tag read by radio, with no line of sight needed |
| **GNSS / GPS** | Satellite positioning |
| **IMEI** | A tracker's 15-digit ID |
| **SKU** | Your own code for an item |
| **Lot** | A batch of an item, often with one expiry date |
| **FEFO** | First-expiry-first-out: use the soonest expiry first |
| **Cycle count** | Counting one shelf to check the system is right |
| **Ledger** | The permanent list of every movement |
| **Gateway** | The small program that turns tracker data into something the database accepts |
| **RLS** | Row-level security: database rules that decide who sees which rows |

*Support: surya@circai.co.uk*
