export type WidgetLayout = { y: number; height: number; x?: number; width?: number };
export type WidgetSpan = { columns: number; rows: number };
export const widgetGridGap = 8;
export const widgetGridRowHeight = 2;
export const widgetGridColumns = (width: number) => width >= 680 ? 24 : 12;
export function resizeWidgetSpan(start: WidgetSpan, dx: number, dy: number, width: number, min: WidgetSpan, rowHeight = widgetGridRowHeight, axis: 'both' | 'width' | 'height' = 'both'): WidgetSpan {
  const columns = widgetGridColumns(width), step = (width + widgetGridGap) / columns;
  return { columns: Math.max(min.columns, Math.min(columns, start.columns + (axis === 'height' ? 0 : Math.round(dx / step)))), rows: Math.max(min.rows, Math.min(96, start.rows + (axis === 'width' ? 0 : Math.round(dy / (rowHeight + widgetGridGap))))) };
}
export function widgetTrackLayout(ids: string[], spans: Record<string, WidgetSpan>, width: number, rowHeight = widgetGridRowHeight) {
  const occupied: boolean[][] = [];
  const layouts: Record<string, Required<WidgetLayout>> = {};
  const totalColumns = widgetGridColumns(width);
  const columnWidth = Math.max(0, (width - widgetGridGap * (totalColumns - 1)) / totalColumns);
  for (const id of ids) {
    const columns = Math.max(1, Math.min(totalColumns, spans[id]!.columns));
    const rows = Math.max(1, Math.min(96, spans[id]!.rows));
    let row = 0, column = 0, found = false;
    while (!found) {
      for (column = 0; column <= totalColumns - columns; column++) {
        if (Array.from({ length: rows }, (_, r) => Array.from({ length: columns }, (_, c) => !occupied[row + r]?.[column + c]).every(Boolean)).every(Boolean)) { found = true; break; }
      }
      if (!found) row++;
    }
    for (let r = 0; r < rows; r++) { occupied[row + r] ??= []; for (let c = 0; c < columns; c++) occupied[row + r]![column + c] = true; }
    layouts[id] = { x: column * (columnWidth + widgetGridGap), y: row * (rowHeight + widgetGridGap), width: columns * columnWidth + (columns - 1) * widgetGridGap, height: rows * rowHeight + (rows - 1) * widgetGridGap };
  }
  return { layouts, height: Math.max(0, occupied.length * (rowHeight + widgetGridGap) - widgetGridGap) };
}

// Match the two-column flex layout: tiny cards are 48%, other cards a full row.
export function widgetGridLayout(ids: string[], heights: Record<string, number>, tiny: Record<string, boolean>, width: number) {
  const result: Record<string, Required<WidgetLayout>> = {};
  let y = 0, rowHeight = 0, right = false;
  for (const id of ids) {
    if (!tiny[id] && right) { y += rowHeight; rowHeight = 0; right = false; }
    result[id] = { x: right ? width * .52 : 0, y, width: tiny[id] ? width * .48 : width, height: heights[id]! };
    rowHeight = Math.max(rowHeight, heights[id]!);
    if (!tiny[id] || right) { y += rowHeight; rowHeight = 0; right = false; }
    else right = true;
  }
  return result;
}
export function widgetGridDragPosition(ids: string[], layouts: Record<string, WidgetLayout>, tiny: Record<string, boolean>, width: number, id: string, movementY: number, movementX: number, spans?: Record<string, WidgetSpan>, rowHeight = widgetGridRowHeight) {
  const source = ids.indexOf(id), origin = layouts[id];
  if (source < 0 || !origin || width <= 0 || !ids.every(key => (layouts[key]?.height ?? 0) > 0)) return null;
  const originX = origin.x ?? 0, originWidth = origin.width ?? width;
  const bottom = Math.max(...ids.map(key => layouts[key]!.y + layouts[key]!.height));
  const delta = Math.max(-origin.y, Math.min(bottom - origin.height - origin.y, movementY)) || 0;
  const deltaX = Math.max(-originX, Math.min(width - originWidth - originX, movementX)) || 0;
  const centerX = originX + originWidth / 2 + deltaX, centerY = origin.y + origin.height / 2 + delta;
  let target = source, distance = Infinity;
  ids.forEach((key, index) => {
    const box = layouts[key]!;
    const dx = Math.max(0, Math.abs(centerX - ((box.x ?? 0) + (box.width ?? width) / 2)) - (box.width ?? width) / 2);
    const dy = Math.max(0, Math.abs(centerY - (box.y + box.height / 2)) - box.height / 2);
    const score = dx * dx + dy * dy;
    if (score < distance) { distance = score; target = index; }
  });
  const order = [...ids]; order.splice(source, 1); order.splice(target, 0, id);
  const packed = spans ? widgetTrackLayout(order, spans, width, rowHeight).layouts : widgetGridLayout(order, Object.fromEntries(ids.map(key => [key, layouts[key]!.height])), tiny, width);
  const offsets = Object.fromEntries(ids.map(key => [key, key === id ? delta : packed[key]!.y - layouts[key]!.y]));
  const offsetsX = Object.fromEntries(ids.map(key => [key, key === id ? deltaX : packed[key]!.x - (layouts[key]!.x ?? 0)]));
  return { delta, deltaX, landing: packed[id]!.y - origin.y, landingX: packed[id]!.x - originX, target, offsets, offsetsX, order };
}
export function widgetDragPosition(ids: string[], layouts: Record<string, WidgetLayout>, id: string, movement: number) {
  const source = ids.indexOf(id), origin = layouts[id];
  if (source < 0 || !origin || !ids.every(key => (layouts[key]?.height ?? 0) > 0)) return null;
  const first = layouts[ids[0]!]!, last = layouts[ids[ids.length - 1]!]!;
  const delta = Math.max(first.y - origin.y, Math.min(last.y + last.height - origin.height - origin.y, movement));
  let target = source;
  for (let i = source + 1; i < ids.length; i++) {
    const row = layouts[ids[i]!]!;
    if (origin.y + origin.height + delta > row.y + row.height / 2) target = i;
  }
  for (let i = source - 1; i >= 0; i--) {
    const row = layouts[ids[i]!]!;
    if (origin.y + delta < row.y + row.height / 2) target = i;
  }
  const row = layouts[ids[target]!]!;
  const landing = target > source ? row.y + row.height - origin.height - origin.y : row.y - origin.y;
  const offsets = Object.fromEntries(ids.map((key, index) => [key, key === id ? delta : source < index && index <= target ? -origin.height : target <= index && index < source ? origin.height : 0]));
  const order = [...ids]; order.splice(source, 1); order.splice(target, 0, id);
  return { delta, landing, target, offsets, order };
}
