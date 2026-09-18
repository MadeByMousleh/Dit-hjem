import { createDecipheriv, createHash } from "node:crypto";

const teslaApiUrl = "https://fleet-api.prd.eu.vn.cloud.tesla.com";

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

export default async function vehicles(request, response) {
	try {
		const token = session(request);
		if (!token?.accessToken || Number(token.expiresAt) <= Date.now()) {
			response.statusCode = 401;
			response.setHeader("Content-Type", "application/json");
			response.end(JSON.stringify({ error: "Tesla-login kræves" }));
			return;
		}
		const headers = { Accept: "application/json", Authorization: `Bearer ${token.accessToken}` };
		const vehiclesResponse = await fetch(`${teslaApiUrl}/api/1/vehicles`, { headers });
		const vehiclesPayload = await vehiclesResponse.json();
		if (!vehiclesResponse.ok) throw new Error(`Tesla-køretøjer svarede med ${vehiclesResponse.status}`);
		const vehicle = vehiclesPayload.response?.[0];
		if (!vehicle?.vin) {
			response.statusCode = 200;
			response.setHeader("Content-Type", "application/json");
			response.end(JSON.stringify({ vehicles: [] }));
			return;
		}
		const dataResponse = await fetch(`${teslaApiUrl}/api/1/vehicles/${encodeURIComponent(vehicle.vin)}/vehicle_data`, { headers });
		const dataPayload = await dataResponse.json();
		if (!dataResponse.ok) throw new Error(`Tesla-status svarede med ${dataResponse.status}`);
		const data = dataPayload.response ?? dataPayload;
		const charge = data.charge_state ?? {};
		response.statusCode = 200;
		response.setHeader("Content-Type", "application/json");
		response.setHeader("Cache-Control", "no-store");
		response.end(JSON.stringify({ vehicles: [{ id: String(vehicle.id ?? vehicle.vin), vin: vehicle.vin, name: vehicle.display_name ?? "Tesla", model: data.vehicle_config?.car_type ?? vehicle.display_name ?? "Tesla", batteryLevel: Number.isFinite(charge.battery_level) ? charge.battery_level : null, chargingState: charge.charging_state ?? null, chargerPowerKw: Number.isFinite(charge.charger_power) ? charge.charger_power : null, timeToFullChargeHours: Number.isFinite(charge.time_to_full_charge) ? charge.time_to_full_charge : null, chargeEnergyAddedKwh: Number.isFinite(charge.charge_energy_added) ? charge.charge_energy_added : null }] }));
	} catch (error) {
		response.statusCode = 502;
		response.setHeader("Content-Type", "application/json");
		response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Tesla-data kunne ikke hentes" }));
	}
}
