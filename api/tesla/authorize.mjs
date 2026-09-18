import { createHmac, randomBytes } from "node:crypto";

const teslaAuthUrl = "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/authorize";

export default function authorize(request, response) {
	try {
		const clientId = String(process.env.TESLA_CLIENT_ID ?? "").trim();
		const clientSecret = String(process.env.TESLA_CLIENT_SECRET ?? "").trim();
		const domain = String(process.env.TESLA_APP_DOMAIN ?? "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
		if (!clientId || !clientSecret || !domain) {
			response.statusCode = 503;
			response.setHeader("Content-Type", "application/json");
			response.end(JSON.stringify({ error: "Tesla OAuth is not configured" }));
			return;
		}

		const state = randomBytes(24).toString("base64url");
		const signature = createHmac("sha256", clientSecret).update(state).digest("base64url");
		const redirectUri = process.env.TESLA_REDIRECT_URI ?? `https://${domain}/callback`;
		const authorization = new URL(teslaAuthUrl);
		authorization.search = new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: "openid user_data vehicle_device_data vehicle_cmds vehicle_charging_cmds",
			state: `${state}.${signature}`,
		}).toString();

		response.statusCode = 302;
		response.setHeader("Location", authorization.toString());
		response.setHeader("Set-Cookie", `tesla_oauth_state=${encodeURIComponent(state)}; HttpOnly; SameSite=Lax; Max-Age=600; Secure; Path=/`);
		response.end();
	} catch {
		response.statusCode = 500;
		response.setHeader("Content-Type", "application/json");
		response.end(JSON.stringify({ error: "Tesla authorization could not be started" }));
	}
}
