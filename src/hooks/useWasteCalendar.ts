import { useEffect, useState } from "react";
import { fetchWasteEvents, fetchWasteHealth, WasteEvent, WasteHealth } from "../waste";

export function useWasteCalendar({ municipality, postcode, calendarUrl, address }: { municipality?: string; postcode?: string; calendarUrl: string; address: string }) {
  const [events, setEvents] = useState<WasteEvent[]>([]);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<WasteHealth | null>(null);

  useEffect(() => {
    let active = true;
    setEvents([]);
    setError("");
    setHealth(null);
    if (!municipality) {
      if (address.trim()) setError("Vælg din fulde adresse fra forslagene i Profil, så vi kan finde din kommune og tømninger.");
      return;
    }
    setError("Henter næste affaldstømning…");
    fetchWasteHealth(municipality).then(nextHealth => { if (active) setHealth(nextHealth); }).catch(() => { if (active) setHealth(null); });
    fetchWasteEvents(municipality, postcode, calendarUrl, address).then((nextEvents) => {
      if (!active) return;
      const upcoming = nextEvents.filter((event) => new Date(`${event.date}T23:59:59`).getTime() >= Date.now()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
      setEvents(upcoming);
      setError(upcoming.length ? "" : "Der er ingen kommende affaldstømninger i kalenderen.");
    }).catch((fetchError) => {
      if (!active) return;
      setEvents([]);
      setError(fetchError instanceof Error ? fetchError.message : "Affaldskalenderen kunne ikke hentes");
    });
    return () => { active = false; };
  }, [municipality, postcode, calendarUrl, address]);

  return { events, error, health };
}
