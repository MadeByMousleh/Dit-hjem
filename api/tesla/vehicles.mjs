import { createDecipheriv, createHash } from "node:crypto";

const teslaApiUrl = "https://fleet-api.prd.eu.vn.cloud.tesla.com";

const milesToKm = 1.609344;

function numberOrNull(value) {
	return Number.isFinite(value) ? Number(value) : null;
}

function kmFromMiles(value) {
	return Number.isFinite(value) ? Number(value) * milesToKm : null;
}

function modelNameFromCode(code, fallback) {
	const value = String(code ?? "").toLowerCase();
	if (value === "model3" || value === "model_3") return "Model 3";
	if (value === "models" || value === "model_s") return "Model S";
	if (value === "modelx" || value === "model_x") return "Model X";
	if (value === "modely" || value === "model_y") return "Model Y";
	if (!value) return fallback;
	return value.replace("model", "Model ").replace("_", " ").trim();
}

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
		const vehicleConfig = data.vehicle_config ?? {};
		const vehicleState = data.vehicle_state ?? {};
		const climateState = data.climate_state ?? {};
		const driveState = data.drive_state ?? {};
		const displayModel = modelNameFromCode(vehicleConfig.car_type, vehicle.display_name ?? "Tesla");
		response.statusCode = 200;
		response.setHeader("Content-Type", "application/json");
		response.setHeader("Cache-Control", "no-store");
		response.end(JSON.stringify({
			vehicles: [{
				id: String(vehicle.id ?? vehicle.vin),
				vin: vehicle.vin,
				name: vehicle.display_name ?? "Tesla",
				model: displayModel,
				trim: vehicleConfig.trim_badging ?? null,
				exteriorColor: vehicleConfig.exterior_color ?? null,
				wheelType: vehicleConfig.wheel_type ?? null,
				spoilerType: vehicleConfig.spoiler_type ?? null,
				carVersion: vehicleState.car_version ?? null,
				batteryLevel: numberOrNull(charge.battery_level),
				batteryRangeKm: kmFromMiles(charge.battery_range),
				estimatedBatteryRangeKm: kmFromMiles(charge.est_battery_range),
				chargeLimitSoc: numberOrNull(charge.charge_limit_soc),
				chargingState: charge.charging_state ?? null,
				chargePortDoorOpen: typeof charge.charge_port_door_open === "boolean" ? charge.charge_port_door_open : null,
				isPreconditioning: typeof climateState.is_preconditioning === "boolean" ? climateState.is_preconditioning : null,
				chargerPowerKw: numberOrNull(charge.charger_power),
				chargerVoltage: numberOrNull(charge.charger_voltage),
				chargerActualCurrentA: numberOrNull(charge.charger_actual_current),
				timeToFullChargeHours: numberOrNull(charge.time_to_full_charge),
				chargeEnergyAddedKwh: numberOrNull(charge.charge_energy_added),
				odometerKm: kmFromMiles(vehicleState.odometer),
				locked: typeof vehicleState.locked === "boolean" ? vehicleState.locked : null,
				sentryMode: typeof vehicleState.sentry_mode === "boolean" ? vehicleState.sentry_mode : null,
				insideTempC: numberOrNull(climateState.inside_temp),
				outsideTempC: numberOrNull(climateState.outside_temp),
				latitude: numberOrNull(driveState.latitude),
				longitude: numberOrNull(driveState.longitude),
				speedKmh: kmFromMiles(driveState.speed),
				shiftState: driveState.shift_state ?? null,
				fetchedAt: new Date().toISOString(),
			}],
		}));
	} catch (error) {
		response.statusCode = 502;
		response.setHeader("Content-Type", "application/json");
		response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Tesla-data kunne ikke hentes" }));
	}
}
