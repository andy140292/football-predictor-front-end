import { useEffect, useState } from "react";
import { fetchTopSearchedTeams } from "../api/topSearchedTeams";

export default function useTopSearchedTeams({ session, apiBaseUrl, mode, enabled = true }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = session?.access_token;

    if (!enabled) {
      setLoading(false);
      setError("");
      return;
    }

    if (!token) {
      setSnapshot(null);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const loadSnapshot = async () => {
      try {
        setLoading(true);
        setError("");
        const payload = await fetchTopSearchedTeams({
          apiBaseUrl,
          mode,
          token,
          signal: controller.signal,
        });

        if (cancelled) return;
        setSnapshot(payload);
      } catch (nextError) {
        if (cancelled || nextError?.name === "AbortError") return;
        console.error(`Error loading top searched teams (${mode}):`, nextError);
        setError(nextError?.message || "No se pudo cargar el top 5.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSnapshot();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [apiBaseUrl, enabled, mode, session]);

  return {
    snapshot,
    loading,
    error,
  };
}
