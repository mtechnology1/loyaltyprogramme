# LoyalSip — Loyalty Programme for Coffee Shops & Restaurants

A lightweight, configurable loyalty programme that can be set up in under 5 minutes. No backend required — runs entirely in the browser using localStorage.

## Quick Start

1. Open `index.html` in a browser (or serve with any static file server)
2. Complete the 3-step setup wizard (shop name, brand colours, reward config)
3. Print the QR code card for your counter
4. Customers scan to join and start collecting stamps!

## Features

### For Shop Owners
- **Setup Wizard** — 3-step onboarding: shop name/tagline, brand colours, reward threshold
- **Dashboard** — Overview metrics (members, visits, redemptions, active customers)
- **Customer Intelligence** — At-risk customers, top regulars, full member list
- **Settings** — Edit all programme settings anytime
- **QR Code Card** — Branded printable card for the counter

### For Baristas
- **Barista Station** — Enter pass codes for instant stamps
- **Approval Queue** — Approve/decline manual check-in requests
- **Redemption Handling** — Confirm rewards with one tap
- **Recent Activity** — See recently processed stamps

### For Customers
- **Quick Registration** — Phone or email + first name only
- **Auto First Stamp** — Instant reward on enrollment
- **Wallet Pass** — Digital loyalty card with personal QR code
- **Stamp Progress** — Visual stamp card showing progress
- **Reward Redemption** — Redeem when threshold reached

## Architecture

Pure HTML/CSS/JavaScript single-page application with hash-based routing.

```
index.html          — SPA entry point
css/style.css       — Theming via CSS custom properties
js/store.js         — localStorage persistence layer
js/router.js        — Hash-based SPA router
js/app.js           — Route registration and init
js/views/
  setup.js          — 3-step setup wizard
  dashboard.js      — Owner dashboard (overview, customers, settings)
  checkin.js        — Customer check-in and registration
  wallet.js         — Digital wallet pass with QR code
  barista.js        — Barista station for stamp management
  qrcard.js         — Printable QR code counter card
```

## Flows

### Primary Flow (Barista scans customer QR)
1. Customer shows wallet pass QR code
2. Barista enters 6-character pass code in Barista Station
3. Stamp confirmed instantly — no approval needed

### Fallback Flow (Manual check-in)
1. Customer enters phone/email on check-in page
2. Request appears in Barista Station queue
3. Barista confirms customer is present and approves

## Data Persistence

All data stored in browser localStorage:
- `loyalsip_config` — Shop configuration
- `loyalsip_customers` — Customer records
- `loyalsip_pending` — Pending stamp/redemption requests
- `loyalsip_recent_stamps` — Recent activity log
