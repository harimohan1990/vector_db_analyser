import { useState } from "react";
import styles from "./DBSelector.module.css";

const DB_META = {
  pinecone:      { icon: "🌲", color: "#00c17c", tag: "Cloud" },
  chroma:        { icon: "🎨", color: "#ff6584", tag: "Local" },
  deeplake:      { icon: "🌊", color: "#3b9eff", tag: "Cloud" },
  vespa:         { icon: "🚀", color: "#f59e0b", tag: "Search" },
  milvus:        { icon: "⚡", color: "#a78bfa", tag: "Cloud" },
  scann:         { icon: "🔎", color: "#34d399", tag: "Local" },
  weaviate:      { icon: "🕸️", color: "#fb923c", tag: "Cloud" },
  qdrant:        { icon: "🎯", color: "#f472b6", tag: "Cloud" },
  vald:          { icon: "🔷", color: "#60a5fa", tag: "Search" },
  faiss:         { icon: "📦", color: "#94a3b8", tag: "Local" },
  opensearch:    { icon: "🔍", color: "#fbbf24", tag: "Search" },
  pgvector:      { icon: "🐘", color: "#818cf8", tag: "SQL" },
  cassandra:     { icon: "💫", color: "#e879f9", tag: "NoSQL" },
  elasticsearch: { icon: "🔶", color: "#fb7185", tag: "Search" },
  clickhouse:    { icon: "🖱️", color: "#fdba74", tag: "SQL" },
};

const ALL_TAGS = ["All", "Cloud", "Local", "Search", "SQL", "NoSQL"];

export default function DBSelector({ providers, selectedDBs, compareMode, onToggle, unconfigured = new Set() }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const visible = providers.filter(p => {
    const meta = DB_META[p.name] || {};
    const matchTag = filter === "All" || meta.tag === filter;
    const matchSearch = !search || p.display_name.toLowerCase().includes(search.toLowerCase());
    return matchTag && matchSearch;
  });

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>
          {compareMode ? `COMPARE · ${selectedDBs.size} selected` : "SELECT DATABASE"}
        </span>
        <span className={styles.count}>{providers.length}</span>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}>⌕</span>
        <input
          className={styles.search}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search databases…"
        />
        {search && (
          <button className={styles.clearSearch} onClick={() => setSearch("")}>✕</button>
        )}
      </div>

      {/* Tag filters */}
      <div className={styles.filters}>
        {ALL_TAGS.map(t => (
          <button
            key={t}
            className={`${styles.filterBtn} ${filter === t ? styles.filterOn : ""}`}
            onClick={() => setFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* DB Grid */}
      <div className={styles.grid}>
        {visible.map(p => {
          const meta = DB_META[p.name] || { icon: "🗄️", color: "#6c63ff", tag: "" };
          const isActive = selectedDBs.has(p.name);
          return (
            <button
              key={p.name}
              className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
              onClick={() => onToggle(p.name)}
              style={isActive ? { "--ac": meta.color } : {}}
              title={p.display_name}
            >
              {compareMode && (
                <span className={`${styles.check} ${isActive ? styles.checkOn : ""}`}>
                  {isActive && "✓"}
                </span>
              )}
              <div className={styles.cardGlow} style={{ background: meta.color }} />
              <span className={styles.cardIcon}>{meta.icon}</span>
              <span className={styles.cardName}>{p.display_name}</span>
              <div className={styles.cardBottom}>
                <span className={styles.cardTag}>{meta.tag}</span>
                {unconfigured.has(p.name) && isActive && (
                  <span className={styles.needsSetup}>⚙ setup</span>
                )}
              </div>
              {isActive && (
                <span className={styles.activeDot} style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
              )}
            </button>
          );
        })}
        {visible.length === 0 && (
          <div className={styles.noMatch}>No databases match</div>
        )}
      </div>
    </div>
  );
}
