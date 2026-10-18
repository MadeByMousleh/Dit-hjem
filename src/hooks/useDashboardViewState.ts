import { createContext, createElement, type ReactNode, useContext, useState } from 'react';
import type { UsageAggregation } from '../services/eloverblik';
import type { HeatPeriod } from '../utils/heatingChart';
import type { TemperaturePeriod } from '../utils/heatingTemperature';
import { usageToday } from '../utils/usagePeriods';
import { widgetShortcut, type ElectricityWidgetId } from '../utils/electricityWidgets';

export type DashboardTab = 'dashboard' | 'home' | 'electricity' | 'electricity-widgets' | 'smartthings' | 'appliances' | 'utilities' | 'car' | 'charger' | 'profile' | 'waste';
type ScrollTab = DashboardTab;

function useViewState() {
  const [activeTab, changeActiveTab] = useState<DashboardTab>('dashboard');
  const [widgetDestination, setWidgetDestination] = useState<ReturnType<typeof widgetShortcut> | null>(null);
  const setActiveTab = (tab: DashboardTab) => { setWidgetDestination(null); changeActiveTab(tab); };
  const [heatPeriod, setHeatPeriod] = useState<HeatPeriod>('month');
  const [heatDate, setHeatDate] = useState('');
  const [temperaturePeriod, setTemperaturePeriod] = useState<TemperaturePeriod>('month');
  const [temperatureDate, setTemperatureDate] = useState('');
  const [electricAggregation, setElectricAggregation] = useState<UsageAggregation>('Day');
  const [electricAnchor, setElectricAnchor] = useState(usageToday);
  const [scrollPositions, setScrollPositions] = useState<Record<ScrollTab, number>>({ dashboard: 0, waste: 0, home: 0, electricity: 0, 'electricity-widgets': 0, appliances: 0, smartthings: 0, utilities: 0, car: 0, charger: 0, profile: 0 });
  const rememberScroll = (tab: ScrollTab, offset: number) => {
    if (Number.isFinite(offset) && offset >= 0) setScrollPositions(previous => ({ ...previous, [tab]: offset }));
  };
  const openWidget = (id: ElectricityWidgetId, anchor?: string) => {
    const destination = widgetShortcut(id, anchor);
    setWidgetDestination(destination);
    if (destination.section === 'usage') {
      setElectricAggregation(destination.aggregation);
      setElectricAnchor(anchor ?? usageToday());
    }
    rememberScroll(destination.tab, 0);
    changeActiveTab(destination.tab);
  };

  return {
    activeTab, setActiveTab, widgetDestination, openWidget,
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
