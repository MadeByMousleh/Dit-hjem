import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { EvModel } from "../evData";
import { PricePoint } from "../prices";
import { DEVICE_TEMPLATES, DeviceKind, HouseholdDevice } from "../types/app";
import { isEnergyClass } from "../utils/energyPlanning";

export const DEVICES_STORAGE_KEY = "stromblik.household-devices.v1";

type DeviceCardProps = { device: HouseholdDevice; points: PricePoint[]; now: number; evModels: EvModel[]; expanded: boolean; onToggle: () => void; onChange: (changes: Partial<HouseholdDevice>) => void; onRemove?: () => void; onToggleDashboard?: () => void };

export function FamilyPlanner({ points, now, evModels, styles, colors, DeviceCard }: { points: PricePoint[]; now: number; evModels: EvModel[]; styles: Record<string, any>; colors: { ink: string; muted: string; white: string; green: string }; DeviceCard: (props: DeviceCardProps) => React.ReactNode }) {
  const nextId = useRef(1);
  const [devices, setDevices] = useState<HouseholdDevice[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DEVICES_STORAGE_KEY).then((stored) => {
      if (!stored) return;
      const savedDevices = JSON.parse(stored) as HouseholdDevice[];
      if (!Array.isArray(savedDevices)) return;
      setDevices(savedDevices.map((device) => ({ ...device, energyClass: isEnergyClass(device.energyClass) ? device.energyClass : device.kind === "laundry" ? "A" : "B", temperature: device.temperature ?? 40 })));
      nextId.current = Math.max(0, ...savedDevices.map((device) => device.id)) + 1;
    }).catch(() => undefined).finally(() => setStorageReady(true));
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    void AsyncStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(devices));
  }, [devices, storageReady]);

  const addDevice = (kind: DeviceKind) => {
    const template = DEVICE_TEMPLATES.find((item) => item.kind === kind)!;
    const id = nextId.current++;
    setDevices((current) => {
      const matchingDevices = current.filter((device) => device.kind === kind).length;
      return [...current, { id, kind, name: matchingDevices ? `${template.name} ${matchingDevices + 1}` : template.name, icon: template.icon, energyKwh: template.energyKwh, durationHours: template.durationHours, batteryKwh: 60, currentCharge: 40, targetCharge: 80, chargerKw: 11, registration: "", vehicleModel: "", energyClass: kind === "laundry" ? "A" : "B", temperature: kind === "laundry" ? 40 : undefined }];
    });
    setExpandedId(id);
    setShowCatalog(false);
  };

  return (
    <View style={styles.plannerSection}>
      <View style={styles.plannerHeading}>
        <View><Text style={styles.eyebrow}>FAMILIEPLAN · NÆSTE 48 TIMER</Text><Text style={styles.sectionTitle}>Jeres apparater</Text></View>
        <Pressable accessibilityLabel={showCatalog ? "Luk tilføjelse" : "Tilføj apparat"} onPress={() => setShowCatalog((value) => !value)} style={[styles.addDeviceButton, showCatalog && styles.addDeviceButtonActive]}><Feather name={showCatalog ? "x" : "plus"} size={18} color={showCatalog ? colors.white : colors.ink} /><Text style={[styles.addDeviceText, showCatalog && styles.addDeviceTextActive]}>{showCatalog ? "Luk" : "Tilføj"}</Text></Pressable>
      </View>
      {showCatalog ? <View style={styles.deviceCatalog}><Text style={styles.catalogLabel}>HVAD VIL I PLANLÆGGE?</Text><View style={styles.catalogGrid}>{DEVICE_TEMPLATES.map((item) => <Pressable key={item.kind} accessibilityLabel={`Tilføj ${item.name}`} onPress={() => addDevice(item.kind)} style={styles.catalogItem}><View style={styles.catalogIcon}><Feather name={item.icon} size={20} color={colors.green} /></View><Text style={styles.catalogName}>{item.name}</Text><Feather name="plus-circle" size={17} color={colors.muted} /></Pressable>)}</View></View> : null}
      {!devices.length ? <Pressable accessibilityLabel="Tilføj første apparat" onPress={() => setShowCatalog(true)} style={styles.plannerEmpty}><View style={styles.emptyIcon}><Feather name="home" size={23} color={colors.green} /></View><Text style={styles.emptyTitle}>Tilføj familiens apparater</Text><Text style={styles.emptyText}>Så finder vi det billigste tidspunkt og den forventede pris for hver enkelt.</Text><View style={styles.emptyAction}><Feather name="plus" size={15} color={colors.white} /><Text style={styles.emptyActionText}>Kom i gang</Text></View></Pressable> : <View style={styles.deviceList}>{devices.map((device) => <DeviceCard key={device.id} device={device} points={points} now={now} evModels={evModels} expanded={expandedId === device.id} onToggle={() => setExpandedId((current) => current === device.id ? null : device.id)} onChange={(changes) => setDevices((current) => current.map((item) => item.id === device.id ? { ...item, ...changes } : item))} onToggleDashboard={() => setDevices((current) => current.map((item) => item.id === device.id ? { ...item, showOnDashboard: !item.showOnDashboard } : item))} onRemove={() => { setDevices((current) => current.filter((item) => item.id !== device.id)); if (expandedId === device.id) setExpandedId(null); }} />)}</View>}
    </View>
  );
}
