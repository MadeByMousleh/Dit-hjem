import {validPriceLimits,type PriceLimits} from './priceLimits';
import { colors } from '../styles/theme';
import { electricityWidgetIds, type ElectricityWidgetId } from './electricityWidgets';
import type { WidgetSpan } from './widgetDrag';

export const widgetBackgrounds = [
  { id: 'default', label: 'Standard', color: colors.white },
  { id: 'blue', label: 'Lyseblå', color: '#E4EFFB' },
  { id: 'violet', label: 'Lavendel', color: '#EEE8FA' },
  { id: 'green', label: 'Salvie', color: '#E4F0E8' },
  { id: 'sand', label: 'Sand', color: '#F6EDDD' },
  { id: 'rose', label: 'Rosa', color: '#F9E6EA' },
  { id: 'navy', label: 'Mørkeblå', color: '#203653' },
  { id: 'charcoal', label: 'Koksgrå', color: '#292D35' },
] as const;
export type WidgetSize = 'normal' | 'medium' | 'tiny';
export type WidgetAppearance = { priceMode?: "total"|"spot"; priceLimits?: PriceLimits; background: typeof widgetBackgrounds[number]['id']; text: 'auto' | 'dark' | 'white'; size?: WidgetSize | 'compact' | 'large'; columns?: number; rows?: number; gridVersion?: 2 | 3 };
export const widgetSize = (appearance?: WidgetAppearance): WidgetSize => appearance?.size === 'tiny' ? 'tiny' : appearance?.size === 'medium' || appearance?.size === 'compact' ? 'medium' : 'normal';
export const fixedSizeWidget=(id:string)=>['price','priceChart','usageChart'].includes(id);
export function widgetSpan(id: ElectricityWidgetId, appearance?: WidgetAppearance): WidgetSpan {
  if(fixedSizeWidget(id))return {columns:12,rows:id==='price'?18:id==='priceChart'?40:48};
  const size = widgetSize(appearance);
  const min = widgetMinimumSpan(id);
  const columns = appearance?.columns === undefined ? size === 'tiny' ? 6 : 12 : appearance.gridVersion === 3 ? appearance.columns : appearance.columns * (appearance.gridVersion === 2 ? 3 : 6);
  const defaultRows = id === 'heatChart' ? 64 : id === 'usageChart' ? size === 'normal' ? 56 : size === 'medium' ? 52 : 48 : id === 'priceChart' ? (size === 'tiny' ? 5 : size === 'medium' ? 10 : 12) * 4 : id === 'budget' ? 18 : 14;
  const rows = appearance?.rows === undefined ? defaultRows : appearance.gridVersion === 3 ? appearance.rows : 4 * (appearance.gridVersion === 2 ? appearance.rows : [0, 4, 6, 10][appearance.rows] ?? 4);
  return { columns: Math.max(min.columns, Math.min(24, columns)), rows: Math.max(min.rows, Math.min(widgetMaximumRows(id), rows)) };
}
export const widgetMaximumRows = (id: ElectricityWidgetId) => ['priceChart', 'usageChart', 'heatChart'].includes(id) ? 96 : id === 'budget' ? 20 : 18;
// Minimums describe the compact content: title/value/date, plus a bar or price note.
export const widgetMinimumSpan = (id: ElectricityWidgetId): WidgetSpan => ({ columns: ['usageChart', 'heatChart'].includes(id) ? 12 : 6, rows: ['usageChart', 'heatChart'].includes(id) ? 48 : id === 'priceChart' ? 18 : id === 'budget' ? 18 : 14 });
export type WidgetAppearances = Partial<Record<ElectricityWidgetId, WidgetAppearance>>;
export const defaultWidgetAppearance: WidgetAppearance = { background: 'default', text: 'auto' };
export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function widgetAppearanceColors(appearance = defaultWidgetAppearance) {
  const background = widgetBackgrounds.find(item => item.id === appearance.background)?.color ?? colors.white;
  const dark = colors.ink, white = '#FFFFFF';
  const automatic = contrastRatio(background, dark) >= contrastRatio(background, white) ? dark : white;
  const requested = appearance.text === 'dark' ? dark : appearance.text === 'white' ? white : automatic;
  const text = contrastRatio(background, requested) >= 4.5 ? requested : automatic;
  const standard = appearance.background === 'default' && appearance.text === 'auto';
  return { background, text, secondary: standard ? colors.muted : text, accent: standard ? colors.primary : text, track: standard ? colors.primarySoft : text === white ? '#4D6079' : '#CED5DD' };
}
export function parseWidgetAppearances(raw: string | null): WidgetAppearances {
  const source = raw ? JSON.parse(raw)?.appearances : undefined;
  const result: WidgetAppearances = {};
  for (const id of electricityWidgetIds) {
    const value = source?.[id];
    if (widgetBackgrounds.some(item => item.id === value?.background) && ['auto', 'dark', 'white'].includes(value?.text)) {
      result[id] = { ...(["total","spot"].includes(value.priceMode)?{priceMode:value.priceMode}:{}), background: value.background, text: value.text, ...(validPriceLimits(value.priceLimits)?{priceLimits:value.priceLimits}:{}), ...(['compact', 'large', 'normal', 'medium', 'tiny'].includes(value.size) ? { size: widgetSize(value) } : {}), ...(Number.isInteger(value.columns) && value.columns >= 1 && value.columns <= (value.gridVersion === 3 ? 24 : value.gridVersion === 2 ? 8 : 2) ? { columns: value.columns } : {}), ...(Number.isInteger(value.rows) && value.rows >= 1 && value.rows <= (value.gridVersion === 3 ? 96 : value.gridVersion === 2 ? 24 : 3) ? { rows: value.rows } : {}), ...([2, 3].includes(value.gridVersion) ? { gridVersion: value.gridVersion } : {}) };
    }
  }
  return result;
}
