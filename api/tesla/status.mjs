import { createDecipheriv, createHash } from "node:crypto";

function session(request) {
	const secret = String(process.env.TESLA_CLIENT_SECRET ?? "").trim();
	const cookie = (request.headers.cookie ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith("tesla_session="))?.slice("tesla_session=".length);
	if (!secret || !cookie) return undefined;
	try {
		const [iv, authTag, encrypted] = decodeURIComponent(cookie).split(".").map((part) => Buffer.from(part, "base64url"));
		const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), iv);
		decipher.setAuthTag(authTag);
		return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
	} catch {
		return undefined;
	}
}

export default function status(request, response) {
	const token = session(request);
	response.statusCode = 200;
	response.setHeader("Content-Type", "application/json");
	response.setHeader("Cache-Control", "no-store");
	response.end(JSON.stringify({ connected: Boolean(token?.accessToken && Number(token.expiresAt) > Date.now()) }));
}
