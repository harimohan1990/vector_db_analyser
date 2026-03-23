import React, { useState } from "react";
import styles from "./SchemaPanel.module.css";

const DB_ICONS = {
  pinecone:"🌲",chroma:"🎨",deeplake:"🌊",vespa:"🚀",milvus:"⚡",
  scann:"🔎",weaviate:"🕸️",qdrant:"🎯",vald:"🔷",faiss:"📦",
  opensearch:"🔍",pgvector:"🐘",cassandra:"💫",elasticsearch:"🔶",clickhouse:"🖱️",
};

function TreeNode({ icon, label, children, defaultOpen = false, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = children && React.Children.count(children) > 0;
  return (
    <div className={styles.node}>
      <div
        className={`${styles.nodeRow} ${hasChildren ? styles.clickable : ""}`}
        onClick={() => hasChildren && setOpen(v => !v)}
      >
        {hasChildren && <span className={styles.arrow}>{open ? "▾" : "▸"}</span>}
        {!hasChildren && <span className={styles.leaf}>·</span>}
        <span className={styles.nodeIcon}>{icon}</span>
        <span className={styles.nodeLabel}>{label}</span>
        {badge && <span className={styles.badge}>{badge}</span>}
      </div>
      {open && hasChildren && <div className={styles.children}>{children}</div>}
    </div>
  );
}

export default function SchemaPanel({ providers, dbConfigs, selectedDBs }) {
  const [search, setSearch] = useState("");

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>SCHEMA BROWSER</span>
      </div>
      <div className={styles.searchWrap}>
        <input
          className={styles.search}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter..."
        />
      </div>
      <div className={styles.tree}>
        {providers
          .filter(p => !search || p.name.includes(search) || p.display_name.toLowerCase().includes(search.toLowerCase()))
          .map(p => {
            const config = dbConfigs[p.name] || {};
            const isConnected = selectedDBs.has(p.name);
            return (
              <TreeNode
                key={p.name}
                icon={DB_ICONS[p.name] || "🗄️"}
                label={p.display_name}
                badge={isConnected ? "●" : undefined}
                defaultOpen={isConnected}
              >
                {p.config_fields.map(f => (
                  <TreeNode
                    key={f.key}
                    icon={f.type === "password" ? "🔒" : "⚙"}
                    label={f.label}
                    badge={config[f.key] ? (f.type === "password" ? "••••" : String(config[f.key]).slice(0, 20)) : undefined}
                  />
                ))}
              </TreeNode>
            );
          })}
      </div>
    </div>
  );
}
