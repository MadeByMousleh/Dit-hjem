import { useEffect, useState } from "react";
import { EvModel, fetchOpenEvModels } from "../evData";

export function useEvModels() {
  const [evModels, setEvModels] = useState<EvModel[]>([]);

  useEffect(() => {
    fetchOpenEvModels().then(setEvModels).catch(() => undefined);
  }, []);

  return evModels;
}
