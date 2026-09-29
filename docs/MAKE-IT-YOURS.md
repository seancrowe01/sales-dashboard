# Making it look like your business

Three things to change. None of them need you to understand the code.

---

## 1. Your name

Open `.env` and set:

```bash
VITE_BRAND_NAME=Bright Fitness
```

That appears in small capitals above "Sales Dashboard", in the header and on the sign in screen.
Leave it blank and it just says "Sales Dashboard" with nothing above it.

Restart the dashboard after changing it.

---

## 2. Your colours

The whole thing runs on two colours. Change them in **two files** and you are done.

**File one, `tailwind.config.ts`.** Near the top you will find this twice, once under `brand` and
once under `accent`. Change both:

```ts
primary: '#4F8CFF',
secondary: '#A855F7',
```

**File two, `src/lib/colors.ts`.** Right at the top:

```ts
primary: '#4F8CFF',
secondary: '#A855F7',
```

Use the same two values in both files. That is the entire job. Charts, buttons, the glow on the
cards, the line across the top of the header, all of it follows those two.

### Picking colours that work

The background is nearly black. Pale, washed out colours disappear on it. Bright, slightly
electric colours work.

A few pairs that look good on a dark background:

| Look | Primary | Secondary |
|---|---|---|
| Blue and purple (what ships) | `#4F8CFF` | `#A855F7` |
| Teal and coral | `#2DD4BF` | `#FB7185` |
| Amber and violet | `#FBBF24` | `#8B5CF6` |
| Sky and magenta | `#38BDF8` | `#E879F9` |

Avoid green and red for your two brand colours. The dashboard already uses green for good things
and red for problems, and you do not want your logo colour arguing with a warning.

---

## 3. Your logo

Open `src/components/brand/Mark.tsx`. It is a small file with a simple three bar shape in it.

**Easiest option.** Put your logo image in the `public/` folder, then replace everything inside the
`return (...)` with:

```tsx
return <img src="/your-logo.png" alt="" width={size} height={size} className={className} />
```

Use a square image with a transparent background, at least 72 pixels across. A PNG or an SVG both
work.

**If you have an SVG.** Open it in Notepad, copy the `<svg>...</svg>` code, and paste it in place
of the one already there. Keep `width={size}` and `height={size}` so it scales properly in both
places it is used.

---

## Changing the money symbol

In `.env`:

```bash
VITE_CURRENCY=$
```

It goes in front of every money figure. Anything works: `£`, `$`, `€`, or even `EUR `.

---

## Changing the wording

The section titles and card labels live in the files under `src/components/sections/`. They are
plain English strings and you can just edit them. For example, if your team says "appointments"
rather than "calls", search the folder for `Calls` and change what you find.

After any change to a file, run this to check nothing broke:

```bash
npm test
```

---

## Changing the status thresholds

The Good, Average and Needs Work labels on the Closer Performance table are set in
`src/lib/metrics.ts`. Search for `Needs Work` and you will find the rule. It is three numbers. If
25% is not a "Good" close rate in your world, change it.

If you do change it, the tests will fail, because there is a test pinning the current values. That
is the test doing its job. Update the numbers in `src/lib/metrics.test.ts` to match.
