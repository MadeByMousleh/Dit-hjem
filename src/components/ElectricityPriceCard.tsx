import { AppIcon } from './AppIcon';
import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../styles/theme";
import { useElectricityAgreements } from "../hooks/useElectricityAgreements";
import { UsageDatePicker } from "./UsageDatePicker";
import { usageToday } from "../utils/usagePeriods";
type Draft = { supplierId: string; supplierName: string; priceType: "spot" | "fixed"; markupOre: string; subscription: string; startDate: string; fixedOre: string };

const suppliers = [
  ["altid-energi", "Altid Energi"], ["andel-energi", "Andel Energi"], ["aura-energi", "AURA Energi"], ["b-energy", "b.energy"], ["beof", "Bornholms Energi & Forsyning"], ["budget-energi", "Budget Energi"], ["cheap-energy", "Cheap Energy"], ["clever-power", "Clever Power"], ["dansk-energiforsyning", "Dansk Energiforsyning"], ["dcc-energi", "DCC Energi"], ["energi-fyn", "Energi Fyn"], ["energi-viborg", "Energi Viborg"], ["energiselskabet-elg", "Energiselskabet Elg"], ["energix", "EnergiX"], ["energy-nordic", "Energy Nordic"], ["enkel-energi", "Enkel Energi"], ["ewii", "EWII"], ["fair-stroem", "Fair Strøm"], ["forsyning-helsingoer", "Forsyning Helsingør"], ["gasel", "Gasel"], ["gev-elhandel", "GEV Elhandel"], ["goenergi", "go'energi"], ["greenbow", "Greenbow"], ["jysk-energi", "Jysk Energi"], ["kaernfull-energi", "Kärnfull Energi"], ["modstroem", "Modstrøm"], ["nettopower", "NettoPower"], ["nordisk-energi", "Nordisk Energi"], ["norlys", "Norlys"], ["nrgi", "NRGi"], ["ok", "OK Energi"], ["samstroem", "Samstrøm"], ["sef-energi", "SEF Energi"], ["sk-energi", "SK Energi"], ["struer-energi", "Struer Energi"], ["stroemlinet", "Strømlinet"], ["velkommen", "Velkommen"], ["verdo", "Verdo"], ["vestforsyning", "Vestforsyning"], ["vindstoed", "Vindstød"], ["zapp-energy", "Zapp Energy"], ["other", "Andet / Indtast selv"],
] as const;

export function ElectricityPriceCard({ householdId, agreements }: { householdId: string; agreements: ReturnType<typeof useElectricityAgreements> }) {
  const defaultDate = usageToday().slice(0, 7) + "-01";
  const displayDate = (value: string) => new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value + "T12:00:00"));
  const current = agreements.records.find(record => !record.date_to);
  const [plan, setPlan] = useState<Draft>({ supplierId: "", supplierName: "", priceType: "spot", markupOre: "", subscription: "", startDate: defaultDate, fixedOre: "" });
  const [editing, setEditing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false); const [query, setQuery] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  useEffect(() => {
    if (current) {
      setPlan({ supplierId: current.supplier_id, supplierName: current.supplier_name, priceType: current.price_type,
        markupOre: String(current.markup_ore), subscription: String(current.subscription_dkk), fixedOre: current.fixed_ore === null ? "" : String(current.fixed_ore), startDate: current.date_from });
      setEditing(false);
    }
  }, [current]);
  const filtered = useMemo(() => suppliers.filter(([, name]) => name.toLowerCase().includes(query.toLowerCase())), [query]);
  const update = (changes: Partial<Draft>) => { setPlan(previous => ({ ...previous, ...changes })); setError(""); };
  async function save() {
    const amount = (text: string) => /^\d+(?:[.,]\d+)?$/.test(text.trim()) ? Number(text.trim().replace(",", ".")) : NaN;
    const markup = plan.priceType === "fixed" ? 0 : amount(plan.markupOre), subscription = amount(plan.subscription), fixed = amount(plan.fixedOre);
    if (!plan.supplierId || !plan.supplierName.trim()) { setError("Vælg et elselskab og indtast navnet."); return; }
    if (![markup, subscription, ...(plan.priceType === "fixed" ? [fixed] : [])].every(value => Number.isFinite(value) && value >= 0 && value <= 1000000)) {
      setError("Indtast gyldige priser på mindst 0. Brug 0, hvis du ikke betaler tillæg eller abonnement."); return;
    }
    setSaving(true); setError("");
    try {
      await agreements.save({ supplier_id: plan.supplierId, supplier_name: plan.supplierName.trim(),
        price_type: plan.priceType, fixed_ore: plan.priceType === "fixed" ? fixed : null,
        markup_ore: markup, subscription_dkk: subscription, date_from: plan.startDate });
      setEditing(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Aftalen kunne ikke gemmes. Prøv igen."); }
    finally { setSaving(false); }
  }
  const selected = plan.supplierName || "Vælg elselskab";
  return <View style={s.card}>
    <View style={s.heading}><View style={s.icon}><AppIcon name="zap" size={18} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={s.title}>Hvad betaler du for strøm?</Text><Text style={s.subtitle}>{current && !editing ? current.supplier_name : "Gem priserne fra din elaftale."}</Text></View>
      {!editing ? <Pressable accessibilityRole="button" accessibilityLabel="Rediger elaftale" onPress={() => setEditing(true)} style={s.edit}><AppIcon name="edit-2" size={18} color={colors.primary} /></Pressable> : null}
    </View>
    {!editing && current ? <View style={{ marginTop: 14 }}>
      <Text style={s.selectText}>{current.price_type === "fixed" ? `Fast pris: ${Number(current.fixed_ore) + Number(current.markup_ore)} øre/kWh` : `Spotpris + ${current.markup_ore} øre/kWh`}</Text>
      <Text style={s.note}>{current.subscription_dkk} kr./md. · Fra {displayDate(current.date_from)}</Text>
    </View> : <>
    <View pointerEvents={saving || agreements.loading ? "none" : "auto"}>
    <Text style={s.label}>DIT ELSELSKAB</Text>
    <Pressable onPress={() => setOpen(true)} style={s.select}><Text style={[s.selectText, !plan.supplierName && s.placeholder]}>{selected}</Text><AppIcon name="chevron-down" size={18} color={colors.muted} /></Pressable>
    {plan.supplierId === "other" ? <TextInput value={plan.supplierName} onChangeText={(value) => update({ supplierName: value })} placeholder="Skriv elselskabets navn" placeholderTextColor={colors.muted} style={s.input} /> : null}
    <Text style={s.label}>DIN PRISTYPE</Text><View style={s.choices}>{([["spot", "Spotpris"], ["fixed", "Fast pris pr. kWh"]] as const).map(([value, label]) => <Pressable key={value} onPress={() => update({ priceType: value })} style={[s.choice, plan.priceType === value && s.choiceActive]}><Text style={[s.choiceText, plan.priceType === value && s.choiceTextActive]}>{label}</Text></Pressable>)}</View>
    {plan.priceType === "fixed" ? <><Text style={s.label}>FAST ELPRIS · ØRE/kWh</Text><TextInput accessibilityLabel="Fast elpris i øre pr. kWh" value={plan.fixedOre} onChangeText={value => update({ fixedOre: value })} keyboardType="decimal-pad" placeholder="Fx 85,50" style={s.input} /></> : null}
    <View style={s.row}>
      {plan.priceType === "spot" ? <View style={s.field}><Text style={s.label}>TILLÆG PR. kWh</Text><View style={s.inputWrap}><TextInput value={plan.markupOre} onChangeText={(value) => update({ markupOre: value })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} style={s.number} /><Text style={s.suffix}>øre</Text></View></View> : null}
      <View style={s.field}><Text style={s.label}>ABONNEMENT</Text><View style={s.inputWrap}><TextInput value={plan.subscription} onChangeText={(value) => update({ subscription: value })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} style={s.number} /><Text style={s.suffix}>kr./md.</Text></View></View>
    </View>
    <Text style={s.label}>SIDEN HVORNÅR HAR DU SELSKABET?</Text>
    <Pressable onPress={() => setCalendarOpen(true)} style={s.select}><Text style={s.selectText}>{displayDate(plan.startDate)}</Text><AppIcon name="calendar" size={17} color={colors.primary} /></Pressable>
    <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 8, marginLeft: 2, paddingRight: 8 }}>Ved skift gemmes din tidligere aftale frem til den nye startdato.</Text>
    <Text style={s.note}>Indtast priser inkl. moms, uden nettariffer og afgifter. Ved ændringer vælger du datoen, hvor de nye priser gælder fra.</Text>
    </View>
    {!householdId ? <Text style={s.note}>Log ind på din husstand ovenfor for at gemme elaftalen.</Text> : null}
    {agreements.error || error ? <Text accessibilityRole="alert" style={[s.note, { color: colors.coral }]}>{error || agreements.error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={!householdId || agreements.loading || saving || !!agreements.error} onPress={() => void save()} style={[s.save, (!householdId || agreements.loading || saving || !!agreements.error) && { opacity: 0.5 }]}><Text style={s.saveText}>{saving ? "Gemmer…" : agreements.loading ? "Henter aftale…" : "Gem elaftale"}</Text></Pressable>
    {current ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setPlan({ supplierId: current.supplier_id, supplierName: current.supplier_name, priceType: current.price_type, markupOre: String(current.markup_ore), subscription: String(current.subscription_dkk), startDate: current.date_from, fixedOre: current.fixed_ore === null ? "" : String(current.fixed_ore) }); setEditing(false); setError(""); }} style={s.edit}><Text style={s.subtitle}>Annuller</Text></Pressable> : null}
    </>}
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><View style={s.backdrop}><View style={s.modal}><View style={s.modalHeader}><Text style={s.modalTitle}>Vælg elselskab</Text><Pressable onPress={() => setOpen(false)}><AppIcon name="x" size={22} color={colors.ink} /></Pressable></View><TextInput value={query} onChangeText={setQuery} placeholder="Søg efter selskab" placeholderTextColor={colors.muted} style={s.input} /><FlatList data={filtered} keyExtractor={([id]) => id} renderItem={({ item: [id, name] }) => <Pressable style={s.option} onPress={() => { update({ supplierId: id, supplierName: id === "other" ? "" : name }); setOpen(false); setQuery(""); }}><Text style={s.optionText}>{name}</Text>{plan.supplierId === id ? <AppIcon name="check" size={17} color={colors.primary} /> : null}</Pressable>} /></View></View></Modal>
    {calendarOpen ? <UsageDatePicker aggregation="Hour" anchor={plan.startDate} years={Array.from({ length: Number(usageToday().slice(0, 4)) - 1999 }, (_, i) => 2000 + i)} onClose={() => setCalendarOpen(false)} onSelect={date => { update({ startDate: date }); setCalendarOpen(false); }} /> : null}
  </View>;
}
const s = StyleSheet.create({
  edit: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  save: { minHeight: 46, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: 23, marginTop: 18 },
  saveText: { fontFamily: "Nunito_700Bold", color: colors.white, fontSize: 13 },
  card: { padding: 24, marginBottom: 24, borderRadius: 24, backgroundColor: colors.white }, heading: { flexDirection: "row", alignItems: "center", gap: 12 }, icon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft }, title: { fontFamily: "Nunito_700Bold", fontSize: 17, color: colors.ink, letterSpacing: -0.2 }, subtitle: { fontFamily: "Nunito_500Medium", fontSize: 10, color: colors.muted, marginTop: 3 }, label: { fontFamily: "Nunito_700Bold", fontSize: 9, color: colors.muted, marginTop: 17, marginBottom: 7 }, select: { minHeight: 46, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, selectText: { fontFamily: "Nunito_500Medium", fontSize: 13, color: colors.ink }, placeholder: { color: colors.muted }, choices: { flexDirection: "row", gap: 8 }, choice: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 11, borderWidth: 1, borderColor: colors.line }, choiceActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, choiceText: { fontFamily: "Nunito_500Medium", fontSize: 12, color: colors.muted }, choiceTextActive: { fontFamily: "Nunito_700Bold", color: colors.primary }, row: { flexDirection: "row", gap: 10 }, field: { flex: 1 }, input: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 12, color: colors.ink, marginTop: 8 }, inputWrap: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: "row", alignItems: "center", paddingHorizontal: 10 }, number: { flex: 1, color: colors.ink, paddingVertical: 10 }, suffix: { fontFamily: "Nunito_400Regular", fontSize: 10, color: colors.muted }, note: { fontFamily: "Nunito_400Regular", fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 13 }, backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(60,50,70,0.28)" }, modal: { maxHeight: "85%", backgroundColor: colors.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18 }, modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, modalTitle: { fontFamily: "Nunito_600SemiBold", fontSize: 23, color: colors.ink }, option: { minHeight: 48, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.white, borderRadius: 10, marginTop: 7 }, optionText: { fontFamily: "Nunito_500Medium", fontSize: 13, color: colors.ink }, });
