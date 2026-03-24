import { useState, useEffect } from "react";
import styles from "./QueryCollectionsPanel.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";
const STORAGE_KEY = "vdb_collections";

function loadCollections() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCollections(cols) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
  } catch {}
}

export default function QueryCollectionsPanel({ onClose, onRunQuery }) {
  const [collections, setCollections] = useState(() => loadCollections());
  const [selectedCol, setSelectedCol] = useState(() => {
    const cols = loadCollections();
    const keys = Object.keys(cols);
    return keys[0] ?? "";
  });
  const [newColName, setNewColName] = useState("");
  const [newQuery, setNewQuery] = useState("");
  const [showNewCol, setShowNewCol] = useState(false);

  function persist(cols) {
    setCollections(cols);
    saveCollections(cols);
  }

  function createCollection() {
    const name = newColName.trim();
    if (!name || collections[name]) return;
    const updated = { ...collections, [name]: [] };
    persist(updated);
    setSelectedCol(name);
    setNewColName("");
    setShowNewCol(false);
  }

  function deleteCollection(name) {
    const updated = { ...collections };
    delete updated[name];
    persist(updated);
    if (selectedCol === name) {
      setSelectedCol(Object.keys(updated)[0] ?? "");
    }
  }

  function addQuery() {
    const q = newQuery.trim();
    if (!q || !selectedCol) return;
    const updated = {
      ...collections,
      [selectedCol]: [...(collections[selectedCol] ?? []), { id: Date.now(), text: q }],
    };
    persist(updated);
    setNewQuery("");
  }

  function deleteQuery(colName, queryId) {
    const updated = {
      ...collections,
      [colName]: collections[colName].filter((q) => q.id !== queryId),
    };
    persist(updated);
  }

  const colNames = Object.keys(collections);
  const currentQueries = collections[selectedCol] ?? [];

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.icon}>📚</span>
            <h2 className={styles.title}>Query Collections</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.layout}>
            {/* Left sidebar: collections */}
            <div className={styles.sidebar}>
              <div className={styles.sidebarHeader}>
                <span className={styles.sidebarTitle}>Collections</span>
                <button
                  className={styles.newColBtn}
                  onClick={() => setShowNewCol(true)}
                  title="New collection"
                >+</button>
              </div>

              {showNewCol && (
                <div className={styles.newColForm}>
                  <input
                    type="text"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") createCollection(); if (e.key === "Escape") setShowNewCol(false); }}
                    placeholder="Collection name…"
                    className={styles.newColInput}
                    autoFocus
                  />
                  <div className={styles.newColActions}>
                    <button className={styles.createColBtn} onClick={createCollection}>Create</button>
                    <button className={styles.cancelColBtn} onClick={() => setShowNewCol(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {colNames.length === 0 && !showNewCol && (
                <div className={styles.emptyCol}>
                  <span className={styles.emptyIcon}>📚</span>
                  <p>No collections</p>
                </div>
              )}

              {colNames.map((name) => (
                <div
                  key={name}
                  className={`${styles.colItem} ${selectedCol === name ? styles.colItemActive : ""}`}
                  onClick={() => setSelectedCol(name)}
                >
                  <span className={styles.colName}>{name}</span>
                  <span className={styles.colCount}>{collections[name]?.length ?? 0}</span>
                  <button
                    className={styles.colDelBtn}
                    onClick={(e) => { e.stopPropagation(); deleteCollection(name); }}
                    title="Delete collection"
                  >×</button>
                </div>
              ))}
            </div>

            {/* Right panel: queries */}
            <div className={styles.queryPanel}>
              {!selectedCol ? (
                <div className={styles.emptyPanel}>
                  <span className={styles.emptyIcon}>📝</span>
                  <p>Select or create a collection</p>
                </div>
              ) : (
                <>
                  <div className={styles.queryPanelHeader}>
                    <span className={styles.queryPanelTitle}>{selectedCol}</span>
                    <span className={styles.queryCount}>{currentQueries.length} quer{currentQueries.length !== 1 ? "ies" : "y"}</span>
                  </div>

                  {currentQueries.length === 0 && (
                    <div className={styles.emptyPanel}>
                      <span className={styles.emptyIcon}>🔍</span>
                      <p>No queries yet. Add one below.</p>
                    </div>
                  )}

                  <div className={styles.queryList}>
                    {currentQueries.map((q, i) => (
                      <div key={q.id} className={styles.queryRow}>
                        <span className={styles.queryNum}>{i + 1}</span>
                        <span className={styles.queryText}>{q.text}</span>
                        <div className={styles.queryActions}>
                          <button
                            className={styles.runBtn}
                            onClick={() => onRunQuery && onRunQuery(q.text)}
                            title="Run query"
                          >▶ Run</button>
                          <button
                            className={styles.queryDelBtn}
                            onClick={() => deleteQuery(selectedCol, q.id)}
                            title="Delete"
                          >×</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={styles.addQueryRow}>
                    <input
                      type="text"
                      value={newQuery}
                      onChange={(e) => setNewQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addQuery()}
                      placeholder="Add a query…"
                      className={styles.addQueryInput}
                    />
                    <button
                      className={styles.addQueryBtn}
                      onClick={addQuery}
                      disabled={!newQuery.trim()}
                    >Add</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
