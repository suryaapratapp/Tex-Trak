# Sending items to a customer: step by step (QR products)

For **Tom**. Your products carry a **QR code only**. There is no RFID, so every item is tracked by its QR label and counted by a person when it arrives.

**You need:** a Tex-Trak sign-in with **Shipments** and the curtain features switched on (a *Supervisor* or client admin account has these), and a phone or computer.
Support: surya@circai.co.uk

---

## Before you start (once per customer)

Ask your administrator (or the Super Admin) to check these. You only need them the first time you send to a new customer.

1. **The customer is added as a site.** Super Admin → **Sites** → **Add**: type **Customer**, *Belongs to* your company, and the address or map coordinates.
   - Because it is a site, you can pick it from the **To** list, and the system can record the arrival by itself if the vehicle has a tracker.
2. **Your own dispatch point is a site too** (your warehouse, for example), so you can pick it from the **From** list.
3. **If a tracked vehicle is doing the delivery:** it is added under Super Admin → **Vehicles** with its tracker fitted. Without a tracker, you confirm dispatch and arrival yourself. That works fine.

---

## Step 1. Make sure every item is registered

Every product must be scanned into Tex-Trak before it can be put on a shipment.

1. Open **Scan** (or **Curtains** → **Register**).
2. Scan each item's QR label. A green message confirms it.
3. If the message says **not registered**, register that label first, then scan it again.

Items show as **In stock** once registered. Only items in the list can be shipped, so if one is missing later, come back to this step.

## Step 2. Check what you are sending

1. Open **Curtains** → **Dashboard** (or **Products**) and look at the items you plan to send.
2. Put aside anything damaged. Do not put it on the shipment.

Tip: pack the items and put them together (for example in one box or on one cage) so nothing is missed at the dock.

## Step 3. Book the shipment

1. Open **Transport** → **Shipments**, then press **New shipment**.
2. **Type:** choose **Delivery**.
3. **From:** pick your site from the list.
4. **To:** pick the customer's site from the list.
   - Picking from the list lets the system follow the delivery. If the customer is not in the list, ask your administrator to add them. You can type an address, but then nothing is recorded automatically.
5. **What is in it:** press the **Curtains** tab.
   - Set the state filter to **In stock**.
   - Tick each item you are sending, or press **Select all … shown** (above the list) if all of them are going.
   - The **number of items** fills in by itself.
   - Anything already on another shipment is greyed out ("On SHP-…"), so nothing is sent twice.
6. **How will it be tracked?** Pick the vehicle from the list (it shows whether it has a tracker), or pick a **tracker or phone** that travels with the load, or leave **Not tracked** and confirm by hand. Tex-Trak knows the direction from your **From** and **To** sites: it dispatches when the tracker leaves From and notes arrival when it reaches To.
   **Carrier:** fill it in if you know it.
7. **Planned dispatch** and **Planned arrival:** add them if you know them.
8. Press **Book shipment**. It gets a reference such as `SHP-1001`. Write that on the delivery note.

## Step 4. Load and check

1. Count the items physically. The count must match the number on the shipment.
2. Scan or check each item against the list shown under **What is in it**.
3. Load them into the vehicle.

If the count does not match, do not dispatch. Fix the list first: cancel the shipment (**Cancel shipment**, before dispatch only) and book it again.

## Step 5. Dispatch

1. Open the shipment and press **Dispatch**. This confirms it is loaded and sealed.
2. The status changes to **On the way**.

If the vehicle has a tracker and the From site is picked from the list, the shipment **dispatches by itself** as soon as the vehicle drives out of the site. You can still press Dispatch yourself first.

## Step 6. While it is on the way

- **Add update:** a short note, for example "Driver called, 30 minutes away".
- **Report delay:** says why it is late.
- **Report a problem:** if something goes wrong (damage, wrong address). Describe what happened.

Everything you add is kept in the shipment's history.

## Step 7. Arrival and count

1. When the vehicle reaches the customer, a tracked shipment shows a green line: **"The vehicle arrived at …"** and you receive a notification at the top right. Without a tracker, simply open the shipment once the customer confirms.
2. Ask the customer to count what they received.
3. Press **Receive** and enter the number of items that arrived.
   - **Same number as sent:** the shipment is closed as **Delivered**.
   - **A different number:** it is recorded as a **problem** so you can follow it up.
4. Add a short note if useful (for example, who signed for it).

## Step 8. If something is wrong

| What happened | What to do |
|---|---|
| An item is missing at the customer | Enter the lower number in **Receive**. The shipment becomes a problem. Find the item, deliver it, then press **Mark resolved**. |
| An item is not in the list when booking | It is not registered yet (Step 1), or it is already on another shipment. |
| Wrong item put on the shipment | If it is not dispatched yet, press **Cancel shipment** and book again. The items become free to use again. |
| Cannot pick the customer in **To** | The customer is not added as a site yet. Ask your administrator. |
| No signal on the phone | Scans are kept safely and sent when the signal returns. |

## Quick checklist

- [ ] Every item has been scanned and is registered
- [ ] Customer and your site exist in the **From** and **To** lists
- [ ] Items ticked under **Curtains**, count correct
- [ ] Booked, reference written on the delivery note
- [ ] Loaded and counted, then **Dispatch**
- [ ] Customer counted, **Receive** entered
