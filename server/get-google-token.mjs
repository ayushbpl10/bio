import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

/**
 * One-time CLI helper to obtain a Google OAuth2 refresh token for ayushbpl10@gmail.com
 * with Google Calendar + Google Meet creation scope (`https://www.googleapis.com/auth/calendar.events`).
 *
 * Usage:
 *   GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..." node get-google-token.mjs
 */
export function buildGoogleAuthUrl({ clientId, redirectUri }) {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  return authUrl.toString();
}

export function extractAuthCode(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.includes("code=")) {
    try {
      return new URL(trimmed).searchParams.get("code") || "";
    } catch {
      return "";
    }
  }
  return trimmed;
}

export async function exchangeAuthCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
  fetchImpl = fetch,
}) {
  const tokenRes = await fetchImpl("https://oauth2.googleapis.com/token", {
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
  return tokenRes.json();
}

export function startTokenHelper({
  env = process.env,
  fetchImpl = fetch,
  inStream = input,
  outStream = output,
  redirectPort = 8919,
  log = console.log,
} = {}) {
  const clientId = env.GOOGLE_CLIENT_ID || "";
  const clientSecret = env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri = `http://127.0.0.1:${redirectPort}/oauth2callback`;

  if (!clientId || !clientSecret) {
    return null;
  }

  log("\n1. Open this URL in your browser and sign in as ayushbpl10@gmail.com:\n");
  log(buildGoogleAuthUrl({ clientId, redirectUri }));
  log("\n2. Authorize Google Calendar access.");

  const rl = readline.createInterface({ input: inStream, output: outStream });
  const finishWithCode = async (code) => {
    const tokens = await exchangeAuthCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
      fetchImpl,
    });
    log("\nAdd this to your VM server/.env:\n");
    log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token || JSON.stringify(tokens)}`);
    rl.close();
    server.close();
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${redirectPort}`);
    const code = url.searchParams.get("code");
    if (!code) {
      res.end("Missing code parameter.");
      return;
    }
    res.end("Authorization received. You can close this tab and check your terminal.");
    await finishWithCode(code);
  });

  server.listen(redirectPort, "127.0.0.1", () => {
    log(`\nListening for OAuth callback on ${redirectUri} ...`);
    log("If running on a remote VM without localhost browser, paste the redirected ?code= value here and press Enter:");
  });

  rl.on("line", async (line) => {
    const code = extractAuthCode(line);
    if (!code) return;
    await finishWithCode(code);
  });

  return { server, rl };
}

export function runTokenCli(argv = process.argv, env = process.env, entryUrl = import.meta.url, logErr = console.error) {
  const entryHref = argv[1] ? pathToFileURL(path.resolve(argv[1])).href : "";
  if (entryUrl !== entryHref) return null;
  const started = startTokenHelper({ env });
  if (!started) {
    logErr("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.");
    process.exitCode = 1;
  }
  return started;
}

runTokenCli();
