export function formatPrice(value: number, digits = 0) {
  return value.toLocaleString("da-DK", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatDuration(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!wholeHours) return `${minutes} min`;
  return minutes ? `${wholeHours} t ${minutes} min` : `${wholeHours} t`;
}

export function dayKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
