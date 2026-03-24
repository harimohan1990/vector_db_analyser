import { useState } from "react";
import styles from "./IndexMigrationPanel.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

const MIGRATION_STEPS = [
  "Validate source connection",
  "Validate target connection",
  "Read source vector metadata",
  "Create target index",
  "Migrate vectors in batches",
  "Verify migration integrity",
];

export default function IndexMigrationPanel({ providers = [], dbConfigs = {}, onClose }) {
  const [sourceDB, setSourceDB] = useState(providers[0] ?? "");
  const [targetDB, setTargetDB] = useState(providers[1] ?? providers[0] ?? "");
  const [targetIndex, setTargetIndex] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handlePreview() {
    if (!sourceDB || !targetDB || !targetIndex.trim()) {
      setError("Please select source/target DBs and provide a target index name.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API}/migrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_db: sourceDB,
          source_config: dbConfigs[sourceDB] ?? {},
          target_db: targetDB,
          target_config: dbConfigs[targetDB] ?? {},
          target_index: targetIndex.trim(),
          preview: true,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.icon}>🔄</span>
            <h2 className={styles.title}>Index Migration</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.warning}>
            <span className={styles.warnIcon}>⚠️</span>
            <div>
              <strong>Full migration requires vector read access from source DB.</strong>
              <br />
              Ensure your source API key has read permissions before proceeding.
            </div>
          </div>

          <div className={styles.migrationGrid}>
            <div className={styles.dbCard}>
              <div className={styles.dbCardLabel}>Source Database</div>
              <select
                value={sourceDB}
                onChange={(e) => setSourceDB(e.target.value)}
                className={styles.select}
              >
                <option value="">— Select source —</option>
                {providers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {sourceDB && dbConfigs[sourceDB] && (
                <div className={styles.configPreview}>
                  {Object.entries(dbConfigs[sourceDB]).slice(0, 3).map(([k, v]) => (
                    <div key={k} className={styles.configRow}>
                      <span className={styles.configKey}>{k}</span>
                      <span className={styles.configVal}>
                        {String(v).length > 20 ? String(v).slice(0, 20) + "…" : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.arrow}>→</div>

            <div className={styles.dbCard}>
              <div className={styles.dbCardLabel}>Target Database</div>
              <select
                value={targetDB}
                onChange={(e) => setTargetDB(e.target.value)}
                className={styles.select}
              >
                <option value="">— Select target —</option>
                {providers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input
                type="text"
                value={targetIndex}
                onChange={(e) => setTargetIndex(e.target.value)}
                placeholder="Target index name"
                className={styles.input}
              />
              {targetDB && dbConfigs[targetDB] && (
                <div className={styles.configPreview}>
                  {Object.entries(dbConfigs[targetDB]).slice(0, 3).map(([k, v]) => (
                    <div key={k} className={styles.configRow}>
                      <span className={styles.configKey}>{k}</span>
                      <span className={styles.configVal}>
                        {String(v).length > 20 ? String(v).slice(0, 20) + "…" : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className={styles.errorBox}>
              <span>⚠</span> {error}
            </div>
          )}

          {result && (
            <div className={styles.results}>
              <div className={styles.summaryCard}>
                <h3 className={styles.summaryTitle}>Migration Summary</h3>
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Vectors</span>
                    <span className={styles.summaryVal}>{result.vector_count?.toLocaleString() ?? "—"}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Dimensions</span>
                    <span className={styles.summaryVal}>{result.dimensions ?? "—"}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Est. Time</span>
                    <span className={styles.summaryVal}>{result.estimated_time ?? "—"}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Namespaces</span>
                    <span className={styles.summaryVal}>{result.namespace_count ?? "—"}</span>
                  </div>
                </div>
                {result.message && (
                  <p className={styles.summaryNote}>{result.message}</p>
                )}
              </div>

              <div className={styles.stepList}>
                <h4 className={styles.stepListTitle}>Migration Steps</h4>
                {(result.steps ?? MIGRATION_STEPS).map((step, i) => (
                  <div key={i} className={styles.stepRow}>
                    <span className={styles.stepNum}>{i + 1}</span>
                    <span className={styles.stepText}>{step}</span>
                    <span className={styles.stepStatus}>
                      {result.completed_steps > i ? "✓" : "○"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.previewBtn}
            onClick={handlePreview}
            disabled={loading}
          >
            {loading ? <span className={styles.spinner} /> : "🔍 Preview Migration"}
          </button>
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
