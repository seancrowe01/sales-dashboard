# Set up with Google Sheets

This takes about twenty minutes. Do the parts in order. Nothing here costs money.

There are four parts:

1. Build the sheet
2. Make a robot account so the dashboard can read it
3. Let the robot into your sheet
4. Tell the dashboard where to look

---

## Part 1: Build the sheet

Make a new Google Sheet. Call it whatever you like.

At the bottom you will see one tab called "Sheet1". You need **two** tabs, named exactly:

- `Post Call Report`
- `Text Close Report`

Capital letters matter. Rename Sheet1 to the first one, then add a second tab for the other.

### The Post Call Report tab

One row per sales call. Put these **sixteen** column headings in row 1, left to right, spelled
exactly like this:

| Column | What goes in it |
|---|---|
| Date | The day of the call. **Format this column as 2026-09-04**, see the warning below |
| Closer Name | Who took the call |
| Prospect Name | Who they spoke to |
| Phone | Their phone number |
| Email | Their email |
| Lead Source | Where the lead came from, for example Instagram, Referral, Ads |
| Call Type | `First Call` or `Second Call` |
| Call Status | `Showed` or `No Show` |
| Was Prospect Qualified? | `Qualified` or `Unqualified` |
| Was Offer Pitched? | `Yes` or `No` |
| Call Outcome | `Closed`, `Not closed`, `Deposit`, or `Follow-up booked` |
| Contract Value | The full price they agreed to, numbers only or with a currency symbol |
| Cash Collected | What they actually paid that day |
| Main objection | Why they did not buy, for example Money, Timing |
| Next Steps | What happens next in your own words |
| Call Notes | Anything worth remembering |

### The Text Close Report tab

One row per deal you closed over text or DM, with no call. Nine columns:

| Column | What goes in it |
|---|---|
| Date | The day they paid |
| Closer Name | Who closed it |
| Prospect Name | Who bought |
| Phone | Their phone number |
| Email | Their email |
| Lead Source | Where the lead came from |
| Close Type | For example `Text Follow-Up Close` |
| Contract Value | The full price |
| Cash Collected | What they actually paid |

### Warning about dates, please do not skip this

Click the letter above your Date column to select the whole column. Then go to
**Format > Number > Custom date and time** and set it to **year, then month, then day**, so a date
looks like `2026-09-04`.

Here is why. If a date says `04/09/2026`, nobody can tell whether that is the 4th of September or
the 9th of April. The dashboard has to guess, and one day it will guess wrong and your September
sales will show up in April. Writing the year first makes it impossible to get wrong.

### A few rules for whoever fills this in

- A no show only needs Date, Closer Name, Prospect Name, Lead Source, Call Type and Call Status.
  Leave everything else empty.
- Only put a number in **Contract Value** when they actually bought.
- **Cash Collected** is what landed in the bank that day, not what they promised.
- If someone paid a deposit, the outcome is `Deposit`, the Contract Value is the full price, and
  the Cash Collected is just the deposit.
- If a deal is refunded, set both money columns to 0 and leave a note. Do not delete the row, or
  your show rate quietly changes.

---

## Part 2: Make a robot account

Your sheet is private, and it should stay that way. It has real people's names, phone numbers and
email addresses in it. So instead of making it public, we give the dashboard its own robot account
that can read that one sheet and nothing else.

Google calls this a "service account". It is free.

1. Go to https://console.cloud.google.com and sign in with the same Google account.
2. At the top there is a project dropdown. Click it, then **New Project**. Name it something like
   `sales-dashboard`. Click Create. Wait a few seconds, then make sure that new project is the one
   selected in the dropdown.
3. In the search bar at the top, type `Google Sheets API` and click the result. Click **Enable**.
   Wait for it.
4. In the search bar, type `Service accounts` and click the result.
5. Click **Create service account** at the top.
   - Name: `sheet reader`
   - Click **Create and continue**
   - It asks about roles. Skip it, click **Continue**, then **Done**.
6. You are now looking at a list with one robot in it. Copy its email address. It looks like
   `sheet-reader@sales-dashboard-123456.iam.gserviceaccount.com`. Paste it in a note, you need it
   in a minute.
7. Click on the robot, then the **Keys** tab at the top.
8. Click **Add key > Create new key**. Choose **JSON**. Click Create.

A file downloads. **That file is a password.** Anyone who has it can read anything the robot can
read. Do not email it, do not put it in a chat, do not put it on GitHub. Keep it somewhere safe on
your own computer.

---

## Part 3: Let the robot into your sheet

1. Open your sheet.
2. Click **Share**, top right.
3. Paste the robot's email address, the long one ending in `.iam.gserviceaccount.com`.
4. Change the permission from Editor to **Viewer**. The robot never needs to write anything.
5. Untick **Notify people**, robots do not read email.
6. Click **Share**.

Done. Your sheet is still private to everyone else.

---

## Part 4: Tell the dashboard where to look

Open your `.env` file in the dashboard folder. If you do not have one, copy `.env.example` and
rename the copy to `.env`.

**1. Set the source:**

```bash
DATA_SOURCE=sheets
```

**2. Add your sheet id.** Open your sheet and look at the address bar:

```
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit
```

The messy bit between `/d/` and `/edit` is the id:

```bash
GOOGLE_SHEET_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
```

**3. Add your tab names.** If you named them exactly as above, these are already right:

```bash
SHEET_CALLS_TAB=Post Call Report
SHEET_DM_TAB=Text Close Report
```

**4. Add the robot's key.** Open that JSON file you downloaded in Notepad or TextEdit. Select
everything, copy it. Now paste it all on one line after the equals sign:

```bash
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...
```

It will be a long ugly line. That is fine. It must be on **one line** with no line breaks.

If that feels fiddly, you can keep the key as a file instead. Put the JSON file in the dashboard
folder, rename it `google-service-account.json`, and use this line instead:

```bash
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json
```

**5. Set a password and switch to live data:**

```bash
DASHBOARD_PASSWORD=pick-something-long-here
VITE_DATA_SOURCE=live
```

**6. Start it up:**

```bash
npm run dev
```

Open http://localhost:5173, type your password, and your real numbers should be there.

---

## If it does not work

Look at the very bottom line of the dashboard. It tells you what is wrong in plain English.

| It says | What to do |
|---|---|
| Share the sheet with the service account email as a Viewer | Part 3 did not take. Open the sheet, click Share, check the robot's email is listed |
| Google rejected the service account sign in | The key in your `.env` is wrong or got cut off. Copy the whole JSON file again, all on one line |
| That Google Sheet id was not found | Check `GOOGLE_SHEET_ID`. You want only the bit between `/d/` and `/edit` |
| The sheet has no tab named "..." | A tab name does not match. Capital letters and spaces both matter |
| Using sample data | `VITE_DATA_SOURCE` is still `mock`, or there is no `.env` file at all. Stop the server and start it again after fixing |

**Numbers look wrong?** Check the sheet row first, not the dashboard. Nine times out of ten it is a
row where somebody typed the outcome one way and the money another. Read
[What every number means](WHAT-THE-NUMBERS-MEAN.md) to see exactly how each figure is worked out.
