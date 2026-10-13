export function planWasteReminders(events, amount, unit, now = Date.now()) {
  if (!Number.isInteger(amount) || amount < 1 || amount > (unit === 'days' ? 7 : 168) || !['days', 'hours'].includes(unit)) return [];
  return events.flatMap(event => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return [];
    const date = new Date(`${event.date}T07:00:00`);
    // Calendar days preserve wall-clock time across daylight-saving changes.
    if (unit === 'days') date.setDate(date.getDate() - amount);
    else date.setTime(date.getTime() - amount * 3600000);
    return date.getTime() > now ? [{ event, date }] : [];
  });
}
