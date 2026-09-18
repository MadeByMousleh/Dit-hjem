import { PricePoint } from "../prices";

export type EforsyningData = {
  period: { from: string | null; to: string | null };
  heating: { usedKwh: number | null; expectedKwh: number | null };
  water: { usedM3: number | null; expectedM3: number | null };
  temperatures: { forwardC: number | null; returnC: number | null; coolingC: number | null };
  fetchedAt: string;
};

export type TeslaVehicle = {
  id: string;
  vin: string;
  name: string;
  model: string;
  batteryLevel: number | null;
  chargingState: string | null;
  chargerPowerKw: number | null;
  timeToFullChargeHours: number | null;
  chargeEnergyAddedKwh: number | null;
};

export const DEVICE_TEMPLATES = [
  { kind: "dishwasher", name: "Opvaskemaskine", icon: "droplet" as const, energyKwh: 1, durationHours: 2 },
  { kind: "laundry", name: "Vaskemaskine", icon: "refresh-cw" as const, energyKwh: 0.8, durationHours: 2 },
  { kind: "dryer", name: "Tørretumbler", icon: "wind" as const, energyKwh: 2.5, durationHours: 2 },
  { kind: "ev", name: "Elbil", icon: "battery-charging" as const, energyKwh: 0, durationHours: 0 },
  { kind: "other", name: "Andet apparat", icon: "power" as const, energyKwh: 1, durationHours: 1 },
] as const;

export type DeviceKind = typeof DEVICE_TEMPLATES[number]["kind"];
export type EnergyClass = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type WashTemperature = 30 | 40 | 60 | 90;
export type HouseholdDevice = {
  id: number;
  kind: DeviceKind;
  name: string;
  icon: typeof DEVICE_TEMPLATES[number]["icon"];
  energyKwh: number;
  durationHours: number;
  batteryKwh: number;
  currentCharge: number;
  targetCharge: number;
  chargerKw: number;
  energyClass?: EnergyClass;
  temperature?: WashTemperature;
  registration?: string;
  vehicleModel?: string;
  showOnDashboard?: boolean;
};

export type PriceWindow = {
  cheapest: { startsAt: Date; cost: number };
  nowCost: number;
  savings: number;
};

export type PricePointList = PricePoint[];
