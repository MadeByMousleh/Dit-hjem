import { TeslaVehicle } from "../types/app";

const API_URL = typeof window !== "undefined" && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(window.location.hostname)
  ? ""
  : "http://localhost:8787";

export async function getTeslaStatus() {
  const response = await fetch(`${API_URL}/api/tesla/status`);
  if (!response.ok) throw new Error(`Tesla status returned ${response.status}`);
  return response.json() as Promise<{ connected: boolean }>;
}

export async function getTeslaVehicles() {
  const response = await fetch(`${API_URL}/api/tesla/vehicles`);
  if (!response.ok) throw new Error(`Tesla vehicles returned ${response.status}`);
  const payload = await response.json() as { vehicles?: TeslaVehicle[] };
  return payload.vehicles ?? [];
}

export function getTeslaAuthorizationUrl() {
  return `${API_URL}/api/tesla/authorize`;
}
