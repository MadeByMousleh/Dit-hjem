import { useEffect, useState } from "react";
import { EvModel, fetchOpenEvModels } from "../evData";

export function useEvModels(enabled = true) {
  const [evModels, setEvModels] = useState<EvModel[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetchOpenEvModels().then(models => { if (active) setEvModels(models); }).catch(() => undefined);
    return () => { active = false; };
  }, [enabled]);

  return evModels;
}
