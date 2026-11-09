# Tex-Trak: Training Guide

Tex-Trak tracks products through their life: where they are, what state they are in, and whether they reached the right place. This guide tells each kind of user what to do so everything works properly.

Support: **surya@circai.co.uk**

---

## 1. Who does what

| Role | Who | What they do |
|---|---|---|
| **Super Admin** | Tex-Trak administrator (CIRCAI) | Sets up clients, sites, zones, RFID readers and trackers. Creates the first account for each client. |
| **Client admin** | A manager at the client (for example Synergy) | Creates accounts for their own staff and chooses what each person can do. Manages labels, locations and reports. |
| **Staff** | Fitters, drivers, ward and plant staff | Scan and record work. They only see the features they were given. |

A client admin can never give someone more than the client itself has. If a feature is removed from a client, its staff lose it too.

---

## 2. Set-up checklist (Super Admin)

Do these in order. Each step needs the one before it.

1. **Sign in.** First time only: on the sign-in page choose *First time? Set up the Super Admin* and use the setup token. After that, sign in with your username and password.
2. **Create the client.** Super Admin → Clients → *New client*. Choose what the client can use (curtains, laundry, equipment, shipments, recycling) and give them an administrator (name, username, password). Copy the password now: it is shown once.
3. **Give the client admin their details.** They sign in and open **Team** to create their own staff.
4. **Add sites** (Super Admin → Sites): hospitals, decon plants, recyclers, ports. Use *Find on map* to fill in coordinates from an address or postcode. Choose which client owns the site, or leave it *Shared*.
5. **Add zones** (Super Admin → RFID readers → Zones): the rooms of a site, for example *Goods-in dock*, *Clean store*, *Ward 3*, *Dirty utility*. Pick what happens there (see section 6).
6. **Add RFID readers** (same page): code, where it is, and the zone it watches.
7. **Connect each reader** (section 6).
8. **Import the item list** (Inventory → Import CSV). Readers can only move items that are on the list.
9. **Register trackers** (Super Admin → Trackers) for vehicles (section 7).
10. **Curtains (Synergy):** import locations and generate labels (section 4).
11. **Switch the top bar to Live data.** *Demo data* shows a built-in example day for demonstrations only.

---

## 3. Everyone: signing in and the Android app

**Web:** open the Tex-Trak address and sign in. Use *Show* to check your password as you type.

**Android app:**
1. Copy `Tex-Trak-Synergy.apk` to the phone and open it. Allow *install unknown apps* when asked.
2. Sign in. The first sign-in needs internet.
3. Allow **location** when asked. Choose *While using the app* or *Allow*.
4. Set a **quick PIN** (4 to 6 digits). It opens the app quickly, even with no signal.
5. In Android settings, set Tex-Trak battery use to **Unrestricted**, so tracking keeps working with the screen off.

**What you will see:** a strip at the top says *You are offline* or *Sending N scans*. Tap it to see every scan.

If you forget your PIN, choose *Forgot your PIN? Sign in again*. You need internet for that.

---

## 4. Curtains (QR) for Synergy

### Before the first job (client admin)
1. **Locations.** Curtains → Locations → *Choose CSV file*. Columns: `Hospital, Code, Floor, Ward, Bay` (a template is provided). Re-importing is safe: only new rows are added.
2. **Generate labels.** Curtains → Register labels → *Generate QR codes*.
   - Product code and name, how many (up to 50,000).
   - Check the code format (prefix, letters, digits). Press *Save format* if you changed it.
   - Choose **Yes, register them** so fitters can use the labels straight away.
   - Print a sheet (28 × 34 mm labels) or download the CSV for a label printer. Printing is done from a computer.
3. **Change-due time.** In *Register labels* or in the generator, set *Change due after (days)*. The default is 7.

### Fitters: installing a new curtain
1. Curtains → **Install**.
2. Choose hospital, floor, ward and bay.
3. Scan the new curtain's label. You hear a beep and see the result.

### Fitters: swapping an old curtain
1. Curtains → **Take down**. Method *By scan*.
2. Choose the reason (*Expired*, *Soiled*, *Damaged*). Add a note if useful.
3. Scan the **old** curtain. It is recorded as taken down.
4. The screen asks for the replacement. Scan the **new** curtain. It goes in the same place automatically.

Use *Method: By location* to take down several at once: choose a place, tick what is coming down, then scan each replacement.

### Messages you may see
| Message | What to do |
|---|---|
| *is not registered* | The label has not been registered. Ask your admin to register it. |
| *is already installed at…* | Someone already fitted it. Check the code. |
| *already has … Take it down first* | That bay has a curtain. Use Take down to swap it. |
| *was taken down. Register it again* | It came down earlier. Register it again once it is back in stock. |
| *saved on this phone* | You are offline. It will send automatically. |

### Checking the work (client admin)
- **Dashboard:** what is installed, overdue and due soon.
- **Products:** search and filter by code, status or hospital. Click a code to see its history.
- **Reports:** installations and take-downs by period, with CSV export.

---

## 5. Working with no signal

The Android app works offline for Install, Take down and Register.

- The phone checks each scan against the list it last downloaded, shows the result at once and saves it.
- It sends saved scans when the signal returns, every 20 seconds and when you reopen the app. Nothing is counted twice, and the history keeps the real time.
- If the server refuses a scan later (for example the curtain was installed elsewhere meanwhile), the strip turns red. Tap it to see why, then *Try again* or *Remove*.
- **Download the list while you have signal.** Open Install once at the start of the day so the phone has the latest curtains and locations.
- **Before signing out,** check nothing is waiting to send.

Needs a connection: generating labels, importing locations, creating accounts, and changing settings.

---

## 6. RFID: tracking linen and other tagged items

### How it works
Every tagged item has a unique RFID tag (an *EPC*). A **reader** at a doorway reads tags that pass. The reader belongs to a **zone** (the room beyond the door). A read moves the item into that zone and updates its state, and is saved in the item's journey.

### What a zone's kind means
| Zone kind | An item read here becomes… |
|---|---|
| Dirty utility or cages | **In a dirty cage** |
| Washing or processing | **Processing** |
| Clean store | **In stock** (from processing, in transit or missing) |
| Ward or clinical area | **In use** (from in stock or clean) |
| Dock, outside, other | Location updates; state unchanged (a missing item is marked found) |

When washing finishes (processing to clean or in stock) the wash count goes up by one.

### Step 1: the item list
Inventory → **Import CSV** (or *Add item*). Columns:
`epc, qr, barcode, product, max_cycles, cycles, value`
Each item needs at least one of EPC, QR or barcode. A template can be downloaded on the page.

### Step 2: connect a reader
1. Super Admin → RFID readers. Add the reader (code, site, zone).
2. Press **Connect** on the reader. Copy the web address shown.
3. In the reader's own configuration page, set its **server / HTTP POST address** to that address.
4. Choose JSON, or the reader's default format. Tex-Trak understands most layouts (Impinj, Zebra, Chainway and similar), a plain list of tags, or text with one tag per line.
5. Test: present a known tag to the reader. Open **Facilities and floors**: the reader shows *Online* and the item moves.

Keep the address private. If it leaks, press **Replace the key** and update the reader.

No hardware yet? Use **Super Admin → RFID readers → Send a test read**.

### What to look for
- **Facilities and floors:** each zone with item counts, each reader's last read, and the latest reads.
- **Unknown tags:** tags read that are not on the item list. Add them to the list.
- **Missing items:** an item flagged missing that is read again is recorded as *found*.

### Handheld RFID and barcode scanners
Bluetooth or USB handhelds that type the code into the screen work in the **Scan station**: open it, scan, and the item is found by RFID tag, QR or barcode.

---

## 6a. Scan station (anyone with the Scan feature)

Scan station → **Any code**. Scan or type any code and Tex-Trak finds what it is:

| Code | What it shows | What you can do |
|---|---|---|
| Item (RFID tag, QR or barcode) | Product, state, washes | Issue to ward, mark soiled, load in cage, back in stock, report lost |
| Shipment (`SHP-1001`) | Route, items | Dispatch, or receive and count |
| Curtain | Status and place | Go to Install or Take down |
| Equipment (`SC-004`) | Holder, battery | Check out / return |

Camera scanning reads QR codes and common barcodes. *Tap-free* logs each code as soon as it is read.

Every scan is saved to a shared scan log.

---

## 7. Vehicle tracking with the Teltonika TAT240

### Register the tracker
Super Admin → Trackers → **Add**. Enter the 15-digit **IMEI** (printed on the device), a name such as *Van 3*, and the client it belongs to. A tracker can only send data once it is registered and switched on.

### Configure the device (Teltonika Configurator)
| Setting | Value |
|---|---|
| Server | `textrak-gateway.fly.dev` (or the address your administrator gives) |
| Port | `5027` |
| Protocol | TCP |
| Codec | Codec 8 Extended |
| Record interval | **360 seconds (6 minutes)** for moving and stationary |
| APN | From the SIM provider |

Use 360 seconds. Shorter intervals drain the battery quickly. Take the device outside with open sky: the first fix can take a few minutes.

### See it
Set the top bar to **Live data** and open **Live map**. Vehicles appear with their name, last seen, battery and trail.

### One-time gateway set-up (administrator)
The gateway receives raw TCP from trackers. It runs on Fly.io. Run once:
```
supabase secrets set INGEST_TOKEN=<long random string> --project-ref qhxdqgkpebmpzzuzqcla
cd gateway && fly secrets set INGEST_TOKEN=<the same string> && fly deploy
fly ips allocate-v4
```
Check with `fly status` and `fly logs`: it should say *listening on :5027*, then *login* with the device's IMEI.

---

## 8. Phones and browsers as trackers

When a user signs in on the **Android app** and allows location:
- The phone is recorded under **Super Admin → Trackers** as a *Phone*, **named after the username**.
- If someone else signs in on the same phone, it is renamed to that person.
- Movement shows on **Live map**, including when the screen is locked (a notification stays on screen while recording).
- Location is saved on the phone when there is no signal, and sent later.
- It stops when the user signs out.

On a **computer's web browser** the same works while the page is open, if the user allows it. Browsers cannot track in the background.

**Privacy:** people are told what is recorded the first time they sign in, and can see the status in *My account*. Only administrators of the same client see the movement.

---

## 9. Shipments

Shipments → My shipments:
1. **Book:** type, from, to, contents, number of items, carrier, planned times. It gets a reference such as `SHP-1001`.
2. **Dispatch:** confirm it is loaded and sealed (in the app or by scanning the reference).
3. **On the way:** add updates or report a delay.
4. **Receive:** enter how many items arrived. A different number is recorded as a problem; a problem can be marked resolved.

Every step is kept in the shipment's history. **Laundry arrivals** shows what is arriving, and what is on the shelves.

---

## 10. Reporting

- **Recycling proof:** shows whether a recycling load reached the recycler or went to a port or incinerator. *Print evidence* prints a one-page certificate.
- **Impact:** carbon and water savings from reuse.
- **Alerts and Intelligence:** problems that need attention and what to do first.

Demonstration pages are labelled **Demo data** until they are connected to live readers and trackers.

---

## 11. If something does not work

| Problem | Check |
|---|---|
| Cannot sign in | Username and password (use *Show*). A switched-off account must be switched on by an admin. Contact support. |
| Cannot create an account | A red message above the button says why: name, username (3 to 24 characters, no spaces), password (8+ characters), or what the person can do. |
| Scan says *not registered* | The label is not registered yet (curtains), or the tag is not on the item list (RFID). |
| Phone says *offline* | Scans are safe. Reconnect and they send. Tap the strip to see. |
| RFID item does not move | Is the reader added with a zone? Is it connected (address correct)? Is the tag on the item list? Look at *Latest reads* and *Unknown tags*. |
| Reader shows *Off* | It has not sent anything yet. Check its server address and its power or network. |
| Tracker not on the map | Is the IMEI registered and switched on? Is the gateway running (`fly logs`)? Wait for one 6-minute interval. |
| Phone not on the map | Did the user allow location? Is battery set to *Unrestricted*? Is the app signed in? See *My account* for the status. |
| A page says *Demo data* | Set the top bar to *Live data* (Super Admin), or the page is not connected to live data yet. |

For anything else: **surya@circai.co.uk**.
