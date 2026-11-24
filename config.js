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

  // Set your real UPI VPA here (e.g. "ayushgupta@okaxis") to activate live UPI QR payments.
  // When left empty, the booking tab runs in Preview/Request mode and generates a demo QR + booking pass.
  upiId: "ayushbpl10@ybl",
  upiPayeeName: "Ayush Gupta",

  // Optional: Add a Razorpay Payment Link or Topmate URL if you also accept cards/netbanking.
  razorpayPaymentLink: "",

  // Optional: Personal email for pre-filled booking confirmation emails (never exposes work email).
  contactEmail: "",

  // Meet / Call platform label shown in generated calendar invites
  meetingPlatform: "Google Meet / Video Call (link shared upon confirmation)",
};
