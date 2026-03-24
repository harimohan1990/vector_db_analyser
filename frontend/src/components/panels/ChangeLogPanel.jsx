import { useState, useEffect, useRef } from "react";
import styles from "./ChangeLogPanel.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

const ACTION_ICONS = {
  config: "⚙️",
  search: "🔍",
  import: "⬆️",
  export: "⬇️",
  delete: "🗑️",
  create: "✨",
  update: "✏️",
  error: "❌",
  migrate: "🔄",
  default: "📋",
};

function getIcon(action) {
  if (!action) return ACTION_ICONS.default;
  const key = Object.keys(ACTION_ICONS).find((k) =>
    k !== "default" && action.toLowerCase().includes(k)
  );
  return ACTION_ICONS[key ?? "default"];
}

function formatTs(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return ts ?? "";
  }
}

export default function ChangeLogPanel({ onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef(null);

  async function fetchLog() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/changelog`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : data.entries ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLog();
    intervalRef.current = setInterval(fetchLog, 30000);
    return () => clearInterval(intervalRef.current);
  }, []);

  async function handleAddEntry(e) {
    e.preventDefault();
    if (!action.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/changelog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action.trim(), details: details.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setAction("");
      setDetails("");
      await fetchLog();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function clearLocal() {
    setEntries([]);
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.icon}>📋</span>
            <h2 className={styles.title}>Change Log</h2>
            {loading && <span className={styles.spinner} />}
          </div>
          <div className={styles.headerRight}>
            <button className={styles.clearBtn} onClick={clearLocal} title="Clear local view">Clear</button>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className={styles.body}>
          <form className={styles.addForm} onSubmit={handleAddEntry}>
            <h3 className={styles.formTitle}>Add Entry</h3>
            <div className={styles.formRow}>
              <input
                type="text"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="Action (e.g. config change, search…)"
                className={styles.input}
                required
              />
              <input
                type="text"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Details (optional)"
                className={styles.input}
              />
              <button
                type="submit"
                className={styles.addBtn}
                disabled={submitting || !action.trim()}
              >
                {submitting ? <span className={styles.spinnerSm} /> : "Add"}
              </button>
            </div>
          </form>

          {error && (
            <div className={styles.errorBox}>
              <span>⚠</span> {error}
            </div>
          )}

          {entries.length === 0 && !loading && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📋</span>
              <p>No changelog entries yet.</p>
            </div>
          )}

          {entries.length > 0 && (
            <div className={styles.timeline}>
              {entries.map((entry, i) => (
                <div key={entry.id ?? i} className={styles.timelineItem}>
                  <div className={styles.timelineLine}>
                    <div className={styles.timelineDot}>
                      <span className={styles.actionIcon}>{getIcon(entry.action)}</span>
                    </div>
                    {i < entries.length - 1 && <div className={styles.connector} />}
                  </div>
                  <div className={styles.timelineContent}>
                    <div className={styles.entryTop}>
                      <span className={styles.entryAction}>{entry.action ?? "—"}</span>
                      <span className={styles.entryTime}>{formatTs(entry.timestamp ?? entry.ts)}</span>
                    </div>
                    {entry.details && (
                      <div className={styles.entryDetails}>{entry.details}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.autoRefresh}>Auto-refreshes every 30s</span>
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
