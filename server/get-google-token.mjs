import http from "node:http";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

/**
 * One-time CLI helper to obtain a Google OAuth2 refresh token for ayushbpl10@gmail.com
 * with Google Calendar + Google Meet creation scope (`https://www.googleapis.com/auth/calendar.events`).
 *
 * Usage:
 *   GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..." node get-google-token.mjs
 */

const clientId = process.env.GOOGLE_CLIENT_ID || "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const redirectPort = 8919;
const redirectUri = `http://127.0.0.1:${redirectPort}/oauth2callback`;

if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events");
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\n1. Open this URL in your browser and sign in as ayushbpl10@gmail.com:\n");
console.log(authUrl.toString());
console.log("\n2. Authorize Google Calendar access.");

const rl = readline.createInterface({ input, output });
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${redirectPort}`);
  const code = url.searchParams.get("code");
  if (!code) {
    res.end("Missing code parameter.");
    return;
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  const tokens = await tokenRes.json();
  res.end("Authorization received. You can close this tab and check your terminal.");
  console.log("\nAdd this to your VM server/.env:\n");
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token || "(missing — ensure prompt=consent)"}`);
  rl.close();
  server.close();
});

server.listen(redirectPort, "127.0.0.1", () => {
  console.log(`\nListening for OAuth callback on ${redirectUri} ...`);
  console.log("If running on a remote VM without localhost browser, paste the redirected ?code= value here and press Enter:");
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  const code = trimmed.includes("code=") ? new URL(trimmed).searchParams.get("code") : trimmed;
  if (!code) return;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  const tokens = await tokenRes.json();
  console.log("\nAdd this to your VM server/.env:\n");
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token || JSON.stringify(tokens)}`);
  rl.close();
  server.close();
});
