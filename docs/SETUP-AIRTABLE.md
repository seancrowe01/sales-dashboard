# Set up with Airtable

This takes about ten minutes.

**Read this first.** Airtable's free plan allows **1,000 API reads a month for your whole
account**, not per base. This dashboard is built to be careful and uses about 360 a month. But if
you have automations or other tools hitting Airtable too, you can run out. When you run out,
everything stops until the 1st of the next month.

If that worries you, [use Google Sheets instead](SETUP-GOOGLE-SHEETS.md). It has no such limit.

---

## Part 1: Build the base

Make a new base. Inside it you need **two tables**, named:

- `Post Call Report`
- `Text Close Report`

### The Post Call Report table

One row per sales call. Make these sixteen fields:

| Field name | Field type | What goes in it |
|---|---|---|
| Date | Date | The day of the call |
| Closer Name | Single line text | Who took the call |
| Prospect Name | Single line text | Who they spoke to |
| Phone | Phone number | Their number |
| Email | Email | Their email |
| Lead Source | Single select | Instagram, Referral, Ads, and whatever else you use |
| Call Type | Single select | `First Call`, `Second Call` |
| Call Status | Single select | `Showed`, `No Show` |
| Was Prospect Qualified? | Single select | `Qualified`, `Unqualified` |
| Was Offer Pitched? | Single select | `Yes`, `No` |
| Call Outcome | Single select | `Closed`, `Not closed`, `Deposit`, `Follow-up booked` |
| Contract Value | Currency | The full price they agreed to |
| Cash Collected | Currency | What they actually paid that day |
| Main objection | Single select | Money, Timing, Need partner approval, Other |
| Next Steps | Single select or text | What happens next |
| Call Notes | Long text | Anything worth remembering |

Use **Single select** rather than free text wherever you can. It stops people typing "showed",
"Showed up" and "SHOWED" and creating three different things.

### The Text Close Report table

One row per deal closed over text or DM, with no call. Nine fields:

| Field name | Field type |
|---|---|
| Date | Date |
| Closer Name | Single line text |
| Prospect Name | Single line text |
| Phone | Phone number |
| Email | Email |
| Lead Source | Single select |
| Close Type | Single select, for example `Text Follow-Up Close` |
| Contract Value | Currency |
| Cash Collected | Currency |

### A few rules for whoever fills this in

- A no show only needs Date, Closer Name, Prospect Name, Lead Source, Call Type and Call Status.
- Only put a number in **Contract Value** when they actually bought.
- **Cash Collected** is what landed in the bank that day, not what they promised.
- Deposit paid? Outcome is `Deposit`, Contract Value is the full price, Cash Collected is just the
  deposit.
- Refunded? Set both money fields to 0 and leave a note. Do not delete the row, or your show rate
  quietly changes.

---

## Part 2: Make a token

1. Go to https://airtable.com/create/tokens
2. Click **Create new token**
3. Name it `sales dashboard`
4. Under **Scopes**, add one and only one: `data.records:read`
5. Under **Access**, add your base and nothing else
6. Click **Create token**

It shows you the token **once**. Copy it now. **That token is a password.** Do not email it, do
not put it in a chat, do not put it on GitHub.

---

## Part 3: Find your ids

Open your base in a browser and look at the address bar:

```
https://airtable.com/appAbC123/tblXyZ789/viwQrS456
```

- The bit starting `app` is your **base id**
- The bit starting `tbl` is the **table id** of whichever table you are looking at
- The bit starting `viw` is the **view id** of whichever view you are looking at

Click the Post Call Report table and note its `tbl` id. Then click the Text Close Report table and
note its `tbl` id. They are different.

---

## Part 4: Tell the dashboard where to look

Open your `.env` file. If you do not have one, copy `.env.example` and rename the copy to `.env`.

```bash
DATA_SOURCE=airtable

AIRTABLE_TOKEN=paste-your-token-here
AIRTABLE_BASE_ID=appAbC123
AIRTABLE_CALLS_TABLE=tblYourPostCallTableId
AIRTABLE_DM_TABLE=tblYourTextCloseTableId

DASHBOARD_PASSWORD=pick-something-long-here
VITE_DATA_SOURCE=live
```

Optional but useful: if you want the dashboard to ignore test rows, make a view in Airtable that
filters them out and add its id:

```bash
AIRTABLE_CALLS_VIEW=viwYourViewId
```

Start it up:

```bash
npm run dev
```

Open http://localhost:5173, type your password, and your real numbers should be there.

---

## Keeping inside the free limit

The dashboard reads both tables every four hours, which is two reads, six times a day, about 360 a
month. The Refresh button adds one more each time somebody presses it, and it will not let anyone
press it more than once every ten minutes.

What you must not do is lower this:

```bash
DATA_REFRESH_MINUTES=240
```

Setting it to 1 would mean 2,880 reads a day. You would be locked out before lunch. If you truly
need near-live numbers, that is the moment to move to Google Sheets or pay for an Airtable plan.

---

## If it does not work

Look at the very bottom line of the dashboard. It tells you what is wrong in plain English.

| It says | What to do |
|---|---|
| Airtable rejected the token | The token is wrong, or it was only copied partially. Make a new one |
| The Airtable token has no access to this base | The token was made without adding your base under Access |
| Airtable base or table id not found | Check you copied the `app` and `tbl` ids, and did not mix the two tables up |
| Airtable's monthly API limit for this workspace is used up | You are out of reads until the 1st. Nothing you can do except upgrade, or move the base to a fresh free workspace, or switch to Google Sheets |
| Lead sources not in the config | Harmless. It is telling you a lead source it does not recognise is being counted as Organic. Add it to `src/config/airtable.config.ts` |
| Using sample data | `VITE_DATA_SOURCE` is still `mock`, or there is no `.env` file. Fix it and restart |

**Numbers look wrong?** Check the Airtable row first. Usually it is a row where the outcome says
one thing and the money says another. Read [What every number means](WHAT-THE-NUMBERS-MEAN.md) for
exactly how each figure is worked out.
