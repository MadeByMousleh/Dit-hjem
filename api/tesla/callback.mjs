import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

const teslaAuthUrl =
  "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token";
const teslaApiUrl = "https://fleet-api.prd.eu.vn.cloud.tesla.com";

function cookies(request) {
  return Object.fromEntries(
    (request.headers.cookie ?? "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([name, value]) => name && value)
      .map(([name, ...value]) => [name, decodeURIComponent(value.join("="))]),
  );
}

function sessionCookie(tokens, secret) {
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(tokens), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((value) => value.toString("base64url"))
    .join(".");
}

export default async function callback(request, response) {
  try {
    const clientId = String(process.env.TESLA_CLIENT_ID ?? "").trim();
    const clientSecret = String(process.env.TESLA_CLIENT_SECRET ?? "").trim();
    const domain = String(process.env.TESLA_APP_DOMAIN ?? "")
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    const redirectUri =
      process.env.TESLA_REDIRECT_URI ?? `https://${domain}/callback`;
    const url = new URL(request.url ?? "/", `https://${domain}`);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state") ?? "";
    const [state, signature] = returnedState.split(".");
    const expectedState = cookies(request).tesla_oauth_state;
    const expectedSignature = state
      ? createHmac("sha256", clientSecret).update(state).digest("base64url")
      : "";
    if (
      !clientId ||
      !clientSecret ||
      !domain ||
      !code ||
      !state ||
      state !== expectedState ||
      signature !== expectedSignature
    )
      throw new Error("Tesla-login kunne ikke valideres");

    const tokenResponse = await fetch(teslaAuthUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        audience: teslaApiUrl,
      }),
    });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.access_token)
      throw new Error("Tesla-token kunne ikke hentes");
    const session = sessionCookie(
      {
        accessToken: tokenPayload.access_token,
        refreshToken: tokenPayload.refresh_token,
        expiresAt: Date.now() + Number(tokenPayload.expires_in ?? 3600) * 1000,
      },
      clientSecret,
    );
    response.statusCode = 302;
    response.setHeader("Location", "/?tesla=connected");
    response.setHeader(
      "Set-Cookie",
      `tesla_session=${encodeURIComponent(session)}; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure; Path=/`,
    );
    response.end();
  } catch (error) {
    response.statusCode = 400;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(
      `<h1>Tesla-login mislykkedes</h1><p>${error instanceof Error ? error.message : "Prøv igen"}</p>`,
    );
  }
}
