# What every number means

Print this and stick it on the wall. Most arguments about sales numbers are really arguments about
definitions, and this page ends them.

Every figure below comes from a tested function in `src/lib/metrics.ts`. Nobody types a stat in
anywhere. The rows are the stat.

---

## The words

**Booked** or **Scheduled.** A row exists in Post Call Report. Somebody had a call in the diary.

**Shown.** Call Status begins with "Show". They turned up.

**No show.** A row exists and Call Status does not say Showed.

**Qualified.** The Was Prospect Qualified? column says qualified. It is your rep's judgement on
whether this person could actually buy.

**Pitched.** The Was Offer Pitched? column says yes. The price was said out loud.

**Closed.** Either the Call Outcome says something like Closed, Won or Sale, **or** there is money
in Contract Value and no outcome saying otherwise. A row saying "Not closed", "Lost" or similar is
never a close, whatever the money column says.

**Text close.** A row in the Text Close Report tab. It counts as a deal, but it is **not** counted
as a booked call, because nobody booked a call.

---

## The headline cards

Cash comes first on the page, on purpose. It is the only figure that is money actually in the
bank. Contract value moves around as deposits are taken, refunded and renegotiated.

| Card | How it is worked out |
|---|---|
| **Cash Collected** | Cash Collected added up on **every** row, closed or not, plus every text close |
| **Contract Value** | Contract Value added up, but only on rows that actually closed, plus every text close. If there are deposits, the card also tells you how much sits in them |
| **Close Rate** | deals divided by calls shown. Deals includes text closes |
| **Text Closes** | how many rows are in the Text Close Report for this period |
| **Calls Scheduled** | how many rows are in Post Call Report |
| **Calls Shown** | how many of those turned up, with the percentage of scheduled underneath |
| **Qualified** | how many were marked qualified, as a percentage of those who showed |
| **Pitched** | how many got pitched, as a percentage of those who qualified |
| **1st Call Close Rate** | first calls closed, divided by first calls shown |
| **Follow-up Close Rate** | follow-up calls closed, divided by follow-up calls shown |

### Two that surprise people

**Contract Value and Cash are different on purpose.** Contract value is what people agreed to
pay. Cash is what actually arrived. If somebody signs for 2,000 and pays 500 today, contract value
goes up 2,000 and cash goes up 500. Cash is the honest one. Contract value is the optimistic one.

**A deposit is not a closed deal.** Somebody who paid 100 towards a 1,550 package has not bought
yet, and might never. So their 1,550 is left out of Contract Value, while their 100 is counted in
Cash. The card says so out loud, for example "12 deals closed, 3,544 more in 3 deposits not closed
yet", so the money is never invisible. Add the two together and you get what you would get totting
up the column by hand.

**Cash can be higher than Contract Value.** That is not a bug, it is those deposits. If the gap
looks far too big, go and find a row where somebody marked it "Not closed" but typed the full
payment in anyway.

**Pitched can go over 100%.** It is pitched as a share of qualified. If your rep pitches people
they marked unqualified, you get more than 100%. That is worth a conversation, and the number is
doing its job by showing you.

---

## Lead Source Breakdown

Every lead source you use gets sorted into one of two buckets, Organic or Paid Ads. Which bucket
each one lands in is set in `src/config/airtable.config.ts`:

```ts
export const LEAD_SOURCE_GROUPS = {
  paidAds: ['Paid', 'Paid Ads', 'Ads', 'Facebook Ads', 'Meta', 'YouTube Ads', ...],
  organic: ['Instagram', 'Organic', 'Referral', 'Content', 'YouTube', 'TikTok', ...],
}
```

Anything the dashboard has never heard of counts as Organic, and the footer tells you so. When you
see that warning, add your spelling to the list above.

---

## Call Type

Anything with follow, second, third or 2nd, 3rd in it counts as a **Follow-up**. Everything else
is a **1st Call**. So `First Call` and `Discovery Call` are both first calls, while `Second Call`
and `Follow-up Call` are both follow-ups.

---

## The funnel

Five bars, each showing the conversion from the one above:

Scheduled, then Showed, then Qualified, then Pitched, then Closed.

The percentage under each bar is that stage divided by the stage above it, so you can see exactly
which step is leaking. The narrowest step is where your money is going.

---

## Objections

Whatever is typed in Main objection, tidied up so that "money", "Money " and "Money." all count as
the same thing. Capital letters, extra spaces and full stops are ignored. The label shown is
whatever your team actually typed, with the first letter made a capital.

If Main objection is a free text field, expect a messy chart. Make it a dropdown.

---

## Closer Performance

One row per sales rep, with the same definitions as everything above, just filtered to their rows.

The status label is a simple rule you can change in one line:

| Status | Close rate |
|---|---|
| Good | 25% or higher |
| Average | 15% to 25% |
| Needs Work | Under 15% |
| No Data | Nobody showed up for them in this period |

Be careful with this one. A rep with four calls and one close reads as 25% and gets a Good. Look at
the call count next to it before you act on the label.

---

## Follow-Ups tab

**Open Follow-Ups.** Showed up, did not close, no deposit. Newest first. This is your call list.

**Deposits.** Paid something but not everything. Chase the balance.

**No Shows.** Booked and never turned up, with their phone and email so you can rebook them.

**Oldest Open.** How many days the longest ignored follow-up has been sitting there. If this number
climbs past a fortnight, your follow-up process is not real.

---

## The two charts

**Cash Trend** plots cash collected per week, not contract value, for the same reason cash leads
the page: it is the number that is real.

**Cash by Close Type** shows where that money actually came from, split by first call, follow-up
and text close.

## Time filters

Last Week, 2 Weeks, 4 Weeks, Year, All Time, or Custom with any two dates.

Every number on the page obeys the filter, and the filter is remembered in the web address, so you
can bookmark "the last four weeks" or paste a link to exactly what you are looking at.

A row belongs to a period based on its **Date** column, which is the day of the call, not the day
somebody got round to filling in the form.
