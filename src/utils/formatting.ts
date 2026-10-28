const priceFormatters = new Map<number, Intl.NumberFormat>();
export function formatPrice(value: number, digits = 0) {
  let formatter = priceFormatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("da-DK", { maximumFractionDigits: digits, minimumFractionDigits: digits });
    priceFormatters.set(digits, formatter);
  }
  return formatter.format(value);
}

export function formatDuration(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!wholeHours) return `${minutes} min`;
  return minutes ? `${wholeHours} t ${minutes} min` : `${wholeHours} t`;
}

const dayFormatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

export function dayKey(date: Date) {
  return dayFormatter.format(date);
}
