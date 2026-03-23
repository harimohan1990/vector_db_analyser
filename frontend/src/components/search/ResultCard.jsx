import { useState, memo } from "react";
import styles from "./ResultCard.module.css";
import { toast } from "../layout/Toast";
import { copyToClipboard } from "../../utils/clipboard";

const DB_ICONS = {
  pinecone:"🌲",chroma:"🎨",deeplake:"🌊",vespa:"🚀",milvus:"⚡",
  scann:"🔎",weaviate:"🕸️",qdrant:"🎯",vald:"🔷",faiss:"📦",
  opensearch:"🔍",pgvector:"🐘",cassandra:"💫",elasticsearch:"🔶",clickhouse:"🖱️",
};

const SCORE_COLOR = (s) => s >= 0.85 ? "#22d3a0" : s >= 0.6 ? "#f59e0b" : "#f43f5e";
const SCORE_LABEL = (s) => s >= 0.85 ? "High" : s >= 0.6 ? "Mid" : "Low";

function ScoreBar({ score }) {
  const pct = Math.max(0, Math.min(1, score)) * 100;
  const color = SCORE_COLOR(score);
  return (
    <div className={styles.barWrap} title={`Score: ${(score * 100).toFixed(2)}%`}>
      <div
        className={styles.bar}
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}55` }}
      />
    </div>
  );
}

const ResultCard = memo(function ResultCard({ rank, item, dbBadge, style, onExplore }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { id, score, metadata = {} } = item;
  const { text, ...rest } = metadata;
  const scoreColor = SCORE_COLOR(score);
  const isLong = text && text.length > 200;

  async function copyId() {
    const ok = await copyToClipboard(id);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
  }

  async function copyMeta(v) {
    const ok = await copyToClipboard(String(v));
    toast(ok ? "Copied" : "Copy failed", ok ? "success" : "error");
  }

  const metaEntries = Object.entries(rest);

  return (
    <div className={styles.card} style={style} data-has-explore={!!onExplore}>
      {/* Rank accent bar */}
      <div className={styles.accentBar} style={{ background: scoreColor }} />

      <div className={styles.header}>
        <span className={styles.rank}>#{rank}</span>

        {dbBadge && (
          <span className={styles.dbBadge}>{DB_ICONS[dbBadge] || "🗄"} {dbBadge}</span>
        )}

        <button className={styles.idBtn} onClick={copyId} title="Copy ID">
          <span className={styles.id}>{id}</span>
          <span className={styles.copyIcon}>{copied ? "✓" : "⎘"}</span>
        </button>

        <div className={styles.scoreArea}>
          <ScoreBar score={score} />
          <div className={styles.scoreBlock}>
            <span className={styles.scoreVal} style={{ color: scoreColor }}>
              {(score * 100).toFixed(1)}%
            </span>
            <span className={styles.scoreLabel} style={{ color: scoreColor }}>
              {SCORE_LABEL(score)}
            </span>
          </div>
        </div>
      </div>

      {text && (
        <div className={styles.textWrap}>
          <p className={styles.text}>
            {isLong && !expanded ? text.slice(0, 200) + "…" : text}
          </p>
          {isLong && (
            <button className={styles.expandBtn} onClick={() => setExpanded(v => !v)}>
              {expanded ? "▲ Show less" : "▼ Show more"}
            </button>
          )}
        </div>
      )}

      {metaEntries.length > 0 && (
        <div className={styles.meta}>
          {metaEntries.map(([k, v]) => (
            <button
              key={k}
              className={styles.tag}
              onClick={() => copyMeta(v)}
              title={`${k}: ${v}  —  Click to copy`}
            >
              <span className={styles.tagKey}>{k}</span>
              <span className={styles.tagSep}>:</span>
              <span className={styles.tagVal}>{String(v).slice(0, 60)}</span>
            </button>
          ))}
        </div>
      )}

      {onExplore && (
        <button
          className={styles.exploreBtn}
          onClick={() => onExplore(item)}
          title="Explore this result"
        >
          🔍 Explore
        </button>
      )}
    </div>
  );
});

export default ResultCard;
