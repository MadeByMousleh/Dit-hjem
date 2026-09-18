const apiBaseUrl = "https://fleet-api.prd.eu.vn.cloud.tesla.com";
const authUrl = "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token";
const domain = String(process.env.TESLA_APP_DOMAIN ?? "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
const clientId = String(process.env.TESLA_CLIENT_ID ?? "").trim();
const clientSecret = String(process.env.TESLA_CLIENT_SECRET ?? "").trim();

if (!domain || domain === "app.example.com") throw new Error("Set TESLA_APP_DOMAIN to the root domain configured in the Tesla Developer Dashboard");
if (!clientId) throw new Error("Set TESLA_CLIENT_ID in .env");
if (!clientSecret) throw new Error("Set TESLA_CLIENT_SECRET in .env");

const tokenResponse = await fetch(authUrl, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    audience: apiBaseUrl,
    scope: "openid vehicle_device_data vehicle_cmds vehicle_charging_cmds",
  }),
});
const tokenText = await tokenResponse.text();
if (!tokenResponse.ok) throw new Error(`Tesla partner-token request failed (${tokenResponse.status}): ${tokenText}`);
const tokenPayload = JSON.parse(tokenText);
const partnerToken = tokenPayload.access_token;
if (!partnerToken) throw new Error("Tesla partner-token response did not contain access_token");

const headers = {
  Accept: "application/json",
  Authorization: `Bearer ${partnerToken}`,
  "Content-Type": "application/json",
};

const registration = await fetch(`${apiBaseUrl}/api/1/partner_accounts`, {
  method: "POST",
  headers,
  body: JSON.stringify({ domain }),
});
const registrationText = await registration.text();
if (!registration.ok) throw new Error(`Tesla registration failed (${registration.status}): ${registrationText}`);
console.log(`Tesla partner account registered for ${domain}.`);

const verification = await fetch(`${apiBaseUrl}/api/1/partner_accounts/public_key?domain=${encodeURIComponent(domain)}`, { headers });
const verificationText = await verification.text();
if (!verification.ok) throw new Error(`Tesla registration verification failed (${verification.status}): ${verificationText}`);
console.log(`Tesla public-key verification succeeded for ${domain}.`);
