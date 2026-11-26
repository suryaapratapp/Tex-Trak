# Tex-Trak: User Guide

Welcome to Tex-Trak. It helps your team know where every product is, what state it is in, and whether it reached the right place. Everything is recorded with a time and the name of the person who did it, so you can always prove what happened.

**Track · Trace · Prove**

Support: **surya@circai.co.uk**

---

## 1. How Tex-Trak is organised

The menu on the left is split into modules. **You only see the modules your company uses**, and staff only see what their administrator gave them. If a module described here is missing from your menu, it has not been switched on for your company. Ask support if you would like it.

| Module | What it is for |
|---|---|
| **Home** | A summary of what is happening now. |
| **Live map** | Where your vehicles and people are, on a map. |
| **Scan station** | For field staff: scan any code and see what it is and what you can do with it. Client administrators do not see this module. |
| **Alerts** | Things that need attention. |
| **Curtains · QR** | Install, replace and track QR-labelled products such as curtains. |
| **Warehouse** | Stock control for any product: receive, pick, pack, move and count. |
| **Laundry · RFID** | Tagged linen and items moving through rooms and doorways. |
| **Transport** | Shipments, from booking to delivery. |
| **Team** | Create and manage your own staff (client administrators only). |
| **Help and training** | This guide. |
| **My account** | Your sign-in, phone settings and quick PIN. |

### Who can do what

| Role | What they can do |
|---|---|
| **Client administrator** | Everything your company has. Creates accounts for staff and chooses what each person can do. Manages labels, locations and reports. |
| **Staff** | Only the screens they were given: for example a fitter sees Scan, Install and Take down. |

A client administrator can only give staff features that your company already has.

---

## 2. Getting started

### Signing in
1. Open the Tex-Trak address your administrator gave you.
2. Enter your **username** and **password**. Press *Show* to check what you typed.
3. If sign-in fails, the message tells you why. If your company or your account has been switched off, the message says so. Contact your administrator or support.

You can change nothing about your username yourself. If it needs changing, ask support.

### The Android app
Fitters and drivers should use the app on their phone. It works with a poor signal and keeps scans safe until the phone is online.

1. In the left menu (or on the sign-in page) choose **Download the mobile app**.
2. Open the downloaded file. If Android asks, allow *install unknown apps* for your browser.
3. Sign in. The first sign-in needs an internet connection.
4. Allow **location** when asked: choose *While using the app* or *Allow*.
5. Open **My account** and set a **quick PIN** (4 to 6 digits). It opens the app quickly, even without signal.
6. In Android settings, set Tex-Trak battery use to **Unrestricted**, so location keeps working with the screen off.

On an iPhone, use Tex-Trak in the browser. Location is recorded only while the page is open.

### What the top strip tells you
A strip at the top shows *You are offline* or *Sending N scans*. Tap it to see every saved scan.

### Notifications
Important events (for example a shipment dispatched or arrived, or something saved) appear briefly at the top right of the screen.

---

## 3. Scanning: what you will see and hear

You can scan with the phone camera, with a Bluetooth or USB scanner that types into the screen, or by typing the code.

1. Press **Start camera** and point it at the label.
2. When you have finished, press the red **Stop camera** button.

| Sound | Meaning |
|---|---|
| **One short high beep** | The scan worked. |
| **Two lower, harsher buzzes, with a long vibration** | Something is wrong. Read the red message on the screen. |

Each message says what went wrong and what to do. The most common ones are in section 10.

---

## 4. Scan station

**Scan station** is for field staff who have been given it. It reads any code and shows what it is. Client administrators do not see it, and it can be given to a person under **Team**.

| Code | What you see | What you can do |
|---|---|---|
| A tagged item (RFID tag, QR or barcode) | Product, state, number of washes | Issue to a ward, mark soiled, put in a cage, return to stock, report lost |
| A shipment (for example `SHP-1001`) | Route and number of items | Dispatch, or receive and count |
| A curtain | Status and place | Go to Install or Take down |

Every scan is saved in a shared scan log.

---

## 5. Curtains · QR

For products carrying a QR label, such as curtains.

### Set up before the first job (client administrator)
1. **Locations.** Open **Curtains → Locations** and choose your CSV file. The columns are `Hospital, Code, Floor, Ward, Bay`. A template is provided. Importing again is safe: only new rows are added.
2. **Create labels.** Open **Curtains → Register labels** and press *Generate QR codes*.
   - Enter the product code and name, and how many labels you need (up to 50,000).
   - Check the code format, and press *Save format* if you changed it.
   - Choose **Yes, register them**, so fitters can use the labels straight away.
   - Print the sheet, or download the CSV for your label printer. Printing is done from a computer.
3. **Change-due time.** Set *Change due after (days)*. The default is 7.

### Installing a new curtain (fitter)
1. Open **Install**.
2. Choose the hospital, floor, ward and bay.
3. Scan the new curtain's label. You hear a beep and see the result.

### Replacing an old curtain (fitter)
1. Open **Take down** and choose *By scan*.
2. Choose the reason: *Expired*, *Soiled* or *Damaged*. Add a note if useful.
3. Scan the **old** curtain.
4. The screen asks for the replacement. Scan the **new** curtain. It is placed in the same position automatically.

To take down several curtains at once, choose *By location*, tick what is coming down, then scan each replacement.

### Checking the work (client administrator)
- **Dashboard:** what is installed, overdue and due soon.
- **Products:** search and filter by code, status or hospital. Click a code to see its full history.
- **Reports:** installations and take-downs by period, with CSV export.

### Messages you may see
| Message | What to do |
|---|---|
| *is not registered* | The label has not been registered. Ask your administrator to register it. |
| *is already installed at…* | It is already fitted somewhere. Check you scanned the right label. |
| *already has … Take it down first* | That bay already has a curtain. Use Take down to swap it. |
| *was taken down. Register it again* | It came down earlier. Register it again once it is back in stock. |
| *saved on this phone* | You are offline. It will be sent automatically. |

---

## 6. Warehouse

Stock control for any product. Items can be tracked by QR code, barcode or RFID.

### Set up once (client administrator)
1. **Locations.** Add shelves, bins and zones one by one, or import a CSV. Each has a short code such as `A-01-03`. An optional capacity warns you when a shelf is nearly full.
2. **Items.** Add products with a SKU, a name and, if they have one, a barcode. Set the reorder level, the usual order size, the supplier lead time, the cost and whether the product has an expiry date. Import a CSV for many items, then use **Import stock** to load opening quantities.
3. **Print labels.** Print QR labels for shelves and items. Products that already have a barcode need no new label.

### Every day
| Screen | What it does |
|---|---|
| **Smart scan** | Scan anything. An item shows its stock by shelf, lot and expiry. A shelf shows what is on it. An order slip opens the order. |
| **Goods in** | Scan items, choose the shelf, lot, expiry and condition (good, hold, to repair, beyond repair). One receipt can hold many lines. |
| **Goods out** | Take stock out for a sale, production, sample, disposal or return to supplier. The soonest expiry is picked first. |
| **Pack order** | Pick items for a customer. Stock leaves the shelf and is kept against the order. |
| **Orders** | Print the packing slip, dispatch, or unpack. |
| **Unpack** | Take items back out of a packed order. Each goes back to its shelf, or on hold, or to repair. A dispatched order cannot be unpacked. |
| **Move** | Move stock from one shelf to another, keeping its lot and expiry. |
| **Damage and repair** | Record damage, hold and release, repaired, write off, or correct a quantity. Write-offs and corrections need a reason. |
| **Cycle count** | Count a shelf. Any difference is corrected and recorded. |
| **Ledger** | Every stock movement, who did it and when. It cannot be edited. Export to CSV. |
| **Insights** | Reorder suggestions, expiry watch, what moves and what sits, space used, and unusual adjustments. |

### Good to know
- Expired, held and damaged stock is never picked.
- Saving the same screen twice, for example after a poor signal, cannot count stock twice.
- Our own QR labels start with `WH:`. Barcodes work with or without leading zeros. You can add extra codes to an item (for example a case barcode or an RFID tag), and scanning any of them finds it.
- **After goods out or packing,** Tex-Trak offers **Arrange shipment** so you can book the delivery straight away (see section 8).
- **Working offline:** Goods in, Goods out, Pack order, Move, Damage and repair and Cycle count keep working with no signal. They are saved on the phone, show their result at once and are sent in order when the connection returns. If the server refuses one (for example, someone else took the stock first), it is shown with *Try again* and *Discard*. Orders, the ledger, unpacking, dispatch, imports and edits to items or locations need a connection. **Connect once first** so the shelf and item list is saved on the device.

---

## 7. Laundry · RFID

For tagged linen and other items that pass through doorways fitted with RFID readers. CIRCAI installs and configures the readers, so there is nothing to set up on the device yourself.

### How it works
Every tagged item has a unique tag. When it passes a reader, Tex-Trak moves it into the room beyond the door and updates its state, and the move is saved in the item's journey.

| Where it is read | The item becomes |
|---|---|
| Dirty utility or cages | In a dirty cage |
| Washing or processing | Processing |
| Clean store | In stock |
| Ward or clinical area | In use |

When washing finishes, the item's wash count goes up by one.

### What you do
- **Inventory:** the list of your tagged items. Add items one by one, or **Import CSV**. The columns are `epc, qr, barcode, product, max_cycles, cycles, value`. Each item needs at least one of EPC, QR or barcode. A template can be downloaded on the page. Items must be on the list for movements to be recorded.
- **Facilities and floors:** each room with its item counts, the last read of each reader, and the latest reads.
- **Unknown tags:** tags that were read but are not on your list. Add them to Inventory.
- **Missing items:** if an item marked missing is read again, it is recorded as found.
- **Laundry arrivals:** what is arriving and what is on the shelves.

If a reader shows no activity, tell support with the name of the reader.

---

## 8. Transport: Shipments

Open **Transport → Shipments** to book, follow and close a delivery.

### Book a shipment
Press **New shipment**. The form works from the top down, and fills in as much as it can by itself.
1. **What is going?** Choose **Packed orders**, **Goods out**, **Curtains** or **Laundry items**, and tick what is going (or press *Select all … shown*). Anything already on another shipment is greyed out, so nothing is sent twice. The number of items fills in by itself. **At least one item must be ticked:** a shipment cannot be booked empty.
2. **From and to.** Both are **chosen from a list of your sites**; addresses cannot be typed. The destination is **filled in automatically** when the packed order's customer or the *To whom or where* you entered in Goods out matches a site name; otherwise choose it. **From** remembers where you sent from last time. If a place is missing from the list, ask your Tex-Trak administrator to add it as a site. When the destination matches a customer with a Tex-Trak account, they can follow and sign for the delivery; you can also choose the customer account yourself. If your packed orders go to different places, it asks which one this shipment is for.
3. **How will it be tracked?** Choose one of four, each with its own list:
   - **Vehicle:** one of your vehicles. It shows whether it has a tracker and when it was last heard.
   - **GNSS tracker:** a stand-alone tracker placed in the load or on the cage.
   - **Mobile phone:** the driver's phone, once they have signed in to the Tex-Trak app.
   - **Not tracked:** you press Dispatch and *Mark as arrived* yourself.
   Tex-Trak warns you if a tracker is already on another open shipment, and remembers your last choice.
4. **More details** (optional): type, carrier, planned times, weight and description.
5. Press **Book shipment**. The bar at the bottom always says what will happen by itself. The shipment gets a reference such as `SHP-1001`. Write it on the delivery note.

You can also start from **Arrange shipment**, which appears after Pack order, Goods out and Take down.

### How Tex-Trak knows it has left and arrived
It follows the tracker and compares its position with your **From** and **To** sites. When the tracker drives out of the From site, the shipment is dispatched by itself. When it reaches the To site, arrival is noted and you are told to count. Direction therefore comes from the two sites you pick, so pick them from the list. The shipment's **Tracking** box says what will happen by itself and what you must do by hand. Press **Change** to switch the vehicle or tracker before it arrives.

### Dispatch
1. Count the items. The count must match the shipment.
2. Open the shipment and press **Dispatch** once it is loaded and packed. The status becomes **On the way**.
3. If the vehicle has a tracker, the shipment can be dispatched automatically when the vehicle leaves the From site.

### While it is on the way
For a tracked delivery, **History** records by itself where it was when it first got about **25%**, **50%** and **75%** of the way: the position, the time the tracker reported it (UK time) and how far was left. The percentage is how much of the straight-line distance from your From site to your To site has been covered, so it is not road miles. Only the tracker's own positions count, not points entered by hand. If the tracker was silent while it passed more than one mark, only the furthest one reached is recorded. Very short trips (under 1 km) get no marks.

You can also:
- **Add update:** a short note.
- **Report delay:** say why it is late.
- **Report a problem:** for example damage or a wrong address.

### Arrival
1. When a tracked vehicle reaches the To site, you see a green line **The vehicle arrived at …** and a notification. Without a tracker, open the shipment once the customer confirms.
2. Ask the receiver to count the items.
3. Press **Receive** and enter the number that arrived.
   - **The same number:** the shipment is **Delivered**.
   - **A different number:** it is recorded as a **problem**. After you resolve it, press **Mark resolved**.

### Sending the customer a link (no sign-in)
Open the shipment and find **Customer link**. Press **Copy link** to paste it into a message, or **Copy formatted email** to paste a ready-made, designed email into any mail app (it names you and the customer, and lists the addresses, items and expected time). **Preview email** shows how it will look. The customer opens the link on their phone with **no sign-in**, follows the delivery live, and when it arrives the page asks them to confirm: *All items arrived*, their name, their signature and one button.

### What the customer can do, and when
Before it arrives, a customer can only **follow it on a live map**. As soon as the tracker reaches your **To** site, the customer can **check it and sign**. If the shipment is not tracked, press **Mark as arrived** when it reaches them; that opens it up for the customer in the same way.

### When the customer accepts it themselves
Once it has arrived, a customer with a Tex-Trak account signs in and sees only the shipments booked to them. They either **scan each item** or **confirm they checked the items**, then enter their **name** and **sign**. As soon as they do, the shipment changes to **Delivered** (or **Problem** if the number differs), and you get a notification. Open the shipment to see **Received and signed**: who accepted it, when, how, and their signature.

Every step is kept in the shipment's history. A shipment can be cancelled before it is dispatched, and its items become free again.

---

## 9. Live map and Alerts

### Live map
The map shows **one kind of thing at a time**, so they are never mixed up. Use the tabs at the top: **GNSS trackers** (opens first), **Vehicles**, **Mobile phones**, **Laptops and browsers** and **People**. Each kind has its own colour, shape and picture, and its own list on the right.

Shows your vehicles and people with their name, last seen time and battery, and your sites as coloured markers and zones.
- **Click the map, then scroll** to zoom. Until you click, scrolling moves the page, so the page never gets stuck.
- **Route history:** click a vehicle or person to see a day's route, with distance, time moving and top speed. Choose the day with the date box, the arrows, or *Today / Yesterday / 2 days ago*. *Download day (CSV)* saves the points.
- Full detail is kept for 30 days. After that, only the positions are kept.

### Alerts
Lists things that need attention, with what to do first.

### Privacy
People are told what is recorded the first time they sign in on a phone, and can see the status in **My account**. Only administrators of your own company see movement.

---

## 10. Team (client administrators)

Open **Team** to manage the people in your company.

### Add a person
1. Press **Add person**.
2. Enter their **name** and a **username** (3 to 24 lowercase letters, digits, dots, dashes or underscores).
3. A strong password is suggested. You can change it. It must be at least 8 characters.
4. Choose what they can do. The quick choices are:

| Choice | What it gives |
|---|---|
| **Fitter** | Scan, install and take down |
| **Supervisor** | Fitter tools plus labels, locations, reports and shipments |
| **Warehouse operator** | Scan, receive, pick, pack, move and count |
| **Warehouse view only** | Stock, insights and the ledger, no changes |
| **View only** | Dashboards and reports, no scanning |

5. Press create. **Copy the username and password now. The password is shown once.** Give it to the person privately.

### Your customers
If shipments are switched on for your company, **Team** also has a **Your customers** section. Press **Add customer**, enter the customer's company, a contact person, a username and a password, then give them the details privately. They sign in to a page that shows only the deliveries you book to them, where they scan or confirm what arrives and sign for it. A customer can never add other people. Use the key to reset their password and the power button to switch them off or on.

### Looking after accounts
- **Pencil:** change what a person can do.
- **Reset password:** set a new password if someone forgets theirs.
- **Power button:** switch a person off when they leave, or back on later. They are signed out straight away and cannot sign in while switched off.

You will be asked to confirm before anything is switched off or removed.

---

## 11. If something does not work

| Problem | What to check |
|---|---|
| Cannot sign in | Check the username and password (use *Show*). If the message says the account or company is switched off, contact your administrator or support. |
| A menu item is missing | Your company or your account does not have that feature. Ask your administrator. |
| Scan says *not registered* | The label is not registered yet (curtains), or the code is not on your item list. |
| Scan says *not in the system yet* | Add the item in Warehouse → Items, or check you scanned the right label. |
| Phone says *offline* | Scans are safe. Reconnect and they are sent. Tap the strip to see them. |
| A scan was refused later | The strip turns red. Tap it to see why, then *Try again* or *Remove*. |
| Camera does not start | Allow camera access for Tex-Trak or your browser in the phone settings, or type the code instead. |
| My phone is not on the map | Is location allowed? Is battery set to *Unrestricted*? Are you signed in? Check **My account**. |
| An RFID item does not move | Check it is on your Inventory list, then look at *Unknown tags*. Contact support if the reader shows no activity. |
| Cannot pick a place in Shipments | The site has not been added. Ask support. |

**Before you sign out,** check nothing is waiting to send.

For anything else: **surya@circai.co.uk**

*Tex-Trak is developed by CIRCAI LTD.*
