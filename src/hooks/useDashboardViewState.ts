import {isPausedHomeTab} from '../utils/pausedHomeFeatures';
import { createContext, createElement, type ReactNode, useContext, useRef, useState } from 'react';
import type { UsageAggregation } from '../services/eloverblik';
import type { HeatPeriod } from '../utils/heatingChart';
import type { TemperaturePeriod } from '../utils/heatingTemperature';
import { usageToday } from '../utils/usagePeriods';
import { widgetShortcut, type ElectricityWidgetId } from '../utils/electricityWidgets';

export type DashboardTab = 'dashboard' | 'home' | 'property' | 'electricity' | 'electricity-widgets' | 'smartthings' | 'appliances' | 'utilities' | 'car' | 'charger' | 'profile' | 'waste' | 'family';
type ScrollTab = DashboardTab;

function useViewState() {
  const [activeTab, changeActiveTab] = useState<DashboardTab>('dashboard');
  const [widgetDestination, setWidgetDestination] = useState<ReturnType<typeof widgetShortcut> | null>(null);
  const setActiveTab = (tab: DashboardTab) => { setWidgetDestination(null); changeActiveTab(isPausedHomeTab(tab) ? 'home' : tab); };
  const [heatPeriod, setHeatPeriod] = useState<HeatPeriod>('month');
  const [heatDate, setHeatDate] = useState('');
  const [temperaturePeriod, setTemperaturePeriod] = useState<TemperaturePeriod>('month');
  const [temperatureDate, setTemperatureDate] = useState('');
  const [electricAggregation, setElectricAggregation] = useState<UsageAggregation>('Day');
  const [electricAnchor, setElectricAnchor] = useState(usageToday);
  // Restoration metadata is read when a screen mounts, never painted. Updating
  // it during scrolling must not render every chart/context consumer.
  const scrollPositions = useRef<Record<ScrollTab, number>>({ dashboard: 0, waste: 0, family:0, home: 0, property: 0, electricity: 0, 'electricity-widgets': 0, appliances: 0, smartthings: 0, utilities: 0, car: 0, charger: 0, profile: 0 }).current;
  const rememberScroll = (tab: ScrollTab, offset: number) => {
    if (Number.isFinite(offset) && offset >= 0) scrollPositions[tab] = offset;
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
