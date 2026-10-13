import { createContext, createElement, type ReactNode, useContext, useState } from 'react';
import type { UsageAggregation } from '../services/eloverblik';
import type { HeatPeriod } from '../utils/heatingChart';
import type { TemperaturePeriod } from '../utils/heatingTemperature';
import { usageToday } from '../utils/usagePeriods';

export type DashboardTab = 'dashboard' | 'home' | 'electricity' | 'appliances' | 'utilities' | 'car' | 'profile' | 'waste';
type ScrollTab = DashboardTab;

function useViewState() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');
  const [heatPeriod, setHeatPeriod] = useState<HeatPeriod>('month');
  const [heatDate, setHeatDate] = useState('');
  const [temperaturePeriod, setTemperaturePeriod] = useState<TemperaturePeriod>('month');
  const [temperatureDate, setTemperatureDate] = useState('');
  const [electricAggregation, setElectricAggregation] = useState<UsageAggregation>('Day');
  const [electricAnchor, setElectricAnchor] = useState(usageToday);
  const [scrollPositions, setScrollPositions] = useState<Record<ScrollTab, number>>({ dashboard: 0, waste: 0, home: 0, electricity: 0, appliances: 0, utilities: 0, car: 0, profile: 0 });
  const rememberScroll = (tab: ScrollTab, offset: number) => {
    if (Number.isFinite(offset) && offset >= 0) setScrollPositions(previous => ({ ...previous, [tab]: offset }));
  };

  return {
    activeTab, setActiveTab,
    heatPeriod, setHeatPeriod, heatDate, setHeatDate,
    temperaturePeriod, setTemperaturePeriod, temperatureDate, setTemperatureDate,
    electricAggregation, setElectricAggregation, electricAnchor, setElectricAnchor,
    scrollPositions, rememberScroll,
  };
}

const ViewStateContext = createContext<ReturnType<typeof useViewState> | null>(null);
export function DashboardViewStateProvider({ children }: { children: ReactNode }) {
  const state = useViewState();
  return createElement(ViewStateContext.Provider, { value: state }, children);
}
export function useDashboardViewState() {
  const state = useContext(ViewStateContext);
  if (!state) throw new Error('DashboardViewStateProvider mangler.');
  return state;
}
