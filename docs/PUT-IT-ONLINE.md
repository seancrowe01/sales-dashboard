# Putting it online

While you are testing, the dashboard runs on your own computer and only you can see it. Close the
terminal and it is gone.

To let your team open it from anywhere, it needs to live on a server that is always on. This page
covers the two simplest ways.

Before you start, know what you are putting online: your sales numbers and your prospects' names,
phone numbers and email addresses. Set a real password.

---

## First, build it

Wherever you host it, you run this once to turn the code into a website:

```bash
npm run build
```

That makes a `dist` folder. Then this starts the server:

```bash
npm start
```

The server does two jobs at once: it serves the website, and it is the only thing that ever talks
to your Google Sheet or Airtable base. Your key stays on the server and never reaches anybody's
browser.

---

## Option 1: A cheap virtual server (about 5 a month)

This is the normal way. You rent a small computer in a data centre. Hetzner, DigitalOcean, Vultr
and netcup all do one for a few pounds a month.

1. Rent the smallest Ubuntu server they offer. The cheapest one is plenty.
2. Connect to it, install Node.js, and copy your project folder onto it.
3. Create your `.env` file **on the server**. Do not upload the one from your laptop if it has
   anything in it you would not want on a server.
4. Install pm2, which keeps the server running and restarts it if it crashes:

```bash
npm install -g pm2
```

5. Start it and tell pm2 to bring it back after a reboot:

```bash
pm2 start "npm start" --name sales-dashboard
```

```bash
pm2 save && pm2 startup
```

6. Point a domain name at the server's address, and put Caddy or nginx in front so you get
   `https://` rather than a bare IP. Caddy is easier: a two line config file gets you a free
   certificate automatically.

**Do not skip the https bit.** Without it, your team's password travels across the internet as
plain readable text.

---

## Option 2: A platform that does the fiddly parts (free tier available)

Render, Railway and Fly.io will take your code from GitHub, build it and run it, with https set up
for you. Good if you would rather not touch a server.

Roughly the same on all three:

1. Push your code to a **private** GitHub repository. Private, because of the data.
2. Create a new Web Service and point it at that repository.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add every line from your `.env` file into their Environment Variables screen, one at a time.
   **Do not upload the `.env` file itself and never commit it.**
6. Deploy.

One warning about free tiers: most of them put your app to sleep when nobody visits. The first
person to open it each morning waits thirty seconds. Annoying but harmless, and the paid tier
removes it.

---

## Whichever you choose

**Set a real password.** In `.env`:

```bash
DASHBOARD_PASSWORD=something-long-and-not-used-anywhere-else
```

**Set a session secret** so people are not signed out every time the server restarts. Any long
random string:

```bash
SESSION_SECRET=paste-about-forty-random-characters-here
```

**Never set `ALLOW_NO_PASSWORD=true` on a public server.** That switch exists for testing on your
own machine and it removes the front door entirely.

**Keep your key out of the repository.** The `.gitignore` file already stops `.env` being
committed. Leave it that way.

---

## Checking it worked

Open the site, sign in, and look at the very bottom line of the page. You want to see something
like:

> Connected to Google Sheets, Data from 10:47, Checks Google Sheets every 4 hours, next at 14:47

If it says "Using sample data", the settings did not come through. If it says something else, it
is telling you the actual problem in plain English. The two setup guides both have a table of what
each message means.

---

## How it behaves once it is up

- It reads your sheet or base every four hours, and keeps the last good copy on disk. If Google or
  Airtable is down, the dashboard keeps showing the last numbers it got, with a note explaining
  why they are not fresh.
- Restarting the server does not show zeros. It loads that saved copy immediately.
- Ten people with the dashboard open costs exactly the same as one person, because the browsers
  read the server's copy, not your sheet.
- The Refresh button makes it go and look now, but not more than once every ten minutes.
