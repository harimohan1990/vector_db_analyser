import { useState, useCallback, useEffect } from "react";
import styles from "./CollectionManager.module.css";
import cpStyles from "./ConfigPanel.module.css";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function CollectionManager({ selectedDBs, dbConfigs, compareMode, onUseCollection }) {
  const [collections, setCollections]   = useState({});
  const [loading, setLoading]           = useState({});
  const [expanded, setExpanded]         = useState(true);
  const [activeNS, setActiveNS]         = useState({});
  const [error, setError]               = useState({});
  const [justUsed, setJustUsed]         = useState({}); // flash confirmation per col name

  const fetchCollections = useCallback(async (db) => {
    const config = dbConfigs[db] || {};
    const params = new URLSearchParams();
    Object.entries(config).forEach(([k, v]) => { if (v !== "" && v != null) params.set(k, v); });
    setLoading(prev => ({ ...prev, [db]: true }));
    setError(prev => ({ ...prev, [db]: null }));
    try {
      const res = await fetch(`${API}/collections/${db}?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setCollections(prev => ({ ...prev, [db]: data.collections }));
    } catch (e) {
      setError(prev => ({ ...prev, [db]: e.message }));
    } finally {
      setLoading(prev => ({ ...prev, [db]: false }));
    }
  }, [dbConfigs]);

  // Auto-fetch when a required credential is set
  useEffect(() => {
    for (const db of selectedDBs) {
      const cfg = dbConfigs[db] || {};
      const hasKey = cfg.api_key || cfg.url || cfg.host;
      if (hasKey && !collections[db] && !loading[db]) {
        fetchCollections(db);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(dbConfigs), JSON.stringify([...selectedDBs])]);

  function handleUse(db, colName, ns) {
    onUseCollection?.(db, colName, ns);
    // Flash "✓ Used" for 1.5s
    const key = `${db}::${colName}`;
    setJustUsed(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setJustUsed(prev => { const n = { ...prev }; delete n[key]; return n; }), 1500);
  }

  function handleNsUse(db, colName, ns) {
    setActiveNS(prev => ({ ...prev, [db]: ns === prev[db] ? "" : ns }));
    onUseCollection?.(db, colName, ns);
    const key = `${db}::${colName}::${ns}`;
    setJustUsed(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setJustUsed(prev => { const n = { ...prev }; delete n[key]; return n; }), 1500);
  }

  const currentIndexName = (db) =>
    (dbConfigs[db] || {}).index_name || (dbConfigs[db] || {}).collection_name || "";

  const dbs = [...selectedDBs];

  return (
    <div className={cpStyles.panel}>
      <button className={cpStyles.toggle} onClick={() => setExpanded(v => !v)}>
        <span>Collections &amp; Indexes</span>
        <span className={cpStyles.chevron}>{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className={styles.body}>
          {dbs.length === 0 && (
            <div className={styles.noDb}>
              <span className={styles.noDbIcon}>🗄️</span>
              <span>Select a database first</span>
            </div>
          )}

          {dbs.map(db => {
            const cfg = dbConfigs[db] || {};
            const hasCredentials = cfg.api_key || cfg.url || cfg.host;
            const cols = collections[db] || [];
            const isLoading = loading[db];
            const err = error[db];

            return (
              <div key={db} className={styles.dbBlock}>
                {/* DB header row */}
                <div className={styles.dbHeader}>
                  <span className={styles.dbName}>{db}</span>
                  <button
                    className={`${styles.fetchBtn} ${isLoading ? styles.fetchBtnLoading : ""}`}
                    onClick={() => fetchCollections(db)}
                    disabled={isLoading}
                    title={isLoading ? "Fetching…" : "Fetch collections / indexes"}
                  >
                    <span className={`${styles.fetchIcon} ${isLoading ? styles.spinning : ""}`}>
                      ↺
                    </span>
                    <span>{isLoading ? "Fetching…" : cols.length ? "Refetch" : "Fetch"}</span>
                  </button>
                </div>

                {/* No credentials warning */}
                {!hasCredentials && !err && (
                  <div className={styles.credHint}>
                    <span className={styles.credHintIcon}>⚙️</span>
                    <span>Add credentials in <strong>Config tab</strong> first</span>
                  </div>
                )}

                {/* Error with retry */}
                {err && (
                  <div className={styles.err}>
                    <span className={styles.errText}>⚠ {err}</span>
                    <button className={styles.retryBtn} onClick={() => fetchCollections(db)}>
                      Retry
                    </button>
                  </div>
                )}

                {/* Empty result */}
                {!isLoading && !err && hasCredentials && cols.length === 0 && collections[db] && (
                  <div className={styles.empty}>No collections found in this database</div>
                )}

                {/* Hint before first fetch */}
                {!isLoading && !err && !collections[db] && hasCredentials && (
                  <div className={styles.hint}>Click <strong>Fetch</strong> to list indexes ↑</div>
                )}

                {/* Collection cards */}
                {cols.map(col => {
                  const isActive  = currentIndexName(db) === col.name;
                  const usedKey   = `${db}::${col.name}`;
                  const wasUsed   = justUsed[usedKey];

                  return (
                    <div
                      key={col.name}
                      className={`${styles.colCard} ${isActive ? styles.colActive : ""}`}
                    >
                      {/* Top row: name + status + use button */}
                      <div className={styles.colTop}>
                        <span className={styles.colName} title={col.name}>{col.name}</span>
                        <div className={styles.colActions}>
                          <span className={`${styles.badge} ${col.status === "ready" ? styles.green : styles.yellow}`}>
                            {col.status || "unknown"}
                          </span>

                          {isActive ? (
                            <span className={styles.activeTag}>✓ Active</span>
                          ) : wasUsed ? (
                            <span className={styles.usedTag}>✓ Set!</span>
                          ) : (
                            <button
                              className={styles.useBtn}
                              onClick={() => handleUse(db, col.name, col.namespaces?.[0])}
                              title={`Use index "${col.name}"`}
                            >
                              ▶ Use
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className={styles.colMeta}>
                        <span className={styles.metaItem}>
                          <span className={styles.metaIcon}>⬡</span>
                          <b>{(col.vector_count ?? 0).toLocaleString()}</b> vecs
                        </span>
                        {col.dimension && (
                          <span className={styles.metaItem}>
                            <span className={styles.metaIcon}>📐</span>
                            <b>{col.dimension}</b>D
                          </span>
                        )}
                        {col.vector_count === 0 && (
                          <span className={styles.emptyWarn}>⚠ empty</span>
                        )}
                      </div>

                      {/* Score / fill bar */}
                      {col.vector_count > 0 && (
                        <div className={styles.fillBar}>
                          <div
                            className={styles.fillBarInner}
                            style={{ width: `${Math.min(100, (col.vector_count / 1000) * 100)}%` }}
                          />
                        </div>
                      )}

                      {/* Namespace chips */}
                      {col.namespaces?.length > 0 && (
                        <div className={styles.nsList}>
                          <div className={styles.nsLabel}>Namespaces</div>
                          <div className={styles.nsChips}>
                            {col.namespaces.map(ns => {
                              const nsKey   = `${db}::${col.name}::${ns}`;
                              const nsUsed  = justUsed[nsKey];
                              const isNsAct = activeNS[db] === ns;
                              return (
                                <button
                                  key={ns || "__default__"}
                                  className={`${styles.nsChip} ${isNsAct ? styles.nsActive : ""} ${nsUsed ? styles.nsUsed : ""}`}
                                  onClick={() => handleNsUse(db, col.name, ns)}
                                  title={`Use namespace "${ns || "(default)"}"`}
                                >
                                  {nsUsed ? "✓" : isNsAct ? "● " : ""}{ns || "(default)"}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
