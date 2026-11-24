# Ayush Gupta — Series 10 · Portfolio & 1:1 Session Booking

Static portfolio and paid 1-hour session booking site designed with an Apple-keynote aesthetic for **GitHub Pages** (`https://ayushbpl10.github.io/bio/`), paired with an optional lightweight Node.js backend (`server/`) for Razorpay Standard Checkout.

## Highlights
- **Apple Product-Style Showcase**: Keynote hero, spec strip, asymmetric engineering Bento grid, and clickable **Mentorship Connect Modules** that pre-select a focus area straight into checkout
- **3-Tab Accessible Interface** (`Overview & Impact`, `Specs & Career Trace`, and a dedicated `Schedule a Session` tab with `#overview`, `#experience`, and `#schedule` deep links)
- **Titanium Finish & Appearance Studio**: Supports `Auto` (System), `Daylight` (Light), and `Obsidian` (Dark) modes plus 4 accessible finish palettes (`Ultramarine`, `Desert Titanium`, `Silicon Emerald`, `Telemetry Cyan`)
- **Free ₹500 Payment Options**:
  - **Instant Zero-Fee UPI QR (`ayushbpl10@ybl`)** + `upi://pay` deep link
  - **Free Razorpay Handle (`https://razorpay.me/@ayushgupta3781`)** (or any fixed ₹500 Payment Link)
  - **Optional Standard Web Checkout (`server/`)**: Node.js `POST /api/create-order` + HMAC-SHA256 `POST /api/verify-payment` designed to run on a free-tier GCP `e2-micro` VM behind Caddy HTTPS or Vercel/Netlify serverless routes (never exposing `RAZORPAY_KEY_SECRET` to GitHub Pages).

## Deploying Optional Backend (`server/`) on GCP VM
Run inside GCP Console Browser SSH on your Ubuntu VM (never commit `.env`):
```bash
curl -fsSL https://raw.githubusercontent.com/ayushbpl10/bio/main/server/deploy-vm.sh -o deploy-vm.sh
chmod +x deploy-vm.sh
RAZORPAY_KEY_ID="your_key_id" RAZORPAY_KEY_SECRET="your_key_secret" API_DOMAIN="your-https-subdomain" ./deploy-vm.sh
```
Then set `razorpayApiBaseUrl` in [`config.js`](./config.js) to `https://your-https-subdomain` and push to `main`.
