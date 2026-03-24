import { useState, useEffect } from "react";
import styles from "./ScheduledQueriesPanel.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

const INTERVALS = [
  { value: 15,   label: "Every 15 min" },
  { value: 30,   label: "Every 30 min" },
  { value: 60,   label: "Every 1 hour" },
  { value: 360,  label: "Every 6 hours" },
  { value: 1440, label: "Every 24 hours" },
];

function formatTs(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export default function ScheduledQueriesPanel({ providers = [], dbConfigs = {}, embCfg = {}, onClose }) {
  const [schedules, setSchedules] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedDB, setSelectedDB] = useState(providers[0] ?? "");
  const [interval, setInterval] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [runningId, setRunningId] = useState(null);

  async function fetchSchedules() {
    setLoadingList(true);
    setListError("");
    try {
      const res = await fetch(`${API}/scheduled`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setSchedules(Array.isArray(data) ? data : data.schedules ?? []);
    } catch (e) {
      setListError(e.message);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => { fetchSchedules(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim() || !query.trim()) {
      setFormError("Name and query are required.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch(`${API}/scheduled`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          query: query.trim(),
          db_type: selectedDB,
          config: dbConfigs[selectedDB] ?? {},
          emb_config: embCfg,
          interval_minutes: interval,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setName(""); setQuery("");
      await fetchSchedules();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function runNow(id) {
    setRunningId(id);
    try {
      const res = await fetch(`${API}/scheduled/${id}/run`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchSchedules();
    } catch (e) {
      setListError(e.message);
    } finally {
      setRunningId(null);
    }
  }

  async function deleteSchedule(id) {
    try {
      const res = await fetch(`${API}/scheduled/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setListError(e.message);
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.icon}>⏰</span>
            <h2 className={styles.title}>Scheduled Queries</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <form className={styles.newForm} onSubmit={handleCreate}>
            <h3 className={styles.formTitle}>New Schedule</h3>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Name</label>
                <input
                  type="text" value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Daily health check"
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Database</label>
                <select
                  value={selectedDB}
                  onChange={(e) => setSelectedDB(e.target.value)}
                  className={styles.select}
                >
                  <option value="">— Select DB —</option>
                  {providers.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Query</label>
              <input
                type="text" value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search query text…"
                className={styles.input}
              />
            </div>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Interval</label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                  className={styles.select}
                >
                  {INTERVALS.map((iv) => (
                    <option key={iv.value} value={iv.value}>{iv.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>&nbsp;</label>
                <button type="submit" className={styles.createBtn} disabled={submitting}>
                  {submitting ? <span className={styles.spinner} /> : "+ Create Schedule"}
                </button>
              </div>
            </div>
            {formError && <div className={styles.errorBox}><span>⚠</span> {formError}</div>}
          </form>

          {listError && (
            <div className={styles.errorBox}><span>⚠</span> {listError}</div>
          )}

          <div className={styles.listSection}>
            <div className={styles.listHeader}>
              <h3 className={styles.listTitle}>Schedules</h3>
              <button className={styles.refreshBtn} onClick={fetchSchedules} disabled={loadingList}>
                {loadingList ? <span className={styles.spinnerSm} /> : "↻ Refresh"}
              </button>
            </div>

            {schedules.length === 0 && !loadingList && (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>⏰</span>
                <p className={styles.emptyText}>No scheduled queries yet.</p>
                <p className={styles.emptyHint}>Create a schedule above to run queries automatically.</p>
              </div>
            )}

            {schedules.map((sched) => (
              <div key={sched.id} className={styles.schedRow}>
                <div className={styles.schedTop}>
                  <span className={styles.schedName}>{sched.name}</span>
                  <span className={styles.schedInterval}>
                    {INTERVALS.find((i) => i.value === sched.interval_minutes)?.label ?? `${sched.interval_minutes}m`}
                  </span>
                </div>
                <div className={styles.schedQuery}>"{sched.query}"</div>
                <div className={styles.schedMeta}>
                  <span>DB: <strong>{sched.db_type ?? "—"}</strong></span>
                  <span>Last run: {formatTs(sched.last_run)}</span>
                  {sched.last_result_count != null && (
                    <span>Results: <strong>{sched.last_result_count}</strong></span>
                  )}
                </div>
                <div className={styles.schedActions}>
                  <button
                    className={styles.runBtn}
                    onClick={() => runNow(sched.id)}
                    disabled={runningId === sched.id}
                  >
                    {runningId === sched.id ? <span className={styles.spinnerSm} /> : "▶ Run Now"}
                  </button>
                  <button
                    className={styles.delBtn}
                    onClick={() => deleteSchedule(sched.id)}
                    title="Delete schedule"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
