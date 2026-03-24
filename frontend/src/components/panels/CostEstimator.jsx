import { useState } from "react";
import styles from "./CostEstimator.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

const EMBEDDING_MODELS = [
  { value: "local", label: "Local (Free)" },
  { value: "text-embedding-3-small", label: "text-embedding-3-small" },
  { value: "text-embedding-3-large", label: "text-embedding-3-large" },
  { value: "text-embedding-ada-002", label: "text-embedding-ada-002" },
];

const DB_TYPES = [
  { value: "pinecone", label: "Pinecone" },
  { value: "qdrant", label: "Qdrant" },
  { value: "chroma", label: "Chroma" },
  { value: "weaviate", label: "Weaviate" },
  { value: "milvus", label: "Milvus" },
];

function costColor(total) {
  if (total < 1) return "var(--green)";
  if (total <= 10) return "var(--amber)";
  return "var(--red)";
}

function costLabel(total) {
  if (total < 1) return "Low Cost";
  if (total <= 10) return "Moderate Cost";
  return "High Cost";
}

export default function CostEstimator({ onClose }) {
  const [queriesPerDay, setQueriesPerDay] = useState(1000);
  const [embModel, setEmbModel] = useState("text-embedding-3-small");
  const [dbType, setDbType] = useState("pinecone");
  const [topK, setTopK] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleEstimate() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API}/cost/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries_per_day: queriesPerDay,
          embedding_model: embModel,
          db_type: dbType,
          top_k: topK,
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

  const totalColor = result ? costColor(result.total_monthly ?? 0) : "var(--text)";

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.icon}>💰</span>
            <h2 className={styles.title}>Cost Estimator</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Query Parameters</h3>

            <div className={styles.field}>
              <label className={styles.label}>
                Queries per day
                <span className={styles.value}>{queriesPerDay.toLocaleString()}</span>
              </label>
              <input
                type="range"
                min={1}
                max={100000}
                step={100}
                value={queriesPerDay}
                onChange={(e) => setQueriesPerDay(Number(e.target.value))}
                className={styles.slider}
              />
              <div className={styles.sliderTicks}>
                <span>1</span>
                <span>25k</span>
                <span>50k</span>
                <span>75k</span>
                <span>100k</span>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Top K (results per query)</label>
              <div className={styles.topKRow}>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className={styles.slider}
                />
                <span className={styles.topKVal}>{topK}</span>
              </div>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Embedding Model</label>
                <select
                  value={embModel}
                  onChange={(e) => setEmbModel(e.target.value)}
                  className={styles.select}
                >
                  {EMBEDDING_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Vector Database</label>
                <select
                  value={dbType}
                  onChange={(e) => setDbType(e.target.value)}
                  className={styles.select}
                >
                  {DB_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className={styles.errorBox}>
              <span>⚠</span> {error}
            </div>
          )}

          {result && (
            <div className={styles.results}>
              <div className={styles.totalCard} style={{ borderColor: totalColor }}>
                <div className={styles.totalLabel}>Estimated Monthly Total</div>
                <div className={styles.totalValue} style={{ color: totalColor }}>
                  ${(result.total_monthly ?? 0).toFixed(2)}
                </div>
                <div className={styles.totalBadge} style={{ background: totalColor + "22", color: totalColor }}>
                  {costLabel(result.total_monthly ?? 0)}
                </div>
              </div>

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Monthly Cost</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Embedding API</td>
                    <td style={{ color: costColor(result.embedding_cost ?? 0) }}>
                      ${(result.embedding_cost ?? 0).toFixed(4)}
                    </td>
                    <td className={styles.note}>{result.embedding_note ?? "—"}</td>
                  </tr>
                  <tr>
                    <td>Vector DB</td>
                    <td style={{ color: costColor(result.db_cost ?? 0) }}>
                      ${(result.db_cost ?? 0).toFixed(4)}
                    </td>
                    <td className={styles.note}>{result.db_note ?? "—"}</td>
                  </tr>
                  <tr className={styles.totalRow}>
                    <td><strong>Total</strong></td>
                    <td style={{ color: totalColor }}>
                      <strong>${(result.total_monthly ?? 0).toFixed(2)}</strong>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>

              <div className={styles.disclaimer}>
                * Estimates are approximate and based on public pricing. Actual costs may vary depending on vector dimensions, storage usage, and provider tiers.
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.estimateBtn}
            onClick={handleEstimate}
            disabled={loading}
          >
            {loading ? <span className={styles.spinner} /> : "💰 Estimate Cost"}
          </button>
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
