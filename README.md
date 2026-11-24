# Ayush Gupta — Personal Bio & 1:1 Session Booking

Static portfolio and paid 1-hour session booking website designed for **GitHub Pages** (`https://ayushbpl10.github.io/bio/`).

## Features
- **3-Tab Interface** (`About & Expertise`, `Experience & Architecture`, and a dedicated `Schedule a Session` tab with `#overview`, `#experience`, and `#schedule` deep links)
- **Interactive Career Trace Simulator** modeling production engineering spans across Dell Technologies and Appointy
- **1-Hour Paid Session Booking (₹500 INR)** with:
  - Topic selection, 14-day IST date picker, and automatic visitor local timezone conversion
  - Zero-dependency client-side SVG **UPI QR Code** generator + `upi://pay` deep link + Copy UPI ID button
  - Downloadable `.ics` calendar invite, Google Calendar link, and booking pass modal
- **Theme & Craft Studio** supporting `System`, `Light`, and `Dark` color modes (`color-scheme` + `light-dark()`), 4 accessible accent palettes, and a toggleable blueprint grid

## Quick Configuration
Edit [`config.js`](./config.js) to set your live payment & contact details:
- `upiId`: Your UPI VPA (e.g. `yourname@okaxis`) to receive ₹500 INR payments directly
- `razorpayPaymentLink`: Optional card/netbanking payment link
- `contactEmail`: Optional email for pre-filled booking confirmations

## Deployment
Configured with [`.github/workflows/pages.yml`](./.github/workflows/pages.yml) for automatic deployment to GitHub Pages on push to `main`.
