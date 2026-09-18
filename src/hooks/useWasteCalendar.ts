import { useEffect, useState } from "react";
import { fetchWasteEvents, fetchWasteHealth, WasteEvent, WasteHealth } from "../waste";

export function useWasteCalendar({ municipality, postcode, calendarUrl, address }: { municipality?: string; postcode?: string; calendarUrl: string; address: string }) {
  const [events, setEvents] = useState<WasteEvent[]>([]);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<WasteHealth | null>(null);

  useEffect(() => {
    if (!municipality) return;
    fetchWasteHealth(municipality).then(setHealth).catch(() => setHealth(null));
    fetchWasteEvents(municipality, postcode, calendarUrl, address).then((nextEvents) => {
      setEvents(nextEvents.filter((event) => new Date(`${event.date}T23:59:59`).getTime() >= Date.now()).slice(0, 8));
      setError("");
    }).catch((fetchError) => {
      setEvents([]);
      setError(fetchError instanceof Error ? fetchError.message : "Affaldskalenderen kunne ikke hentes");
    });
  }, [municipality, postcode, calendarUrl, address]);

  return { events, error, health };
}
