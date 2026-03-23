import { useState } from "react";
import DBSelector from "../db/DBSelector";
import ConfigPanel from "../panels/ConfigPanel";
import EmbeddingConfig from "../panels/EmbeddingConfig";
import CollectionManager from "../panels/CollectionManager";
import SchemaPanel from "../panels/SchemaPanel";
import styles from "./Sidebar.module.css";

const TABS = [
  { id: "dbs",      label: "Databases", icon: "🗄️" },
  { id: "config",   label: "Config",    icon: "⚙️" },
  { id: "explorer", label: "Explorer",  icon: "🔍" },
];

export default function Sidebar({
  providers, selectedDBs, compareMode, onToggle,
  dbConfigs, saveDbCfg, embCfg, saveEmbCfg, topK, onTopKChange,
  onUseCollection, mobileOpen, onMobileClose,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState("dbs");
  const [namespaces, setNamespaces] = useState([]);
  const [nsLoading, setNsLoading] = useState(false);

  const currentProvider = !compareMode
    ? providers.find(p => p.name === [...selectedDBs][0])
    : null;

  // Auto-switch to Config tab on DB selection so user immediately sees the settings
  const handleDBToggle = (name) => {
    onToggle(name);
    if (!compareMode) {
      setTab("config");
    }
  };

  const currentProviderForNs = !compareMode
    ? providers.find(p => p.name === [...selectedDBs][0])
    : null;

  async function fetchNamespaces() {
    if (!currentProviderForNs) return;
    const cfg = dbConfigs[currentProviderForNs.name] || {};
    const params = new URLSearchParams();
    Object.entries(cfg).forEach(([k, v]) => { if (v) params.set(k, v); });
    setNsLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8000/collections/${currentProviderForNs.name}?${params.toString()}`
      );
      const data = await res.json();
      const cols = data.collections || [];
      const nsSet = new Set();
      cols.forEach(c => {
        if (Array.isArray(c.namespaces)) c.namespaces.forEach(n => nsSet.add(n));
        else if (c.name) nsSet.add(c.name);
      });
      setNamespaces([...nsSet]);
    } catch { /* ignore */ }
    finally { setNsLoading(false); }
  }

  // Compute which DBs are "unconfigured" (have required fields missing)
  const unconfigured = new Set(
    providers
      .filter(p => {
        const required = (p.config_fields || []).filter(f => f.required);
        if (!required.length) return false;
        const vals = dbConfigs[p.name] || {};
        return required.some(f => !vals[f.key]?.toString().trim());
      })
      .map(p => p.name)
  );

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""} ${mobileOpen ? styles.mobileOpen : ""}`}>
      {/* Collapse toggle */}
      <button
        className={styles.collapseBtn}
        onClick={() => setCollapsed(v => !v)}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "›" : "‹"}
      </button>

      {!collapsed && (
        <>
          {/* Tab bar */}
          <div className={styles.tabBar}>
            {TABS.map(t => (
              <button
                key={t.id}
                className={`${styles.tab} ${tab === t.id ? styles.tabOn : ""}`}
                onClick={() => setTab(t.id)}
                title={t.label}
              >
                <span className={styles.tabIcon}>{t.icon}</span>
                <span className={styles.tabLabel}>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className={styles.content}>

            {/* ── Databases tab ─────────────────── */}
            {tab === "dbs" && (
              <div className={styles.section}>
                <DBSelector
                  providers={providers}
                  selectedDBs={selectedDBs}
                  compareMode={compareMode}
                  onToggle={handleDBToggle}
                  unconfigured={unconfigured}
                />
              </div>
            )}

            {/* ── Config tab ────────────────────── */}
            {tab === "config" && (
              <div className={styles.section}>
                {/* Active DB banner */}
                {currentProvider && (
                  <div className={styles.activeBanner}>
                    <span className={styles.activeBannerDot} />
                    <span className={styles.activeBannerName}>{currentProvider.display_name}</span>
                    {unconfigured.has(currentProvider.name) && (
                      <span className={styles.setupBadge}>Setup needed</span>
                    )}
                    <button
                      className={styles.switchBtn}
                      onClick={() => setTab("dbs")}
                      title="Switch database"
                    >
                      ⇄ Switch
                    </button>
                  </div>
                )}

                {/* ── Namespace Switcher ─────────────────── */}
                {!compareMode && currentProvider && (
                  <div className={styles.nsSwitcher}>
                    <div className={styles.nsHeader}>
                      <span className={styles.nsLabel}>Namespace</span>
                      <button
                        className={styles.nsRefresh}
                        onClick={fetchNamespaces}
                        disabled={nsLoading}
                        title="Fetch namespaces"
                      >
                        {nsLoading ? "…" : "🔄"}
                      </button>
                    </div>
                    {namespaces.length > 0 && (
                      <select
                        className={styles.nsSelect}
                        value={dbConfigs[currentProvider.name]?.namespace || ""}
                        onChange={e => saveDbCfg(currentProvider.name, "namespace", e.target.value)}
                      >
                        <option value="">— select namespace —</option>
                        {namespaces.map(ns => (
                          <option key={ns} value={ns}>{ns}</option>
                        ))}
                      </select>
                    )}
                    <input
                      className={styles.nsInput}
                      type="text"
                      placeholder="Or type custom namespace…"
                      value={dbConfigs[currentProvider.name]?.namespace || ""}
                      onChange={e => saveDbCfg(currentProvider.name, "namespace", e.target.value)}
                    />
                  </div>
                )}

                {!compareMode && currentProvider && (
                  <ConfigPanel
                    title={`${currentProvider.display_name} Config`}
                    fields={currentProvider.config_fields}
                    values={dbConfigs[currentProvider.name] || {}}
                    onChange={(f, v) => saveDbCfg(currentProvider.name, f, v)}
                  />
                )}
                {compareMode && [...selectedDBs].map(db => {
                  const p = providers.find(x => x.name === db);
                  return p ? (
                    <ConfigPanel
                      key={db}
                      title={`${p.display_name} Config`}
                      fields={p.config_fields}
                      values={dbConfigs[db] || {}}
                      onChange={(f, v) => saveDbCfg(db, f, v)}
                    />
                  ) : null;
                })}
                {!compareMode && !currentProvider && (
                  <div className={styles.empty}>Select a database to configure</div>
                )}
                <EmbeddingConfig
                  values={embCfg}
                  onChange={saveEmbCfg}
                  topK={topK}
                  onTopKChange={onTopKChange}
                />
              </div>
            )}

            {/* ── Explorer tab ──────────────────── */}
            {tab === "explorer" && (
              <div className={styles.section}>
                <CollectionManager
                  selectedDBs={selectedDBs}
                  dbConfigs={dbConfigs}
                  compareMode={compareMode}
                  onUseCollection={onUseCollection}
                />
                <SchemaPanel
                  providers={providers}
                  dbConfigs={dbConfigs}
                  selectedDBs={selectedDBs}
                />
              </div>
            )}
          </div>

          {/* Footer: selected DB indicator */}
          <div className={styles.footer}>
            {[...selectedDBs].map(db => {
              const p = providers.find(x => x.name === db);
              return p ? (
                <div key={db} className={styles.footerDB}>
                  <span className={styles.footerDot} />
                  <span className={styles.footerName}>{p.display_name}</span>
                </div>
              ) : null;
            })}
          </div>
        </>
      )}

      {/* Collapsed: icon strip */}
      {collapsed && (
        <div className={styles.iconStrip}>
          {providers.slice(0, 8).map(p => {
            const isActive = selectedDBs.has(p.name);
            return (
              <button
                key={p.name}
                className={`${styles.stripItem} ${isActive ? styles.stripActive : ""}`}
                onClick={() => onToggle(p.name)}
                title={p.display_name}
              >
                {/* icon from DBSelector meta via data-attr trick */}
                <span className={styles.stripIcon}>{p.display_name.slice(0,1)}</span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
