import { useState } from 'react';
import * as Crypto from 'expo-crypto';
import { useEnergyVault } from '../components/EnergyVaultGate';
import { usageToday } from '../utils/usagePeriods';
export type ElectricityAgreement = {
  id: string; household_id: string; supplier_id: string; supplier_name: string;
  price_type: 'spot' | 'fixed'; fixed_ore: number | null; markup_ore: number;
  subscription_dkk: number; date_from: string; date_to: string | null;
};
export type AgreementInput = Omit<ElectricityAgreement, 'id' | 'household_id' | 'date_to'>;
export function useElectricityAgreements(householdId: string) {
  const vault = useEnergyVault();
  const [records, setRecords] = useState(vault.data.agreements);
  async function save(input: AgreementInput) {
    const expected = records.find(record => !record.date_to)?.id ?? null;
    await vault.mutate(data => {
      const current = data.agreements.find(record => !record.date_to);
      if ((current?.id ?? null) !== expected) throw new Error('Aftalen er ændret på en anden enhed. Synkroniser og prøv igen.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date_from) || !Number.isFinite(Date.parse(input.date_from)) || new Date(input.date_from).toISOString().slice(0,10) !== input.date_from || input.date_from > usageToday()) throw new Error('Vælg en gyldig startdato senest i dag.');
      if (current && Object.entries(input).every(([field, value]) => current[field as keyof ElectricityAgreement] === value)) return data;
      if (current && input.date_from <= current.date_from) throw new Error('En ny aftale skal starte efter den nuværende aftales startdato.');
      if (!input.supplier_name.trim() || !input.supplier_id || ![input.markup_ore,input.subscription_dkk,...(input.price_type === 'fixed' ? [input.fixed_ore] : [])].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000000)) throw new Error('Kontrollér leverandør og priser.');
      if (current) current.date_to = input.date_from;
      data.agreements.push({ ...input, id: Crypto.randomUUID(), household_id: householdId, date_to: null });
      return data;
    });
    setRecords(vault.data.agreements);
  }
  async function refresh() { await vault.refresh(); setRecords(vault.data.agreements); }
  return { records, loading: false, error: '', save, refresh };
}
