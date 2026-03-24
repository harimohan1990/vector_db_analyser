import { useState } from "react";
import styles from "./NamespaceManagerPanel.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function NamespaceManagerPanel({ providers = [], dbConfigs = {}, onClose }) {
  const [selectedDB, setSelectedDB] = useState(providers[0] ?? "");
  const [namespaces, setNamespaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [manualNS, setManualNS] = useState("");
  const [fetched, setFetched] = useState(false);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function fetchNamespaces() {
    if (!selectedDB) {
      setError("Please select a database first.");
      return;
    }
    setLoading(true);
    setError("");
    setFetched(false);
    try {
      const res = await fetch(`${API}/namespace/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_type: selectedDB,
          config: dbConfigs[selectedDB] ?? {},
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setNamespaces(data.namespaces ?? []);
      setFetched(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyNamespace(ns) {
    try {
      await navigator.clipboard.writeText(ns);
      showToast(`Copied "${ns}" to clipboard`);
    } catch {
      showToast(`Namespace: ${ns}`);
    }
  }

  function addManualNS() {
    const trimmed = manualNS.trim();
    if (!trimmed) return;
    if (!namespaces.includes(trimmed)) {
      setNamespaces((prev) => [...prev, trimmed]);
    }
    setManualNS("");
    showToast(`Added namespace "${trimmed}"`);
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.icon}>🗂️</span>
            <h2 className={styles.title}>Namespace Manager</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.controls}>
            <select
              value={selectedDB}
              onChange={(e) => { setSelectedDB(e.target.value); setFetched(false); setNamespaces([]); }}
              className={styles.select}
            >
              <option value="">— Select database —</option>
              {providers.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              className={styles.fetchBtn}
              onClick={fetchNamespaces}
              disabled={loading || !selectedDB}
            >
              {loading ? <span className={styles.spinner} /> : "Fetch Namespaces"}
            </button>
          </div>

          {error && (
            <div className={styles.errorBox}>
              <span>⚠</span> {error}
            </div>
          )}

          {fetched && namespaces.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🗂️</span>
              <p className={styles.emptyText}>No namespaces found in this database.</p>
              <p className={styles.emptyHint}>Some DBs use a default namespace or don't support namespacing.</p>
            </div>
          )}

          {namespaces.length > 0 && (
            <div className={styles.chipSection}>
              <div className={styles.chipSectionLabel}>
                {namespaces.length} namespace{namespaces.length !== 1 ? "s" : ""} found
              </div>
              <div className={styles.chips}>
                {namespaces.map((ns) => (
                  <div key={ns} className={styles.chip}>
                    <span className={styles.chipText}>{ns || "(default)"}</span>
                    <button
                      className={styles.useBtn}
                      onClick={() => copyNamespace(ns)}
                      title="Copy to clipboard"
                    >
                      Use
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.manualSection}>
            <label className={styles.manualLabel}>Add Custom Namespace</label>
            <div className={styles.manualRow}>
              <input
                type="text"
                value={manualNS}
                onChange={(e) => setManualNS(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addManualNS()}
                placeholder="Type namespace name…"
                className={styles.manualInput}
              />
              <button
                className={styles.addBtn}
                onClick={addManualNS}
                disabled={!manualNS.trim()}
              >
                Add to Config
              </button>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </div>

      {toast && (
        <div className={styles.toast}>{toast}</div>
      )}
    </div>
  );
}
