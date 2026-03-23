import { useState } from "react";
import ResultCard from "./ResultCard";
import styles from "./MultiResultsView.module.css";

const DB_ICONS = {
  pinecone: "🌲", chroma: "🎨", deeplake: "🌊", vespa: "🚀", milvus: "⚡",
  scann: "🔎", weaviate: "🕸️", qdrant: "🎯", vald: "🔷", faiss: "📦",
  opensearch: "🔍", pgvector: "🐘", cassandra: "💫", elasticsearch: "🔶", clickhouse: "🖱️",
};

function latencyColor(ms) {
  if (ms < 500) return "#22d3a0";
  if (ms < 2000) return "#f59e0b";
  return "#f43f5e";
}

function DBResults({ db, data }) {
  if (data.error) return (
    <div className={styles.errBox}>
      <span className={styles.errIcon}>⚠</span>
      <div>
        <p className={styles.errTitle}>Search failed for {db}</p>
        <p className={styles.errMsg}>{data.error}</p>
      </div>
    </div>
  );
  if (data.results.length === 0) return (
    <p className={styles.empty}>No results found for this database.</p>
  );
  return (
    <div className={styles.resultList}>
      {data.results.map((item, i) => (
        <ResultCard
          key={`${db}-${item.id}-${i}`}
          rank={i + 1}
          item={item}
          dbBadge={db}
          style={{ animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}

export default function MultiResultsView({ results }) {
  const entries = [...results.entries()];
  const [activeTab, setActiveTab] = useState(entries[0]?.[0]);
  const [sideBy, setSideBy] = useState(false);

  if (entries.length === 0) return null;
  const canSideBySide = entries.length === 2;

  if (sideBy && canSideBySide) {
    return (
      <div className={styles.wrap}>
        <div className={styles.sbHeader}>
          <button className={styles.toggleBtn} onClick={() => setSideBy(false)}>← Back to tabs</button>
        </div>
        <div className={styles.sideBySide}>
          {entries.map(([db, data]) => (
            <div key={db} className={styles.sideCol}>
              <div className={styles.sideColHeader}>
                <span>{DB_ICONS[db] || "🗄️"} {db}</span>
                <span style={{ color: latencyColor(data.latency_ms) }}>{data.latency_ms}ms</span>
              </div>
              <DBResults db={db} data={data} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.tabBar}>
        {entries.map(([db, data]) => (
          <button
            key={db}
            className={`${styles.tab} ${activeTab === db ? styles.activeTab : ""}`}
            onClick={() => setActiveTab(db)}
          >
            <span>{DB_ICONS[db] || "🗄️"}</span>
            <span>{db}</span>
            {!data.error
              ? <span className={styles.countBadge}>{data.results.length}</span>
              : <span className={styles.errBadge}>!</span>}
            <span className={styles.latencyTag} style={{ color: latencyColor(data.latency_ms) }}>
              {data.latency_ms}ms
            </span>
          </button>
        ))}
        {canSideBySide && (
          <button className={styles.sideBtn} onClick={() => setSideBy(true)}>⊞ Side by side</button>
        )}
      </div>

      <div className={styles.panel}>
        {activeTab && results.has(activeTab) && (
          <DBResults db={activeTab} data={results.get(activeTab)} />
        )}
      </div>
    </div>
  );
}
