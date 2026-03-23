import { useState, useCallback } from "react";

const KEY = "vdb_query_history";
const MAX = 50;

export function useQueryHistory() {
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  });

  const addEntry = useCallback((query, stats) => {
    setHistory((prev) => {
      const entry = { id: Date.now(), query, stats, ts: new Date().toISOString() };
      const updated = [entry, ...prev.filter((h) => h.query !== query)].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeEntry = useCallback((id) => {
    setHistory((prev) => {
      const updated = prev.filter((h) => h.id !== id);
      localStorage.setItem(KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(KEY);
  }, []);

  return { history, addEntry, removeEntry, clearHistory };
}
