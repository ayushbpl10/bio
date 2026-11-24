# Ayush Gupta — Series 10 · Portfolio & 1:1 Session Booking

Static portfolio and paid 1-hour session booking site designed with an Apple-keynote aesthetic for **GitHub Pages** (`https://ayushbpl10.github.io/bio/`), paired with an optional lightweight Node.js backend (`server/`) for Razorpay Standard Checkout, Gmail notifications, and Google Meet scheduling.

## Highlights
- **Apple Product-Style Showcase**: Keynote hero, spec strip, asymmetric engineering Bento grid, and clickable **Mentorship Connect Modules**
- **3-Tab Accessible Interface** (`Overview & Impact`, `Specs & Career Trace`, and `Schedule a Session` with `#overview`, `#experience`, and `#schedule` deep links)
- **Every Tuesday 6:00 PM IST Booking Schedule**: Calendar chips, HTML date constraint validation (`step="7"` + Tuesday check), and automatic visitor local timezone conversion
- **Free ₹500 Payment Options**:
  - **Instant Zero-Fee UPI QR (`ayushbpl10@ybl`)** + `upi://pay` deep link
  - **Free Razorpay Handle (`https://razorpay.me/@ayushgupta3781`)**
  - **Optional Standard Checkout (`server/`)**: Node.js `POST /api/create-order`, HMAC-SHA256 `POST /api/verify-payment`, and `POST /api/book-session`
- **Email (`ayushbpl10@gmail.com`) & Google Meet Integration**:
  - Pre-filled `mailto:ayushbpl10@gmail.com`, Google Calendar invite link (`&add=ayushbpl10@gmail.com`), and `.ics` calendar file with `ORGANIZER` & `ATTENDEE`
  - Optional automatic Gmail email dispatch (`nodemailer` + Gmail App Password) and automatic Google Meet creation via Google Calendar OAuth (`server/get-google-token.mjs`)

## Deploying Optional Backend (`server/`) on GCP VM
Run inside GCP Console Browser SSH on your Ubuntu VM (never commit `.env`):
```bash
curl -fsSL https://raw.githubusercontent.com/ayushbpl10/bio/main/server/deploy-vm.sh -o deploy-vm.sh
chmod +x deploy-vm.sh
RAZORPAY_KEY_ID="your_key_id" \
RAZORPAY_KEY_SECRET="your_key_secret" \
GMAIL_APP_PASSWORD="your_gmail_app_password" \
API_DOMAIN="your-https-subdomain" ./deploy-vm.sh
```
To enable automatic dynamic Google Meet links per booking on `ayushbpl10@gmail.com`, create a Google Cloud OAuth Desktop/Web Client ID (with `http://127.0.0.1:8919/oauth2callback`), run `node get-google-token.mjs` once, and add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN` to `server/.env`. (Alternatively, paste a permanent Meet link from `meet.google.com` into `meetingLink` in [`config.js`](./config.js).)

Then set `razorpayApiBaseUrl` in [`config.js`](./config.js) to `https://your-https-subdomain` and push to `main`.
