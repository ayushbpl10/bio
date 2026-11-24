import nodemailer from "nodemailer";

const DEFAULT_NOTIFY_EMAIL = "ayushbpl10@gmail.com";

/**
 * Validates that a booking falls on a Tuesday in Asia/Kolkata (IST).
 */
export function isValidTuesdayDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return false;
  const dt = new Date(`${dateStr}T12:00:00+05:30`);
  return !Number.isNaN(dt.getTime()) && dt.getUTCDay() === 2;
}

/**
 * Exchanges a Google OAuth2 refresh token for a short-lived access token.
 */
async function fetchGoogleAccessToken({ clientId, clientSecret, refreshToken }, fetchImpl) {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Failed to refresh Google OAuth token.");
  }
  return data.access_token;
}

/**
 * Creates a Google Calendar event with an auto-generated Google Meet link (`hangoutsMeet`)
 * and invites both Ayush (`notifyEmail`) and the attendee via `sendUpdates=all`.
 */
export async function createGoogleMeetEvent({ booking, env = process.env, fetchImpl = fetch }) {
  const clientId = env.GOOGLE_CLIENT_ID || "";
  const clientSecret = env.GOOGLE_CLIENT_SECRET || "";
  const refreshToken = env.GOOGLE_REFRESH_TOKEN || "";
  const calendarId = env.GOOGLE_CALENDAR_ID || "primary";
  const notifyEmail = env.BOOKING_NOTIFY_EMAIL || DEFAULT_NOTIFY_EMAIL;

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      created: false,
      meetUrl: env.STATIC_MEET_URL || "",
      reason: "Google Calendar OAuth credentials not configured.",
    };
  }

  const accessToken = await fetchGoogleAccessToken(
    { clientId, clientSecret, refreshToken },
    fetchImpl
  );

  const startLocal = `${booking.dateStr}T18:00:00+05:30`;
  const endLocal = `${booking.dateStr}T19:00:00+05:30`;
  const attendees = [{ email: notifyEmail, displayName: "Ayush Gupta" }];
  if (booking.email && booking.email.toLowerCase() !== notifyEmail.toLowerCase()) {
    attendees.push({ email: booking.email, displayName: booking.name || booking.email });
  }

  const eventPayload = {
    summary: `1:1 Session with Ayush Gupta — ${booking.topicTitle || "Mentorship"}`,
    description: [
      `Booking ID: ${booking.id}`,
      `Guest: ${booking.name} (${booking.email})`,
      booking.profile ? `Profile: ${booking.profile}` : "",
      `Fee: ₹500 INR`,
      `Payment Ref: ${booking.utr || "Verified / Pending"}`,
      `Agenda: ${booking.agenda || "1:1 Engineering & Career Discussion"}`,
    ]
      .filter(Boolean)
      .join("\n"),
    start: { dateTime: startLocal, timeZone: "Asia/Kolkata" },
    end: { dateTime: endLocal, timeZone: "Asia/Kolkata" },
    attendees,
    conferenceData: {
      createRequest: {
        requestId: `${booking.id}-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    guestsCanModify: false,
  };

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    calendarId
  )}/events?conferenceDataVersion=1&sendUpdates=all`;

  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventPayload),
  });
  const created = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(created?.error?.message || `Google Calendar API error (${res.status})`);
  }

  const meetUrl =
    created.hangoutLink ||
    created.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
    env.STATIC_MEET_URL ||
    "";

  return {
    created: true,
    eventId: created.id || "",
    htmlLink: created.htmlLink || "",
    meetUrl,
  };
}

/**
 * Sends confirmation email via free Gmail SMTP (App Password) to ayushbpl10@gmail.com & guest.
 */
export async function sendBookingNotificationEmail({
  booking,
  meetUrl,
  env = process.env,
  createTransportImpl = nodemailer.createTransport,
}) {
  const notifyEmail = env.BOOKING_NOTIFY_EMAIL || DEFAULT_NOTIFY_EMAIL;
  const gmailUser = env.GMAIL_USER || notifyEmail;
  const gmailPass = env.GMAIL_APP_PASSWORD || "";

  if (!gmailUser || !gmailPass) {
    return {
      sent: false,
      to: notifyEmail,
      reason: "GMAIL_APP_PASSWORD not configured in .env.",
    };
  }

  const transporter = createTransportImpl({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });

  const recipients = [notifyEmail];
  if (booking.email && booking.email.toLowerCase() !== notifyEmail.toLowerCase()) {
    recipients.push(booking.email);
  }

  const lines = [
    `New 1:1 Session Booking Confirmed (${booking.id})`,
    "",
    `Slot: ${booking.dateLabel || booking.dateStr} · 6:00 PM – 7:00 PM IST (Tuesday)`,
    `Focus Area: ${booking.topicTitle || "1:1 Architecture & Mentorship"}`,
    `Guest: ${booking.name} <${booking.email}>`,
    booking.profile ? `LinkedIn/GitHub: ${booking.profile}` : "",
    `Payment Reference: ${booking.utr || "Pending / UPI QR"}`,
    `Google Meet: ${meetUrl || "Pending — invite via Google Calendar"}`,
    "",
    "Agenda:",
    booking.agenda || "Not provided",
  ]
    .filter((line) => line !== "")
    .join("\n");

  await transporter.sendMail({
    from: `"Ayush Gupta Bookings" <${gmailUser}>`,
    to: notifyEmail,
    cc: booking.email && booking.email !== notifyEmail ? booking.email : undefined,
    replyTo: booking.email || notifyEmail,
    subject: `[1:1 Booking ${booking.id}] ${booking.dateLabel || booking.dateStr} 6 PM IST — ${booking.name}`,
    text: lines,
  });

  return {
    sent: true,
    to: recipients,
  };
}

/**
 * Coordinates Google Meet creation + Gmail notification cleanly with partial-failure resilience.
 */
export async function processBookingActions({ booking, env = process.env, fetchImpl = fetch, createTransportImpl }) {
  let meetResult = { created: false, meetUrl: env.STATIC_MEET_URL || "" };
  let emailResult = { sent: false };

  try {
    meetResult = await createGoogleMeetEvent({ booking, env, fetchImpl });
  } catch (err) {
    meetResult = {
      created: false,
      meetUrl: env.STATIC_MEET_URL || "",
      error: err.message,
    };
  }

  try {
    emailResult = await sendBookingNotificationEmail({
      booking,
      meetUrl: meetResult.meetUrl,
      env,
      createTransportImpl,
    });
  } catch (err) {
    emailResult = { sent: false, error: err.message };
  }

  return {
    meet_url: meetResult.meetUrl || "",
    calendar_event_created: Boolean(meetResult.created),
    calendar_event_link: meetResult.htmlLink || "",
    email_sent: Boolean(emailResult.sent),
    notify_email: env.BOOKING_NOTIFY_EMAIL || DEFAULT_NOTIFY_EMAIL,
    errors: [meetResult.error, emailResult.error].filter(Boolean),
  };
}
