import { useState, useEffect } from "react";
import styles from "./GoldenDatasetPanel.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function GoldenDatasetPanel({ providers = [], dbConfigs = {}, embCfg = {}, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Add entry form
  const [addQuery, setAddQuery] = useState("");
  const [expectedIds, setExpectedIds] = useState("");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);

  // Run tests
  const [selectedDB, setSelectedDB] = useState(providers[0] ?? "");
  const [running, setRunning] = useState(false);
  const [testResults, setTestResults] = useState(null);

  async function fetchEntries() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/golden`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : data.entries ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchEntries(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!addQuery.trim()) return;
    setAdding(true);
    setError("");
    try {
      const ids = expectedIds.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await fetch(`${API}/golden/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: addQuery.trim(),
          expected_ids: ids,
          notes: notes.trim(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setAddQuery(""); setExpectedIds(""); setNotes("");
      await fetchEntries();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`${API}/golden/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setTestResults(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function runAllTests() {
    if (!selectedDB) { setError("Select a DB to run tests."); return; }
    setRunning(true);
    setError("");
    setTestResults(null);
    try {
      const res = await fetch(`${API}/golden/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_type: selectedDB,
          config: dbConfigs[selectedDB] ?? {},
          emb_config: embCfg,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setTestResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  function getResultForEntry(entryId) {
    return testResults?.results?.find((r) => r.id === entryId || r.entry_id === entryId);
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.icon}>🏆</span>
            <h2 className={styles.title}>Golden Dataset</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          {/* Add entry form */}
          <form className={styles.addForm} onSubmit={handleAdd}>
            <h3 className={styles.formTitle}>Add Entry</h3>
            <div className={styles.field}>
              <label className={styles.label}>Query</label>
              <input
                type="text" value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                placeholder="Search query text…"
                className={styles.input}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Expected IDs (comma separated)</label>
              <textarea
                value={expectedIds}
                onChange={(e) => setExpectedIds(e.target.value)}
                placeholder="id1, id2, id3…"
                className={styles.textarea}
                rows={2}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Notes (optional)</label>
              <input
                type="text" value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context or description…"
                className={styles.input}
              />
            </div>
            {error && <div className={styles.errorBox}><span>⚠</span> {error}</div>}
            <button type="submit" className={styles.addBtn} disabled={adding || !addQuery.trim()}>
              {adding ? <span className={styles.spinner} /> : "+ Add to Dataset"}
            </button>
          </form>

          {/* Run tests bar */}
          {entries.length > 0 && (
            <div className={styles.runBar}>
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
              <button
                className={styles.runAllBtn}
                onClick={runAllTests}
                disabled={running || !selectedDB}
              >
                {running ? <span className={styles.spinner} /> : "▶ Run All Tests"}
              </button>
            </div>
          )}

          {/* Test summary */}
          {testResults && (
            <div className={styles.testSummary}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Avg Precision</span>
                <span className={styles.summaryVal} style={{ color: "var(--green)" }}>
                  {((testResults.avg_precision ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Avg Recall</span>
                <span className={styles.summaryVal} style={{ color: "var(--accent2)" }}>
                  {((testResults.avg_recall ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Passed</span>
                <span className={styles.summaryVal} style={{ color: "var(--green)" }}>
                  {testResults.passed ?? 0} / {testResults.total ?? entries.length}
                </span>
              </div>
            </div>
          )}

          {/* Entries list */}
          {loading && <div className={styles.loadingRow}><span className={styles.spinner} /> Loading entries…</div>}

          {entries.length === 0 && !loading && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🏆</span>
              <p>No golden entries yet. Add one above.</p>
            </div>
          )}

          {entries.length > 0 && (
            <div className={styles.entriesList}>
              <h3 className={styles.listTitle}>{entries.length} Golden Entr{entries.length !== 1 ? "ies" : "y"}</h3>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Expected IDs</th>
                      <th>Notes</th>
                      {testResults && <th>Result</th>}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const res = getResultForEntry(entry.id);
                      const passed = res?.passed;
                      return (
                        <tr key={entry.id}>
                          <td className={styles.queryCell}>{entry.query}</td>
                          <td>
                            <div className={styles.idChips}>
                              {(entry.expected_ids ?? []).map((id) => (
                                <span key={id} className={styles.idChip}>{id}</span>
                              ))}
                              {(!entry.expected_ids || entry.expected_ids.length === 0) && (
                                <span className={styles.noIds}>—</span>
                              )}
                            </div>
                          </td>
                          <td className={styles.notesCell}>{entry.notes ?? "—"}</td>
                          {testResults && (
                            <td>
                              {res ? (
                                <span className={`${styles.badge} ${passed ? styles.badgePass : styles.badgeFail}`}>
                                  {passed ? "✓ Pass" : "✗ Fail"}
                                </span>
                              ) : (
                                <span className={styles.noResult}>—</span>
                              )}
                              {res && (
                                <div className={styles.resScores}>
                                  P: {((res.precision ?? 0) * 100).toFixed(0)}%
                                  &nbsp;R: {((res.recall ?? 0) * 100).toFixed(0)}%
                                </div>
                              )}
                            </td>
                          )}
                          <td>
                            <button
                              className={styles.delBtn}
                              onClick={() => handleDelete(entry.id)}
                              title="Delete entry"
                            >🗑</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
