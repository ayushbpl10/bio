# Ayush Gupta — Series 10 · Portfolio & 1:1 Session Booking

Static portfolio and paid 1-hour session booking site designed with an Apple-keynote aesthetic for **GitHub Pages** (`https://ayushbpl10.github.io/bio/`).

## Highlights
- **Apple Product-Style Showcase**: Keynote hero, spec strip, asymmetric engineering Bento grid, and clickable **Mentorship Connect Modules** that pre-select a focus area straight into checkout
- **3-Tab Accessible Interface** (`Overview & Impact`, `Specs & Career Trace`, and a dedicated `Schedule a Session` tab with `#overview`, `#experience`, and `#schedule` deep links)
- **Titanium Finish & Appearance Studio**: Supports `Auto` (System), `Daylight` (Light), and `Obsidian` (Dark) modes plus 4 accessible finish palettes (`Ultramarine`, `Desert Titanium`, `Silicon Emerald`, `Telemetry Cyan`)
- **Interactive System Trace Simulator** modeling production spans across Dell Technologies and Appointy
- **1-Hour Paid Session Configurator (₹500 INR)** with:
  - Focus selection, 14-day IST slot picker with local timezone conversion
  - Zero-dependency client-side SVG **UPI QR Code** (`ayushbpl10@ybl`), copy button, and `upi://pay` deep link
  - **Razorpay Handle Checkout** (`https://razorpay.me/@ayushgupta3781`) configured without exposing API secrets on GitHub Pages
  - Downloadable `.ics` calendar invite, Google Calendar link, and Session Pass dialog

## Razorpay Checkout Note (Static GitHub Pages vs Backend API)
Because GitHub Pages only serves static files, **Razorpay Payment Handle (`razorpay.me/@ayushgupta3781`)** or **Razorpay Payment Links** are used for zero-cost static integration without exposing `RAZORPAY_KEY_SECRET` in client code. To use Razorpay Standard Checkout (`POST /api/create-order` + HMAC-SHA256 `POST /api/verify-payment`), host serverless endpoints on Vercel/Netlify with environment variables.

## Deployment
Hosted directly from the `main` branch via GitHub Pages (`.nojekyll` enabled for zero-build static ES modules).
