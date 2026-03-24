import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import QueryEditor from "./components/search/QueryEditor";
import ResultCard from "./components/search/ResultCard";
import MultiResultsView from "./components/search/MultiResultsView";
import StatsBar from "./components/layout/StatsBar";
import Dashboard from "./components/panels/Dashboard";
import EmptyState from "./components/search/EmptyState";
import SQLBook, { saveQuery } from "./components/panels/SQLBook";
import Sidebar from "./components/layout/Sidebar";
import EmbeddingInspector from "./components/panels/EmbeddingInspector";
import HybridSearchPanel from "./components/panels/HybridSearchPanel";
import MetricsPanel from "./components/panels/MetricsPanel";
import UpsertPanel from "./components/panels/UpsertPanel";
import ResultExplorer from "./components/panels/ResultExplorer";
import EmbeddingGraph from "./components/panels/EmbeddingGraph";
import VectorPlayground from "./components/panels/VectorPlayground";
import RAGEvalPanel from "./components/panels/RAGEvalPanel";
import QueryRewritePanel from "./components/panels/QueryRewritePanel";
import ChunkingPanel from "./components/panels/ChunkingPanel";
import DriftPanel from "./components/panels/DriftPanel";
import ABTestPanel from "./components/panels/ABTestPanel";
import ProductionMonitor from "./components/panels/ProductionMonitor";
import RerankerPanel from "./components/panels/RerankerPanel";
import PromptPlayground from "./components/panels/PromptPlayground";
import OptimizePanel from "./components/panels/OptimizePanel";
import StreamingSearch from "./components/panels/StreamingSearch";
import BatchSearchPanel from "./components/panels/BatchSearchPanel";
import QueryDiffPanel from "./components/panels/QueryDiffPanel";
import MetadataFilterPanel from "./components/panels/MetadataFilterPanel";
import NegativeQueryPanel from "./components/panels/NegativeQueryPanel";
import QueryAutocompleteDemo from "./components/panels/QueryAutocompleteDemo";
import VectorMap2D from "./components/panels/VectorMap2D";
import SimilarityHeatmap from "./components/panels/SimilarityHeatmap";
import LatencyTimeline from "./components/panels/LatencyTimeline";
import CostEstimator from "./components/panels/CostEstimator";
import IndexMigrationPanel from "./components/panels/IndexMigrationPanel";
import NamespaceManagerPanel from "./components/panels/NamespaceManagerPanel";
import DuplicateDetectorPanel from "./components/panels/DuplicateDetectorPanel";
import ChangeLogPanel from "./components/panels/ChangeLogPanel";
import ScheduledQueriesPanel from "./components/panels/ScheduledQueriesPanel";
import ShareableLinkPanel from "./components/panels/ShareableLinkPanel";
import QueryCollectionsPanel from "./components/panels/QueryCollectionsPanel";
import GoldenDatasetPanel from "./components/panels/GoldenDatasetPanel";
import RelevanceFeedbackPanel from "./components/panels/RelevanceFeedbackPanel";
import AIChatBot from "./components/chat/AIChatBot";
import { ToastProvider, toast } from "./components/layout/Toast";
import { useQueryHistory } from "./hooks/useQueryHistory";
import { exportJSON, exportCSV } from "./utils/exportResults";
import styles from "./App.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";
const DESTRUCTIVE = ["delete", "drop", "truncate", "remove all", "clear", "wipe"];

/* ── Skeleton loading cards ────────────────────── */
const SkeletonCard = memo(({ delay = 0 }) => (
  <div className={styles.skeleton} style={{ animationDelay: `${delay}ms` }}>
    <div className={styles.skeletonHeader}>
      <div className={styles.skeletonRank} />
      <div className={styles.skeletonId} />
      <div className={styles.skeletonScore} />
    </div>
    <div className={styles.skeletonBody}>
      <div className={styles.skeletonLine} style={{ width: "92%" }} />
      <div className={styles.skeletonLine} style={{ width: "78%" }} />
      <div className={styles.skeletonLine} style={{ width: "55%" }} />
    </div>
  </div>
));

/* ── No results diagnostic ──────────────────────── */
const NoResultsDiag = memo(function NoResultsDiag({
  meta, embCfg, dbConfigs, selectedDBs, onSaveDbCfg, onSaveEmbCfg, onSearch,
}) {
  const db = [...(selectedDBs || [])][0] || "";
  const cfg = dbConfigs?.[db] || {};
  const currentIndex = cfg.index_name || cfg.collection_name || "";
  const currentNS = cfg.namespace || "";
  const actualDim = meta?.dim;
  const model = embCfg?.embedding_model || "local";
  const isPinecone = db === "pinecone";

  const applyDemo = useCallback(() => {
    if (!isPinecone) return;
    onSaveDbCfg(db, "index_name", "langraph-local-384");
    onSaveDbCfg(db, "namespace", "tutorials");
    onSaveEmbCfg("embedding_model", "local");
    setTimeout(() => onSearch("LangGraph tutorial step by step"), 120);
  }, [isPinecone, db, onSaveDbCfg, onSaveEmbCfg, onSearch]);

  return (
    <div className={styles.noResultsDiag}>
      <div className={styles.noResultsIcon}>🔍</div>
      <div className={styles.noResultsTitle}>No results returned</div>
      <div className={styles.currentCfg}>
        Searching <code>{currentIndex || "(no index set)"}</code>
        {currentNS ? <> · ns <code>{currentNS}</code></> : null}
        {actualDim ? <> · <code>{actualDim}D</code></> : null}
      </div>
      {isPinecone && (
        <button className={styles.demoBtn} onClick={applyDemo}>
          ⚡ Load Demo Index &amp; Search
          <span className={styles.demoBtnSub}>langraph-local-384 · 20 vectors · 384D local</span>
        </button>
      )}
      <div className={styles.noResultsTips}>
        <div className={styles.tipRow}>
          <span className={styles.tipIcon}>📋</span>
          <span>Click <strong>↺ Fetch</strong> in Collections tab → click <strong>Use</strong> on a populated index</span>
        </div>
        {actualDim === 384 && model !== "local" && (
          <div className={styles.tipRow}>
            <span className={styles.tipIcon}>⚠️</span>
            <span className={styles.tipWarn}>OpenAI quota exhausted — fell back to 384D. Index must match.</span>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── App ────────────────────────────────────────── */
export default function App() {
  const [providers, setProviders]       = useState([]);
  const [selectedDBs, setSelectedDBs]   = useState(new Set(["pinecone"]));
  const [compareMode, setCompareMode]   = useState(false);
  const [dbConfigs, setDbConfigs]       = useState({});
  const [embCfg, setEmbCfg]            = useState({ openai_api_key: "", embedding_model: "local" });
  const [topK, setTopK]                 = useState(5);
  const [allResults, setAllResults]     = useState(null);   // accumulated across pages
  const [hasMore, setHasMore]           = useState(false);
  const [loadingMore, setLoadingMore]   = useState(false);
  const offsetRef    = useRef(0);   // not state — no re-render on page advance
  const [lastSearchMeta, setLastSearchMeta] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [backendOk, setBackendOk]       = useState(true);
  const [showDash, setShowDash]         = useState(false);
  const [showBook, setShowBook]         = useState(false);
  const [showEmbInspector, setShowEmbInspector] = useState(false);
  const [showHybrid, setShowHybrid]     = useState(false);
  const [showMetrics, setShowMetrics]   = useState(false);
  const [showUpsert, setShowUpsert]     = useState(false);
  const [safeMode, setSafeMode]         = useState(true);
  const [theme, setTheme]               = useState(() => localStorage.getItem("vdb_theme") || "aurora");
  const [sidebarOpen, setSidebarOpen]   = useState(false); // mobile drawer
  const pendingQuery = useRef(null);
  const lastQueryRef = useRef("");
  const sentinelRef  = useRef(null);
  const { addEntry } = useQueryHistory();

  // Feature 1: Result Explorer
  const [explorerItem, setExplorerItem] = useState(null);

  // Feature 4: Embedding Graph
  const [showGraph, setShowGraph]       = useState(false);

  // Feature 5: AI Explanation
  const [explanation, setExplanation]   = useState(null);
  const [explaining, setExplaining]     = useState(false);
  const currentQuery = useRef("");

  // Feature 6: API Debug Panel
  const [apiDebug, setApiDebug]         = useState(null);
  const [showApiDebug, setShowApiDebug] = useState(false);

  // Feature 7: Vector Playground
  const [showPlayground, setShowPlayground] = useState(false);

  // Advanced features (20 new panels)
  const [showRAGEval, setShowRAGEval]         = useState(false);
  const [showRewrite, setShowRewrite]         = useState(false);
  const [showChunking, setShowChunking]       = useState(false);
  const [showDrift, setShowDrift]             = useState(false);
  const [showABTest, setShowABTest]           = useState(false);
  const [showMonitor, setShowMonitor]         = useState(false);
  const [showReranker, setShowReranker]       = useState(false);
  const [showPromptPG, setShowPromptPG]       = useState(false);
  const [showOptimize, setShowOptimize]       = useState(false);
  const [showStreaming, setShowStreaming]      = useState(false);
  const [showMobileMore, setShowMobileMore]   = useState(false);

  // 20 new feature panels
  const [showBatchSearch, setShowBatchSearch]         = useState(false);
  const [showQueryDiff, setShowQueryDiff]             = useState(false);
  const [showMetadataFilter, setShowMetadataFilter]   = useState(false);
  const [showNegativeQuery, setShowNegativeQuery]     = useState(false);
  const [showAutoComplete, setShowAutoComplete]       = useState(false);
  const [showVectorMap, setShowVectorMap]             = useState(false);
  const [showHeatmap, setShowHeatmap]                 = useState(false);
  const [showLatency, setShowLatency]                 = useState(false);
  const [showCostEstimator, setShowCostEstimator]     = useState(false);
  const [showIndexMigration, setShowIndexMigration]   = useState(false);
  const [showNsManager, setShowNsManager]             = useState(false);
  const [showDuplicates, setShowDuplicates]           = useState(false);
  const [showChangeLog, setShowChangeLog]             = useState(false);
  const [showScheduled, setShowScheduled]             = useState(false);
  const [showShareLink, setShowShareLink]             = useState(false);
  const [showQueryCols, setShowQueryCols]             = useState(false);
  const [showGoldenDS, setShowGoldenDS]               = useState(false);
  const [showFeedback, setShowFeedback]               = useState(false);
  const [chatOpen, setChatOpen]                       = useState(false);

  /* ── Init ─────────────────────────────────────── */
  useEffect(() => {
    const sc = localStorage.getItem("vdb_db_configs");
    if (sc) try { setDbConfigs(JSON.parse(sc)); } catch {}
    const se = localStorage.getItem("vdb_emb_cfg");
    if (se) try { setEmbCfg(JSON.parse(se)); } catch {}
    const th = localStorage.getItem("vdb_theme");
    if (th) setTheme(th);

    fetch(`${API}/providers`, { signal: AbortSignal.timeout(5000) })
      .then(r => r.json())
      .then(data => { setProviders(data); setBackendOk(true); })
      .catch(() => { setBackendOk(false); toast("Backend offline — start uvicorn on :8000", "error"); });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("vdb_theme", theme);
  }, [theme]);

  /* ── Config setters (stable refs via useCallback) */
  const saveDbCfg = useCallback((db, field, value) => {
    setDbConfigs(prev => {
      const next = { ...prev, [db]: { ...(prev[db] || {}), [field]: value } };
      localStorage.setItem("vdb_db_configs", JSON.stringify(next));
      return next;
    });
  }, []);

  const saveEmbCfg = useCallback((field, value) => {
    setEmbCfg(prev => {
      const next = { ...prev, [field]: value };
      localStorage.setItem("vdb_emb_cfg", JSON.stringify(next));
      return next;
    });
  }, []);

  /* ── DB toggle ────────────────────────────────── */
  const toggleDB = useCallback((name) => {
    setSidebarOpen(false); // close mobile drawer on selection
    setSelectedDBs(prev => {
      const next = new Set(prev);
      if (compareMode) {
        next.has(name) ? next.delete(name) : next.add(name);
        if (next.size === 0) next.add(name);
      } else {
        next.clear(); next.add(name);
      }
      return next;
    });
  }, [compareMode]);

  const toggleCompareMode = useCallback(() => {
    setCompareMode(v => {
      if (v) setSelectedDBs(prev => new Set([[...prev][0]]));
      return !v;
    });
    setAllResults(null);
  }, []);

  /* ── Embedding pre-warm (instant search) ─────── */
  const prefetchEmbedding = useCallback(async (text) => {
    try {
      await fetch(`${API}/inspect/embedding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, openai_api_key: embCfg.openai_api_key || "", embedding_model: embCfg.embedding_model }),
      });
    } catch { /* fire-and-forget */ }
  }, [embCfg.openai_api_key, embCfg.embedding_model]);

  /* ── Search ───────────────────────────────────── */
  const handleSearch = useCallback(async (query) => {
    if (!query?.trim()) return;
    if (safeMode) {
      const lower = query.toLowerCase();
      const hit = DESTRUCTIVE.find(w => lower.includes(w));
      if (hit) {
        toast(`Safe Mode blocked "${hit}". Toggle 🛡️ off to proceed.`, "error");
        return;
      }
    }
    setLoading(true);
    setAllResults(null);
    setHasMore(false);
    offsetRef.current = 0;
    setLastSearchMeta(null);
    setExplanation(null);
    lastQueryRef.current = query;
    currentQuery.current = query;
    const dbs = [...selectedDBs];

    try {
      let newResults;
      if (!compareMode || dbs.length === 1) {
        const res = await fetch(`${API}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, db_type: dbs[0], config: dbConfigs[dbs[0]] || {}, top_k: topK, ...embCfg }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
        newResults = new Map([[dbs[0], { results: data.results, latency_ms: data.latency_ms, error: null }]]);
        setLastSearchMeta({ dim: data.embedding_dim, model: data.embedding_model });
        setHasMore(!!data.has_more);
        offsetRef.current = topK;

        // Show fallback warning if OpenAI embedding failed
        if (data.embedding_fallback) {
          toast(`⚠ ${data.embedding_fallback_reason || "OpenAI unavailable"} — using local 384D model`, "error");
        }

        // Feature 6: capture debug info
        setApiDebug({
          method: 'POST',
          url: `${API}/search`,
          body: { query, db_type: dbs[0], config: '(hidden)', top_k: topK },
          status: res.status,
          latency_ms: data.latency_ms,
          embedding_dim: data.embedding_dim,
          embedding_model: data.embedding_model,
          embedding_fallback: data.embedding_fallback || false,
          result_count: data.results.length,
          has_more: data.has_more,
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        const res = await fetch(`${API}/search/multi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            targets: dbs.map(db => ({ db_type: db, config: dbConfigs[db] || {} })),
            top_k: topK, ...embCfg,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
        const multiResults = data.results || data;
        newResults = new Map(multiResults.map(d => [d.db_type, d]));
        const errs = multiResults.filter(d => d.error).length;
        if (errs) toast(`${errs} DB error${errs > 1 ? "s" : ""}`, "error");
        if (data.embedding_fallback) {
          toast(`⚠ ${data.embedding_fallback_reason || "OpenAI unavailable"} — using local 384D model`, "error");
        }
      }

      setAllResults(newResults);
      const total  = [...newResults.values()].reduce((a, d) => a + d.results.length, 0);
      const scores = [...newResults.values()].flatMap(d => d.results.map(r => r.score));
      const avgS   = scores.length ? scores.reduce((a, b) => a + b) / scores.length : 0;
      const avgL   = [...newResults.values()].reduce((a, d) => a + d.latency_ms, 0) / newResults.size;
      addEntry(query, { dbs: dbs.map(db => ({ db, count: newResults.get(db)?.results?.length || 0 })), total, avgS, avgL });
      toast(`${total} result${total !== 1 ? "s" : ""} · ${Math.round(avgL)}ms`, "success");
    } catch (err) {
      toast(err.message, "error");
      setAllResults(new Map());
    } finally {
      setLoading(false);
    }
  }, [selectedDBs, compareMode, dbConfigs, embCfg, topK, safeMode, addEntry]);

  /* ── Load more (infinite scroll) ─────────────── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || compareMode) return;
    const query = lastQueryRef.current;
    if (!query) return;
    const dbs = [...selectedDBs];
    const currentOffset = offsetRef.current;
    setLoadingMore(true);
    try {
      const res = await fetch(`${API}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query, db_type: dbs[0],
          config: dbConfigs[dbs[0]] || {},
          top_k: topK,
          offset: currentOffset,
          ...embCfg,
        }),
      });
      const data = await res.json();
      if (res.ok && data.results?.length > 0) {
        offsetRef.current = currentOffset + topK;
        setAllResults(prev => {
          const existing = prev?.get(dbs[0])?.results || [];
          return new Map([[dbs[0], {
            ...(prev?.get(dbs[0]) || {}),
            results: [...existing, ...data.results],
          }]]);
        });
        setHasMore(!!data.has_more && data.results.length > 0);
      } else {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, compareMode, selectedDBs, dbConfigs, embCfg, topK]);

  /* ── IntersectionObserver for sentinel ────────── */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  /* ── Rerun from dashboard ─────────────────────── */
  const rerun = useCallback((query) => {
    pendingQuery.current = query;
    setShowDash(false);
  }, []);
  useEffect(() => {
    if (!showDash && pendingQuery.current) {
      const q = pendingQuery.current;
      pendingQuery.current = null;
      handleSearch(q);
    }
  }, [showDash, handleSearch]);

  /* ── Derived values (memoized) ────────────────── */
  const currentProvider = useMemo(
    () => !compareMode ? providers.find(p => p.name === [...selectedDBs][0]) : null,
    [compareMode, providers, selectedDBs]
  );
  const hasResults    = allResults !== null && allResults.size > 0;
  const totalCount    = useMemo(
    () => allResults ? [...allResults.values()].reduce((a, d) => a + d.results.length, 0) : 0,
    [allResults]
  );
  const singleResults = useMemo(
    () => hasResults && !compareMode ? [...allResults.values()][0]?.results || [] : [],
    [hasResults, compareMode, allResults]
  );

  const onUseCollection = useCallback((db, colName, namespace) => {
    saveDbCfg(db, "index_name", colName);
    if (namespace !== undefined) saveDbCfg(db, "namespace", namespace);
    toast(`Switched to "${colName}"${namespace ? ` · ns "${namespace}"` : ""}`, "success");
    setSidebarOpen(false);
  }, [saveDbCfg]);

  const toggleSafeMode = useCallback(() => {
    setSafeMode(v => { toast(!v ? "Safe Mode ON" : "Safe Mode OFF", "info"); return !v; });
  }, []);

  const THEMES = ["aurora", "dark", "neon", "rose", "midnight", "ocean", "light"];
  const THEME_ICONS = { aurora: "✦", dark: "☀️", neon: "⚡", rose: "🌸", midnight: "🌌", ocean: "🌊", light: "🌙" };
  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];
      return next;
    });
  }, []);

  /* ── Feature 5: Explain handler ───────────────── */
  const handleExplain = useCallback(async () => {
    if (!singleResults.length) return;
    setExplaining(true);
    try {
      const res = await fetch(`${API}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentQuery.current, results: singleResults }),
      });
      const data = await res.json();
      setExplanation(data.explanation);
    } catch { setExplanation("Could not generate explanation."); }
    finally { setExplaining(false); }
  }, [singleResults]);

  return (
    <ToastProvider>
      <div className={styles.root} data-theme={theme}>

        {/* ── Header ──────────────────────────────── */}
        <header className={styles.header} role="banner">

          {/* ── Row 1: Logo + Controls ── */}
          <div className={styles.headerTop}>
            <div className={styles.hLeft}>
              <button
                className={styles.hamburger}
                onClick={() => setSidebarOpen(v => !v)}
                aria-label="Toggle sidebar"
              >
                <span className={styles.hamburgerIcon}>☰</span>
              </button>
              <div className={styles.logo}>
                <span className={styles.logoIcon}>⬡</span>
                <span className={styles.logoText}>VectorDB Analyzer</span>
              </div>
              <span className={styles.badge}>15 DBs</span>
            </div>

            <div className={styles.hCenter}>
              <button
                className={`${styles.modeBtn} ${compareMode ? styles.modeBtnOn : ""}`}
                onClick={toggleCompareMode}
              >
                <span>⊞</span>
                <span>{compareMode ? `Compare · ${selectedDBs.size} DBs` : "Compare"}</span>
              </button>
            </div>

            <div className={styles.hRight}>
              <button
                className={`${styles.topBtn} ${safeMode ? styles.topBtnActive : ""}`}
                onClick={toggleSafeMode}
                title={safeMode ? "Safe Mode ON" : "Safe Mode OFF"}
              >
                <span className={styles.topBtnIcon}>{safeMode ? "🛡️" : "⚠️"}</span>
                <span className={styles.topBtnLabel}>{safeMode ? "Safe" : "Unsafe"}</span>
              </button>
              <button className={styles.topBtn} onClick={toggleTheme} title={`Theme: ${theme}`}>
                <span className={styles.topBtnIcon}>{THEME_ICONS[theme] || "☀️"}</span>
                <span className={styles.topBtnLabel}>{theme}</span>
              </button>
              <div className={styles.statusPill}>
                <span className={`${styles.dot} ${backendOk ? styles.dotOn : styles.dotOff}`} />
                <span className={styles.dotLabel}>{backendOk ? "Online" : "Offline"}</span>
              </div>
            </div>
          </div>

          {/* ── Row 2: Feature Toolbar ── */}
          <div className={styles.toolbar} role="toolbar" aria-label="Features">
            {[
              { icon: "🔬", label: "Inspector",  onClick: () => setShowEmbInspector(true) },
              { icon: "⚡", label: "Hybrid",     onClick: () => setShowHybrid(true) },
              { icon: "⬆️", label: "Ingest",     onClick: () => setShowUpsert(true) },
              { icon: "💾", label: "Saved",      onClick: () => setShowBook(true) },
              { icon: "📊", label: "Graph",      onClick: () => setShowGraph(v => !v), active: showGraph },
              { icon: "🐛", label: "Debug",      onClick: () => setShowApiDebug(v => !v), active: showApiDebug },
              { icon: "🧪", label: "Vectors",    onClick: () => setShowPlayground(true) },
              { icon: "🧠", label: "RAG Eval",   onClick: () => setShowRAGEval(true) },
              { icon: "🔄", label: "Rewrite",    onClick: () => setShowRewrite(true) },
              { icon: "🧬", label: "Chunks",     onClick: () => setShowChunking(true) },
              { icon: "📉", label: "Drift",      onClick: () => setShowDrift(true) },
              { icon: "⚖️", label: "A/B Test",  onClick: () => setShowABTest(true) },
              { icon: "📡", label: "Monitor",    onClick: () => setShowMonitor(true) },
              { icon: "🏅", label: "Rerank",     onClick: () => setShowReranker(true) },
              { icon: "💬", label: "Prompt",     onClick: () => setShowPromptPG(true) },
              { icon: "🤖", label: "Optimize",   onClick: () => setShowOptimize(true) },
              { icon: "🌊", label: "Stream",     onClick: () => setShowStreaming(true) },
              { icon: "📦", label: "Batch",      onClick: () => setShowBatchSearch(true) },
              { icon: "🆚", label: "Diff",       onClick: () => setShowQueryDiff(true) },
              { icon: "🔢", label: "Filters",    onClick: () => setShowMetadataFilter(true) },
              { icon: "➖", label: "Negative",   onClick: () => setShowNegativeQuery(true) },
              { icon: "💡", label: "Suggest",    onClick: () => setShowAutoComplete(true) },
              { icon: "🗺️", label: "Map 2D",    onClick: () => setShowVectorMap(true) },
              { icon: "🌡️", label: "Heatmap",   onClick: () => setShowHeatmap(true) },
              { icon: "⏱️", label: "Latency",   onClick: () => setShowLatency(true) },
              { icon: "💰", label: "Cost",       onClick: () => setShowCostEstimator(true) },
              { icon: "🚚", label: "Migrate",    onClick: () => setShowIndexMigration(true) },
              { icon: "🗂️", label: "NS Mgr",    onClick: () => setShowNsManager(true) },
              { icon: "🔁", label: "Dupes",      onClick: () => setShowDuplicates(true) },
              { icon: "📋", label: "ChangeLog",  onClick: () => setShowChangeLog(true) },
              { icon: "⏰", label: "Scheduled",  onClick: () => setShowScheduled(true) },
              { icon: "🔗", label: "Share",      onClick: () => setShowShareLink(true) },
              { icon: "📁", label: "Collections",onClick: () => setShowQueryCols(true) },
              { icon: "🏆", label: "Golden",     onClick: () => setShowGoldenDS(true) },
              { icon: "👍", label: "Feedback",   onClick: () => setShowFeedback(true) },
              { icon: "📈", label: "Metrics",    onClick: () => setShowMetrics(true) },
              { icon: "📊", label: "Dashboard",  onClick: () => setShowDash(true) },
            ].map(({ icon, label, onClick, active }) => (
              <button
                key={label}
                className={`${styles.toolBtn} ${active ? styles.toolBtnOn : ""}`}
                onClick={onClick}
                aria-label={label}
              >
                <span className={styles.toolIcon}>{icon}</span>
                <span className={styles.toolLabel}>{label}</span>
              </button>
            ))}
          </div>

        </header>

        {/* ── Body ────────────────────────────────── */}
        <div className={styles.layout}>

          {/* Mobile backdrop */}
          {sidebarOpen && (
            <div className={styles.sidebarBackdrop} onClick={() => setSidebarOpen(false)} />
          )}

          <Sidebar
            providers={providers}
            selectedDBs={selectedDBs}
            compareMode={compareMode}
            onToggle={toggleDB}
            dbConfigs={dbConfigs}
            saveDbCfg={saveDbCfg}
            embCfg={embCfg}
            saveEmbCfg={saveEmbCfg}
            topK={topK}
            onTopKChange={setTopK}
            onUseCollection={onUseCollection}
            mobileOpen={sidebarOpen}
            onMobileClose={() => setSidebarOpen(false)}
          />

          <main className={styles.main} role="main" aria-label="Search and results">
            <QueryEditor
              onSearch={handleSearch}
              loading={loading}
              currentDB={!compareMode ? currentProvider?.display_name : `${selectedDBs.size} DBs`}
              onSaveQuery={text => { saveQuery(text); toast("Query saved!", "success"); }}
              onPrefetch={prefetchEmbedding}
            />

            {/* Stats + Export bar */}
            {(hasResults || loading) && (
              <div className={styles.topBar}>
                {hasResults && <StatsBar results={allResults} compareMode={compareMode} meta={lastSearchMeta} shown={totalCount} hasMore={hasMore} />}
                {hasResults && totalCount > 0 && (
                  <div className={styles.exportRow}>
                    <span className={styles.exportLabel}>Export:</span>
                    <button className={styles.exportBtn} onClick={() => { exportJSON(allResults, "", {}); toast("Exported JSON", "success"); }}>↓ JSON</button>
                    <button className={styles.exportBtn} onClick={() => { exportCSV(allResults, ""); toast("Exported CSV", "success"); }}>↓ CSV</button>
                    {/* Feature 5: Explain button */}
                    {!compareMode && singleResults.length > 0 && (
                      <button
                        className={styles.explainBtn}
                        onClick={handleExplain}
                        disabled={explaining}
                        title="AI Explanation"
                      >
                        {explaining ? "…" : "✨ Explain"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Feature 5: Explanation box */}
            {explanation && (
              <div className={styles.explanationBox}>
                <button className={styles.explanationClose} onClick={() => setExplanation(null)}>✕</button>
                {explanation}
              </div>
            )}



            {/* Loading skeletons */}
            {loading && (
              <div className={styles.skeletonList}>
                {Array.from({ length: topK }, (_, i) => (
                  <SkeletonCard key={i} delay={i * 60} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {allResults === null && !loading && <EmptyState onSearch={handleSearch} />}

            {/* No results */}
            {allResults !== null && totalCount === 0 && !loading && (
              <NoResultsDiag
                meta={lastSearchMeta}
                embCfg={embCfg}
                dbConfigs={dbConfigs}
                selectedDBs={selectedDBs}
                onSaveDbCfg={saveDbCfg}
                onSaveEmbCfg={saveEmbCfg}
                onSearch={handleSearch}
              />
            )}

            {/* Single DB results */}
            {hasResults && !compareMode && !loading && (
              <>
                <div className={styles.resultList} role="list" aria-label={`${singleResults.length} search results`} aria-live="polite">
                  {singleResults.map((item, i) => (
                    <ResultCard
                      key={`${item.id}-${i}`}
                      rank={i + 1}
                      item={item}
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                      onExplore={setExplorerItem}
                    />
                  ))}
                </div>

                {/* Loading-more skeletons */}
                {loadingMore && (
                  <div className={styles.skeletonList}>
                    {Array.from({ length: Math.min(topK, 3) }, (_, i) => (
                      <SkeletonCard key={`more-${i}`} delay={i * 60} />
                    ))}
                  </div>
                )}

                {/* Infinite scroll sentinel */}
                {hasMore && !loadingMore && (
                  <div ref={sentinelRef} className={styles.sentinel} />
                )}

                {/* End of results indicator */}
                {!hasMore && singleResults.length > 0 && (
                  <div className={styles.endOfResults}>
                    <span className={styles.endLine} />
                    <span className={styles.endText}>
                      {singleResults.length} result{singleResults.length !== 1 ? "s" : ""} · end of results
                    </span>
                    <span className={styles.endLine} />
                  </div>
                )}
              </>
            )}

            {/* Compare mode results */}
            {hasResults && compareMode && !loading && <MultiResultsView results={allResults} />}
          </main>
        </div>

        {/* ── Modals ──────────────────────────────── */}
        {showGraph && !compareMode && <EmbeddingGraph results={singleResults} onClose={() => setShowGraph(false)} />}
        {showApiDebug && (
          <div className={styles.debugOverlay} onClick={e => e.target === e.currentTarget && setShowApiDebug(false)}>
            <div className={styles.debugModal}>
              <div className={styles.debugModalHeader}>
                <span className={styles.debugModalTitle}>🐛 API Debug</span>
                <button className={styles.debugModalClose} onClick={() => setShowApiDebug(false)}>✕</button>
              </div>
              {!apiDebug ? (
                <div className={styles.debugEmpty}>No request yet — run a search to see debug info.</div>
              ) : (
                <div className={styles.debugPanel}>
                  <div className={styles.debugRow}><span className={styles.debugKey}>Timestamp</span><span className={styles.debugVal}>{apiDebug.timestamp}</span></div>
                  <div className={styles.debugRow}><span className={styles.debugKey}>Request</span><span className={styles.debugVal}>{apiDebug.method} {apiDebug.url}</span></div>
                  <div className={styles.debugRow}><span className={styles.debugKey}>Body</span><span className={styles.debugVal}>{JSON.stringify(apiDebug.body)}</span></div>
                  <div className={styles.debugRow}><span className={styles.debugKey}>Status</span><span className={styles.debugVal}>{apiDebug.status}</span></div>
                  <div className={styles.debugRow}><span className={styles.debugKey}>Latency</span><span className={styles.debugVal}>{apiDebug.latency_ms}ms</span></div>
                  <div className={styles.debugRow}><span className={styles.debugKey}>Embedding Dim</span><span className={styles.debugVal}>{apiDebug.embedding_dim}</span></div>
                  <div className={styles.debugRow}><span className={styles.debugKey}>Embed Model</span><span className={styles.debugVal}>{apiDebug.embedding_model || "—"}</span></div>
                  {apiDebug.embedding_fallback && (
                    <div className={styles.debugRow}><span className={styles.debugKey}>⚠ Fallback</span><span className={styles.debugVal} style={{ color: "var(--amber)" }}>local 384D</span></div>
                  )}
                  <div className={styles.debugRow}><span className={styles.debugKey}>Result Count</span><span className={styles.debugVal}>{apiDebug.result_count}</span></div>
                  <div className={styles.debugRow}><span className={styles.debugKey}>Has More</span><span className={styles.debugVal}>{String(apiDebug.has_more)}</span></div>
                </div>
              )}
            </div>
          </div>
        )}
        {showDash && <Dashboard onClose={() => setShowDash(false)} onRerun={rerun} />}
        {showBook && <SQLBook onRun={handleSearch} onClose={() => setShowBook(false)} />}
        {showEmbInspector && <EmbeddingInspector embCfg={embCfg} onClose={() => setShowEmbInspector(false)} />}
        {showHybrid && (
          <HybridSearchPanel
            selectedDBs={selectedDBs}
            dbConfigs={dbConfigs}
            embCfg={embCfg}
            topK={topK}
            onClose={() => setShowHybrid(false)}
          />
        )}
        {showMetrics && <MetricsPanel onClose={() => setShowMetrics(false)} onRerun={(q) => { setShowMetrics(false); rerun(q); }} />}
        {showUpsert && (
          <UpsertPanel
            selectedDBs={selectedDBs}
            dbConfigs={dbConfigs}
            embCfg={embCfg}
            onClose={() => setShowUpsert(false)}
          />
        )}

        {/* Feature 7: Vector Playground */}
        {showPlayground && (
          <VectorPlayground
            providers={providers}
            dbConfigs={dbConfigs}
            onClose={() => setShowPlayground(false)}
          />
        )}

        {/* ── 20 Advanced Feature Panels ─────────── */}
        {showRAGEval && <RAGEvalPanel onClose={() => setShowRAGEval(false)} />}
        {showRewrite && (
          <QueryRewritePanel
            onClose={() => setShowRewrite(false)}
            onApply={q => { setShowRewrite(false); handleSearch(q); }}
          />
        )}
        {showChunking && <ChunkingPanel onClose={() => setShowChunking(false)} />}
        {showDrift && <DriftPanel embCfg={embCfg} onClose={() => setShowDrift(false)} />}
        {showABTest && (
          <ABTestPanel
            providers={providers}
            dbConfigs={dbConfigs}
            embCfg={embCfg}
            onClose={() => setShowABTest(false)}
          />
        )}
        {showMonitor && <ProductionMonitor onClose={() => setShowMonitor(false)} />}
        {showReranker && <RerankerPanel onClose={() => setShowReranker(false)} />}
        {showPromptPG && (
          <PromptPlayground
            providers={providers}
            dbConfigs={dbConfigs}
            embCfg={embCfg}
            onClose={() => setShowPromptPG(false)}
          />
        )}
        {showOptimize && (
          <OptimizePanel
            lastSearchMeta={lastSearchMeta}
            onClose={() => setShowOptimize(false)}
          />
        )}
        {showStreaming && (
          <StreamingSearch
            providers={providers}
            dbConfigs={dbConfigs}
            embCfg={embCfg}
            onClose={() => setShowStreaming(false)}
          />
        )}

        {/* Feature 1: Result Explorer */}
        {explorerItem && (
          <ResultExplorer item={explorerItem} onClose={() => setExplorerItem(null)} />
        )}

        {/* ── 20 New Feature Panels ────────────── */}
        {showBatchSearch && (
          <BatchSearchPanel providers={providers} dbConfigs={dbConfigs} embCfg={embCfg} onClose={() => setShowBatchSearch(false)} />
        )}
        {showQueryDiff && (
          <QueryDiffPanel providers={providers} dbConfigs={dbConfigs} embCfg={embCfg} onClose={() => setShowQueryDiff(false)} />
        )}
        {showMetadataFilter && (
          <MetadataFilterPanel
            onApply={filter => { setShowMetadataFilter(false); toast(`Filter applied: ${JSON.stringify(filter).slice(0,60)}…`, "success"); }}
            onClose={() => setShowMetadataFilter(false)} />
        )}
        {showNegativeQuery && (
          <NegativeQueryPanel providers={providers} dbConfigs={dbConfigs} embCfg={embCfg} onClose={() => setShowNegativeQuery(false)} />
        )}
        {showAutoComplete && (
          <QueryAutocompleteDemo onClose={() => setShowAutoComplete(false)} />
        )}
        {showVectorMap && (
          <VectorMap2D onClose={() => setShowVectorMap(false)} />
        )}
        {showHeatmap && (
          <SimilarityHeatmap results={singleResults} onClose={() => setShowHeatmap(false)} />
        )}
        {showLatency && (
          <LatencyTimeline onClose={() => setShowLatency(false)} />
        )}
        {showCostEstimator && (
          <CostEstimator onClose={() => setShowCostEstimator(false)} />
        )}
        {showIndexMigration && (
          <IndexMigrationPanel providers={providers.map(p => p.name)} dbConfigs={dbConfigs} onClose={() => setShowIndexMigration(false)} />
        )}
        {showNsManager && (
          <NamespaceManagerPanel providers={providers.map(p => p.name)} dbConfigs={dbConfigs} onClose={() => setShowNsManager(false)} />
        )}
        {showDuplicates && (
          <DuplicateDetectorPanel providers={providers.map(p => p.name)} dbConfigs={dbConfigs} embCfg={embCfg} onClose={() => setShowDuplicates(false)} />
        )}
        {showChangeLog && (
          <ChangeLogPanel onClose={() => setShowChangeLog(false)} />
        )}
        {showScheduled && (
          <ScheduledQueriesPanel providers={providers.map(p => p.name)} dbConfigs={dbConfigs} embCfg={embCfg} onClose={() => setShowScheduled(false)} />
        )}
        {showShareLink && (
          <ShareableLinkPanel
            currentQuery={lastQueryRef.current}
            selectedDB={[...selectedDBs][0] || ""}
            dbConfigs={dbConfigs}
            embCfg={embCfg}
            onClose={() => setShowShareLink(false)}
          />
        )}
        {showQueryCols && (
          <QueryCollectionsPanel onRunQuery={q => { setShowQueryCols(false); handleSearch(q); }} onClose={() => setShowQueryCols(false)} />
        )}
        {showGoldenDS && (
          <GoldenDatasetPanel providers={providers.map(p => p.name)} dbConfigs={dbConfigs} embCfg={embCfg} onClose={() => setShowGoldenDS(false)} />
        )}
        {showFeedback && (
          <RelevanceFeedbackPanel results={singleResults} currentQuery={lastQueryRef.current} selectedDB={[...selectedDBs][0] || ""} onClose={() => setShowFeedback(false)} />
        )}

        {/* ── AI Chatbot ───────────────────────── */}
        <AIChatBot
          open={chatOpen}
          onToggle={() => setChatOpen(v => !v)}
          searchContext={{
            query: lastQueryRef.current,
            resultCount: totalCount,
            dbType: [...selectedDBs][0],
            embeddingModel: embCfg.embedding_model,
            embeddingDim: lastSearchMeta?.dim,
            latency: allResults ? Math.round([...allResults.values()].reduce((a, d) => a + d.latency_ms, 0) / (allResults.size || 1)) : null,
            hasResults: hasResults,
            openai_api_key: embCfg.openai_api_key,
          }}
        />

        {/* ── Mobile Bottom Bar ───────────────────── */}
        {/* ── Mobile Bottom Nav ───────────────────── */}
        <nav className={styles.mobileNav} aria-label="Mobile navigation">
          {/* Fixed primary icons */}
          <div className={styles.mobileNavFixed}>
            <button
              className={`${styles.mobileNavBtn} ${sidebarOpen ? styles.mobileNavBtnActive : ""}`}
              onClick={() => setSidebarOpen(v => !v)}
            >
              <span className={styles.mobileNavIcon}>🗄️</span>
              <span className={styles.mobileNavLabel}>DB</span>
            </button>
            <button
              className={`${styles.mobileNavBtn} ${compareMode ? styles.mobileNavBtnActive : ""}`}
              onClick={toggleCompareMode}
            >
              <span className={styles.mobileNavIcon}>{compareMode ? "⊞" : "⊟"}</span>
              <span className={styles.mobileNavLabel}>Compare</span>
            </button>
          </div>

          {/* Scrollable secondary icons */}
          <div className={styles.mobileNavScroll}>
            {[
              { icon: "🔬", label: "Inspect",  onClick: () => setShowEmbInspector(true) },
              { icon: "⚡", label: "Hybrid",   onClick: () => setShowHybrid(true) },
              { icon: "⬆️", label: "Ingest",   onClick: () => setShowUpsert(true) },
              { icon: "💾", label: "Saved",    onClick: () => setShowBook(true) },
              { icon: "🧪", label: "Vectors",  onClick: () => setShowPlayground(true) },
              { icon: "📊", label: "Graph",    onClick: () => setShowGraph(v => !v) },
              { icon: "🧠", label: "RAG",      onClick: () => setShowRAGEval(true) },
              { icon: "📉", label: "Drift",    onClick: () => setShowDrift(true) },
              { icon: "📡", label: "Monitor",  onClick: () => setShowMonitor(true) },
              { icon: "🗺️", label: "Map",      onClick: () => setShowVectorMap(true) },
              { icon: "💰", label: "Cost",     onClick: () => setShowCostEstimator(true) },
              { icon: "🔗", label: "Share",    onClick: () => setShowShareLink(true) },
              { icon: "📈", label: "Metrics",  onClick: () => setShowMetrics(true) },
              { icon: "📊", label: "Dash",     onClick: () => setShowDash(true) },
            ].map(({ icon, label, onClick }) => (
              <button key={label} className={styles.mobileNavScrollBtn} onClick={onClick}>
                <span className={styles.mobileNavIcon}>{icon}</span>
                <span className={styles.mobileNavLabel}>{label}</span>
              </button>
            ))}
          </div>

          {/* More button */}
          <div className={styles.mobileNavFixed}>
            <button className={styles.mobileNavBtn} onClick={() => setShowMobileMore(true)}>
              <span className={styles.mobileNavIcon}>⋯</span>
              <span className={styles.mobileNavLabel}>More</span>
            </button>
          </div>
        </nav>

        {/* ── Mobile More Sheet ────────────────────── */}
        {showMobileMore && (
          <div className={styles.moreBackdrop} onClick={() => setShowMobileMore(false)}>
            <div className={styles.moreSheet} onClick={e => e.stopPropagation()}>
              <div className={styles.moreHandle} />
              <div className={styles.moreTitle}>All Features</div>
              <div className={styles.moreGrid}>
                {[
                  { icon: "🔬", label: "Inspector",  onClick: () => { setShowEmbInspector(true);  setShowMobileMore(false); } },
                  { icon: "⚡", label: "Hybrid",     onClick: () => { setShowHybrid(true);        setShowMobileMore(false); } },
                  { icon: "⬆️", label: "Ingest",     onClick: () => { setShowUpsert(true);        setShowMobileMore(false); } },
                  { icon: "📊", label: "Graph",      onClick: () => { setShowGraph(v => !v);      setShowMobileMore(false); } },
                  { icon: "🐛", label: "Debug",      onClick: () => { setShowApiDebug(v => !v);   setShowMobileMore(false); } },
                  { icon: "🧪", label: "Vectors",    onClick: () => { setShowPlayground(true);    setShowMobileMore(false); } },
                  { icon: "🧠", label: "RAG Eval",   onClick: () => { setShowRAGEval(true);       setShowMobileMore(false); } },
                  { icon: "🔄", label: "Rewrite",    onClick: () => { setShowRewrite(true);       setShowMobileMore(false); } },
                  { icon: "🧬", label: "Chunks",     onClick: () => { setShowChunking(true);      setShowMobileMore(false); } },
                  { icon: "📉", label: "Drift",      onClick: () => { setShowDrift(true);         setShowMobileMore(false); } },
                  { icon: "⚖",  label: "A/B Test",  onClick: () => { setShowABTest(true);        setShowMobileMore(false); } },
                  { icon: "📡", label: "Monitor",    onClick: () => { setShowMonitor(true);       setShowMobileMore(false); } },
                  { icon: "🏅", label: "Rerank",     onClick: () => { setShowReranker(true);      setShowMobileMore(false); } },
                  { icon: "💬", label: "Prompt",     onClick: () => { setShowPromptPG(true);      setShowMobileMore(false); } },
                  { icon: "🤖", label: "Optimize",   onClick: () => { setShowOptimize(true);      setShowMobileMore(false); } },
                  { icon: "🌊", label: "Stream",     onClick: () => { setShowStreaming(true);       setShowMobileMore(false); } },
                  { icon: "📦", label: "Batch",      onClick: () => { setShowBatchSearch(true);    setShowMobileMore(false); } },
                  { icon: "⚖️", label: "Diff",       onClick: () => { setShowQueryDiff(true);      setShowMobileMore(false); } },
                  { icon: "🔢", label: "Filters",    onClick: () => { setShowMetadataFilter(true); setShowMobileMore(false); } },
                  { icon: "➖", label: "Negative",   onClick: () => { setShowNegativeQuery(true);  setShowMobileMore(false); } },
                  { icon: "🗺️", label: "Map 2D",    onClick: () => { setShowVectorMap(true);       setShowMobileMore(false); } },
                  { icon: "🌡️", label: "Heatmap",   onClick: () => { setShowHeatmap(true);         setShowMobileMore(false); } },
                  { icon: "💰", label: "Cost",       onClick: () => { setShowCostEstimator(true);   setShowMobileMore(false); } },
                  { icon: "🏆", label: "Golden DS",  onClick: () => { setShowGoldenDS(true);        setShowMobileMore(false); } },
                  { icon: "👍", label: "Feedback",   onClick: () => { setShowFeedback(true);        setShowMobileMore(false); } },
                  { icon: "💬", label: "AI Chat",    onClick: () => { setChatOpen(true);            setShowMobileMore(false); } },
                  { icon: "📈", label: "Metrics",    onClick: () => { setShowMetrics(true);         setShowMobileMore(false); } },
                  { icon: "📊", label: "Dashboard",  onClick: () => { setShowDash(true);            setShowMobileMore(false); } },
                  { icon: safeMode ? "🛡️" : "⚠️", label: safeMode ? "Safe ON" : "Safe OFF", onClick: () => { toggleSafeMode(); } },
                  { icon: THEME_ICONS[theme] || "☀️", label: "Theme",  onClick: () => { toggleTheme(); } },
                ].map(({ icon, label, onClick }) => (
                  <button key={label} className={styles.moreItem} onClick={onClick}>
                    <span className={styles.moreItemIcon}>{icon}</span>
                    <span className={styles.moreItemLabel}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
