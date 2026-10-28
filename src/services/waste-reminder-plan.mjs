export function planWasteReminders(events, amount, unit, now = Date.now()) {
  if (!Number.isInteger(amount) || amount < 1 || amount > (unit === 'days' ? 7 : 168) || !['days', 'hours'].includes(unit)) return [];
  return events.flatMap(event => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return [];
    const day=new Date(`${event.date}T00:00:00Z`);
    if(!Number.isFinite(+day)||day.toISOString().slice(0,10)!==event.date)return [];
    // The household is in Denmark even if the phone is travelling. Calendar
    // days keep 07:00 Copenhagen time across the daylight-saving boundary.
    if(unit==='days')day.setUTCDate(day.getUTCDate()-amount);
    const guess=new Date(day.toISOString().slice(0,10)+'T07:00:00Z');
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(guess).map(part=>[part.type,part.value]));
    const offset=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second)-+guess;
    const date=new Date(+guess-offset-(unit==='hours'?amount*3600000:0));
    return date.getTime() > now ? [{ event, date }] : [];
  });
}
