import { useEffect, useState } from "react";
import { loadDevices, saveDevices } from "../services/storage";
import { HouseholdDevice } from "../types/app";

export function useQuickDevices(refreshKey: string) {
  const [devices, setDevices] = useState<HouseholdDevice[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    loadDevices().then((savedDevices) => {
      if (savedDevices) setDevices(savedDevices);
    }).catch(() => undefined);
  }, [refreshKey]);

  const updateDevice = (id: number, changes: Partial<HouseholdDevice>) => {
    setDevices((current) => {
      const next = current.map((device) => device.id === id ? { ...device, ...changes } : device);
      void saveDevices(next);
      return next;
    });
  };

  const toggleExpanded = (id: number) => {
    setExpandedId((current) => current === id ? null : id);
  };

  return { devices, expandedId, toggleExpanded, updateDevice };
}
