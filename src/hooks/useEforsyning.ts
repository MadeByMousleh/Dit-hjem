import { useState } from "react";
import { EforsyningData } from "../types/app";

const API_URL = "http://localhost:8787";

export function useEforsyning() {
  const [data, setData] = useState<EforsyningData | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/eforsyning/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, supplierId }),
      });
      const result = await response.json() as EforsyningData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Login mislykkedes");
      setData(result);
      setPassword("");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login mislykkedes");
    } finally {
      setLoading(false);
    }
  };

  return { data, username, setUsername, password, setPassword, supplierId, setSupplierId, loading, error, login };
}
