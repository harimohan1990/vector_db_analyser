import { useState, useEffect } from "react";
import styles from "./RelevanceFeedbackPanel.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function RelevanceFeedbackPanel({
  results = [],
  currentQuery = "",
  selectedDB = "",
  onClose,
}) {
  // Map of result_id -> true (relevant) | false (irrelevant) | undefined
  const [votes, setVotes] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [allFeedback, setAllFeedback] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // Fetch existing feedback on mount
  useEffect(() => {
    async function loadFeedback() {
      setLoadingHistory(true);
      try {
        const res = await fetch(`${API}/feedback`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const fbList = Array.isArray(data) ? data : data.feedback ?? [];
        setAllFeedback(fbList);

        // Restore prior votes for current query
        const priorVotes = {};
        for (const fb of fbList) {
          if (fb.query === currentQuery && fb.db_type === selectedDB && fb.result_id != null) {
            priorVotes[fb.result_id] = fb.relevant;
          }
        }
        setVotes(priorVotes);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingHistory(false);
      }
    }
    loadFeedback();
  }, [currentQuery, selectedDB]);

  async function submitVote(resultId, relevant) {
    setSubmitting((prev) => ({ ...prev, [resultId]: true }));
    try {
      const res = await fetch(`${API}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: currentQuery,
          result_id: resultId,
          relevant,
          db_type: selectedDB,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setVotes((prev) => ({ ...prev, [resultId]: relevant }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting((prev) => ({ ...prev, [resultId]: false }));
    }
  }

  const relevantCount = Object.values(votes).filter((v) => v === true).length;
  const irrelevantCount = Object.values(votes).filter((v) => v === false).length;
  const totalVoted = relevantCount + irrelevantCount;

  function formatTs(ts) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return ts;
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.icon}>⭐</span>
            <h2 className={styles.title}>Relevance Feedback</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          {/* Query context */}
          <div className={styles.queryContext}>
            <span className={styles.queryLabel}>Query</span>
            <span className={styles.queryText}>
              {currentQuery || <em className={styles.noQuery}>No current query</em>}
            </span>
            {selectedDB && (
              <span className={styles.dbBadge}>{selectedDB}</span>
            )}
          </div>

          {/* Summary bar */}
          {totalVoted > 0 && (
            <div className={styles.summary}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryNum} style={{ color: "var(--green)" }}>{relevantCount}</span>
                <span className={styles.summaryLabel}>marked relevant</span>
              </div>
              <div className={styles.summaryDivider} />
              <div className={styles.summaryItem}>
                <span className={styles.summaryNum} style={{ color: "var(--red)" }}>{irrelevantCount}</span>
                <span className={styles.summaryLabel}>marked irrelevant</span>
              </div>
              <div className={styles.summaryDivider} />
              <div className={styles.summaryItem}>
                <span className={styles.summaryNum} style={{ color: "var(--text2)" }}>
                  {results.length - totalVoted}
                </span>
                <span className={styles.summaryLabel}>unrated</span>
              </div>
            </div>
          )}

          {error && (
            <div className={styles.errorBox}><span>⚠</span> {error}</div>
          )}

          {/* Results with vote buttons */}
          {results.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🔍</span>
              <p>No search results to rate.</p>
              <p className={styles.emptyHint}>Run a search first to see results here.</p>
            </div>
          )}

          {results.length > 0 && (
            <div className={styles.resultsList}>
              <h3 className={styles.sectionTitle}>{results.length} Result{results.length !== 1 ? "s" : ""}</h3>
              {results.map((result, i) => {
                const rid = result.id ?? result._id ?? i;
                const vote = votes[rid];
                const isSubmitting = submitting[rid];
                return (
                  <div
                    key={rid}
                    className={`${styles.resultRow} ${
                      vote === true ? styles.resultRowRelevant :
                      vote === false ? styles.resultRowIrrelevant : ""
                    }`}
                  >
                    <div className={styles.resultLeft}>
                      <span className={styles.resultNum}>{i + 1}</span>
                      <div className={styles.resultContent}>
                        <div className={styles.resultId}>
                          <span className={styles.idLabel}>ID:</span>
                          <span className={styles.idVal}>{String(rid)}</span>
                        </div>
                        {result.score != null && (
                          <div className={styles.resultScore}>
                            Score: <strong>{typeof result.score === "number" ? result.score.toFixed(4) : result.score}</strong>
                          </div>
                        )}
                        {(result.text || result.content || result.metadata?.text) && (
                          <div className={styles.resultSnippet}>
                            {String(result.text || result.content || result.metadata?.text || "").slice(0, 120)}
                            {String(result.text || result.content || result.metadata?.text || "").length > 120 ? "…" : ""}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={styles.voteGroup}>
                      <button
                        className={`${styles.voteBtn} ${vote === true ? styles.voteBtnActive : ""} ${styles.thumbUp}`}
                        onClick={() => submitVote(rid, true)}
                        disabled={isSubmitting}
                        title="Relevant"
                        aria-label="Mark relevant"
                      >
                        👍
                      </button>
                      <button
                        className={`${styles.voteBtn} ${vote === false ? styles.voteBtnActiveDown : ""} ${styles.thumbDown}`}
                        onClick={() => submitVote(rid, false)}
                        disabled={isSubmitting}
                        title="Not relevant"
                        aria-label="Mark irrelevant"
                      >
                        👎
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* View all feedback history */}
          <div className={styles.historySection}>
            <button
              className={styles.toggleHistory}
              onClick={() => setShowHistory((v) => !v)}
            >
              {showHistory ? "▾" : "▸"} View All Feedback
              {allFeedback.length > 0 && (
                <span className={styles.historyCount}>{allFeedback.length}</span>
              )}
            </button>

            {showHistory && (
              <div className={styles.historyList}>
                {loadingHistory && (
                  <div className={styles.loadingRow}><span className={styles.spinner} /> Loading…</div>
                )}
                {!loadingHistory && allFeedback.length === 0 && (
                  <div className={styles.noHistory}>No feedback recorded yet.</div>
                )}
                {allFeedback.slice(0, 50).map((fb, i) => (
                  <div key={i} className={styles.historyRow}>
                    <span
                      className={styles.historyVote}
                      style={{ color: fb.relevant ? "var(--green)" : "var(--red)" }}
                    >
                      {fb.relevant ? "👍" : "👎"}
                    </span>
                    <div className={styles.historyContent}>
                      <span className={styles.historyQuery}>{fb.query ?? "—"}</span>
                      <span className={styles.historyMeta}>
                        ID: {fb.result_id ?? "—"} · {fb.db_type ?? "—"}
                      </span>
                    </div>
                    <span className={styles.historyTime}>{formatTs(fb.timestamp ?? fb.ts)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <span className={styles.footerNote}>
            {totalVoted > 0 ? `${totalVoted} / ${results.length} rated` : "Rate results to improve search"}
          </span>
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
