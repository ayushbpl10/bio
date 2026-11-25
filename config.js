/**
 * Site & Session Booking Configuration
 * Update `upiId`, `contactEmail`, or `razorpayPaymentLink` below and push to deploy.
 */
export const SITE_CONFIG = {
  ownerName: "Ayush Gupta",
  tagline: "Senior Software Engineer · Microservices & Distributed Architecture",
  location: "India",
  timezone: "Asia/Kolkata",
  timezoneLabel: "IST (UTC+05:30)",
  linkedinUrl: "https://www.linkedin.com/in/ayush-g-8b5b7ab8/",
  githubUrl: "https://github.com/ayushbpl10",

  // 1-Hour Paid Session Configuration
  sessionFeeInr: 500,
  sessionCurrency: "INR",
  sessionDurationMins: 60,
  discountCode: "AYUSH50",
  discountPercent: 50,

  // Live UPI VPA for instant zero-fee ₹500 QR & deep-link payments
  upiId: "ayushbpl10@ybl",
  upiPayeeName: "Ayush Gupta",

  // Personal Razorpay Payment Handle / Payment Link (no backend or secrets required for static sites)
  razorpayPaymentLink: "https://razorpay.me/@ayushgupta3781",

  // Optional: HTTPS backend URL running server/server.js (e.g. "https://api.yourdomain.com")
  // Enables Razorpay Standard Checkout, automatic email to ayushbpl10@gmail.com, and live Google Meet creation.
  razorpayApiBaseUrl: "https://bio-api.34.75.108.42.sslip.io",

  // Booking notification email (receives booking details & calendar invitations)
  contactEmail: "ayushbpl10@gmail.com",

  // Optional: Fixed reusable Google Meet link (created at meet.google.com) if not using Calendar OAuth on backend
  meetingLink: "",

  // Meet / Call platform label shown in generated calendar invites when no live Meet link is attached yet
  meetingPlatform: "Google Meet (invite sent with confirmation)",
};
