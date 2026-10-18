import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { emptyWidgetPins, parseWidgetPins, type ElectricityWidgetId, type WidgetPins } from '../utils/electricityWidgets';
import { parseWidgetAppearances, type WidgetAppearance, type WidgetAppearances } from '../utils/widgetAppearance';

// Preferences only; household readings remain in the existing encrypted cache.
export function useElectricityWidgets(userId: string, householdId: string) {
  const key = userId && householdId ? `stromblik.widgets.v1.${userId}.${householdId}` : '';
  const [state, setState] = useState({ key: '', pins: emptyWidgetPins(), appearances: {} as WidgetAppearances, ready: false, saving: false, error: '' });
  const activeKey = useRef(key);
  activeKey.current = key;
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    setState({ key, pins: emptyWidgetPins(), appearances: {}, ready: false, saving: false, error: '' });
    if (key) void AsyncStorage.getItem(key).then(raw => {
      if (active) setState({ key, pins: parseWidgetPins(raw), appearances: parseWidgetAppearances(raw), ready: true, saving: false, error: '' });
    }).catch(() => {
      if (active) setState({ key, pins: emptyWidgetPins(), appearances: {}, ready: true, saving: false, error: 'Dine widgetvalg kunne ikke indlæses.' });
    });
    return () => { active = false; };
  }, [key]);
  const persist = async (next: WidgetPins, appearances = state.appearances) => {
    if (!key || state.key !== key || !state.ready || busy.current) return false;
    busy.current = true;
    setState(previous => ({ ...previous, saving: true, error: '' }));
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ ...next, appearances }));
      if (activeKey.current === key) setState({ key, pins: next, appearances, ready: true, saving: false, error: '' });
      return activeKey.current === key;
    } catch {
      if (activeKey.current === key) setState(previous => ({ ...previous, saving: false, error: 'Valget kunne ikke gemmes. Prøv igen.' }));
      return false;
    } finally { busy.current = false; }
  };
  const toggle = (location: keyof WidgetPins, id: ElectricityWidgetId) => persist({
    ...state.pins,
    [location]: state.pins[location].includes(id) ? state.pins[location].filter(item => item !== id) : [...state.pins[location], id],
  });
  const move = async (location: keyof WidgetPins, id: ElectricityWidgetId, direction: -1 | 1) => {
    const items = [...state.pins[location]], index = items.indexOf(id), target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target]!, items[index]!];
    await persist({ ...state.pins, [location]: items });
  };
  const reorder = async (location: keyof WidgetPins, order: ElectricityWidgetId[]) => {
    const previous = state.pins[location];
    if (order.length !== previous.length || new Set(order).size !== previous.length || !order.every(id => previous.includes(id))) return false;
    if (order.every((id, index) => id === previous[index])) return true;
    return persist({ ...state.pins, [location]: [...order] });
  };
  const customize = (id: ElectricityWidgetId, appearance: WidgetAppearance | null) => {
    const appearances = { ...state.appearances };
    if (appearance) appearances[id] = appearance;
    else delete appearances[id];
    return persist(state.pins, appearances);
  };
  return { ...state, pins: state.key === key ? state.pins : emptyWidgetPins(), appearances: state.key === key ? state.appearances : {}, ready: state.key === key && state.ready, toggle, move, reorder, customize };
}
