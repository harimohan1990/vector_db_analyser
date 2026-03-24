import { useState, memo } from "react";
import styles from "./VectorPlayground.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

// Common embedding dimensions
const COMMON_DIMS = [384, 768, 1024, 1536, 3072];

function extractError(raw) {
  // Pull out the human-readable part from verbose SDK errors
  const match = raw.match(/"message"\s*:\s*"([^"]+)"/);
  if (match) return match[1];
  if (raw.length > 200) return raw.slice(0, 200) + "…";
  return raw;
}

function generateRandom(dim) {
  const vec = Array.from({ length: dim }, () => (Math.random() * 2 - 1));
  // L2-normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map(v => parseFloat((v / norm).toFixed(6)));
}

const VectorPlayground = memo(function VectorPlayground({ providers, dbConfigs, onClose }) {
  const [raw, setRaw] = useState("");
  const [parsedDim, setParsedDim] = useState(null);
  const [parseError, setParseError] = useState("");
  const [genDim, setGenDim] = useState(384);
  const [selectedDB, setSelectedDB] = useState(providers[0]?.name || "");
  const [indexName, setIndexName] = useState("");
  const [namespace, setNamespace] = useState("");
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function parseVector() {
    try {
      const vec = JSON.parse(raw.trim());
      if (!Array.isArray(vec)) throw new Error("Must be a JSON array");
      if (vec.length === 0) throw new Error("Array cannot be empty");
      if (!vec.every(v => typeof v === "number")) throw new Error("All values must be numbers");
      setParsedDim(vec.length);
      setParseError("");
      return vec;
    } catch (e) {
      setParseError(e.message);
      setParsedDim(null);
      return null;
    }
  }

  function handleGenerate() {
    const vec = generateRandom(genDim);
    setRaw(JSON.stringify(vec));
    setParsedDim(genDim);
    setParseError("");
    setError("");
    setResults(null);
  }

  async function handleSearch() {
    const vec = parseVector();
    if (!vec) return;
    if (!selectedDB) { setError("Select a database"); return; }

    const cfg = { ...(dbConfigs[selectedDB] || {}) };
    if (indexName) cfg.index_name = indexName;
    if (namespace) cfg.namespace = namespace;

    setLoading(true);
    setError("");
    setResults(null);
    try {
      const res = await fetch(`${API}/search/vector`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vector: vec, db_type: selectedDB, config: cfg, top_k: topK }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setResults(data);
    } catch (e) {
      setError(extractError(e.message));
    } finally {
      setLoading(false);
    }
  }

  // Warn if parsed dim looks wrong (< 32 dims is almost certainly a mistake)
  const dimWarning = parsedDim !== null && parsedDim < 32
    ? `Only ${parsedDim}D — most indexes need 384D or more. Use Generate below.`
    : null;

  return (
    <div className={styles.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>🧪 Vector Playground</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          {/* Generate helper */}
          <div className={styles.generateRow}>
            <span className={styles.generateLabel}>Generate random vector:</span>
            <select
              className={styles.dimSelect}
              value={genDim}
              onChange={e => setGenDim(Number(e.target.value))}
            >
              {COMMON_DIMS.map(d => (
                <option key={d} value={d}>{d}D</option>
              ))}
            </select>
            <button className={styles.generateBtn} onClick={handleGenerate}>
              ⚡ Generate
            </button>
          </div>

          {/* Vector input */}
          <div className={styles.field}>
            <label className={styles.label}>Raw Vector (JSON array)</label>
            <textarea
              className={styles.textarea}
              value={raw}
              onChange={e => { setRaw(e.target.value); setParsedDim(null); }}
              placeholder='[0.1, 0.2, -0.3, 0.87, ...]'
              rows={4}
              spellCheck={false}
            />
            <div className={styles.parseRow}>
              <button className={styles.parseBtn} onClick={parseVector}>Parse</button>
              {parsedDim !== null && (
                <span className={styles.dimBadge}>{parsedDim} dimensions</span>
              )}
              {parseError && <span className={styles.parseError}>{parseError}</span>}
            </div>
            {dimWarning && <div className={styles.dimWarning}>⚠ {dimWarning}</div>}
          </div>

          {/* DB selector */}
          <div className={styles.field}>
            <label className={styles.label}>Database</label>
            <select
              className={styles.select}
              value={selectedDB}
              onChange={e => setSelectedDB(e.target.value)}
            >
              {providers.map(p => (
                <option key={p.name} value={p.name}>{p.display_name}</option>
              ))}
            </select>
          </div>

          {/* Config fields */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Index / Collection</label>
              <input
                className={styles.input}
                type="text"
                value={indexName || dbConfigs[selectedDB]?.index_name || ""}
                onChange={e => setIndexName(e.target.value)}
                placeholder="index_name"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Namespace</label>
              <input
                className={styles.input}
                type="text"
                value={namespace || dbConfigs[selectedDB]?.namespace || ""}
                onChange={e => setNamespace(e.target.value)}
                placeholder="namespace (optional)"
              />
            </div>
          </div>

          <div className={styles.field} style={{ maxWidth: 120 }}>
            <label className={styles.label}>Top K</label>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={50}
              value={topK}
              onChange={e => setTopK(Number(e.target.value))}
            />
          </div>

          {error && <div className={styles.errorBox}>⚠ {error}</div>}

          <button
            className={styles.searchBtn}
            onClick={handleSearch}
            disabled={loading || !raw.trim()}
          >
            {loading ? <span className={styles.spinner} /> : "Search by Vector"}
          </button>

          {/* Results */}
          {results && (
            <div className={styles.results}>
              <div className={styles.resultsMeta}>
                {results.results?.length ?? 0} results · {results.latency_ms}ms · {results.dimension}D vector
              </div>
              {results.results?.map((r, i) => (
                <div key={r.id + i} className={styles.resultItem}>
                  <span className={styles.resultRank}>#{i + 1}</span>
                  <span className={styles.resultId}>{r.id}</span>
                  <span
                    className={styles.resultScore}
                    style={{ color: r.score >= 0.85 ? "var(--green)" : r.score >= 0.6 ? "var(--amber)" : "var(--red)" }}
                  >
                    {(r.score * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default VectorPlayground;
