import { useState } from "react";
import styles from "./MetadataFilterPanel.module.css";

const OPERATORS = ["=", "!=", ">", "<", ">=", "<=", "contains", "in"];

let nextId = 1;
function makeRow() {
  return { id: nextId++, field: "", operator: "=", value: "" };
}

export default function MetadataFilterPanel({ onApply, onClose }) {
  const [rows, setRows] = useState([makeRow()]);
  const [combine, setCombine] = useState("AND");

  function addRow() {
    setRows(prev => [...prev, makeRow()]);
  }

  function deleteRow(id) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function updateRow(id, key, val) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r));
  }

  function clearAll() {
    setRows([makeRow()]);
    setCombine("AND");
  }

  function buildFilter() {
    const conditions = rows
      .filter(r => r.field.trim())
      .map(r => {
        let val = r.value;
        if (r.operator === "in") {
          try { val = JSON.parse(r.value); } catch { val = r.value.split(",").map(s => s.trim()); }
        } else if (!isNaN(Number(r.value)) && r.value.trim() !== "") {
          val = Number(r.value);
        }
        return { field: r.field, operator: r.operator, value: val };
      });
    return { combine, conditions };
  }

  const filter = buildFilter();
  const hasValidRows = filter.conditions.length > 0;

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>Metadata Filter Builder</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.combineRow}>
            <span className={styles.label}>Combine mode</span>
            <div className={styles.toggleGroup}>
              {["AND", "OR"].map(m => (
                <button
                  key={m}
                  className={`${styles.toggleBtn} ${combine === m ? styles.toggleActive : ""}`}
                  onClick={() => setCombine(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterRows}>
            {rows.map((row, i) => (
              <div key={row.id} className={styles.filterRow}>
                {i > 0 && (
                  <div className={styles.combineLabel}>{combine}</div>
                )}
                <div className={styles.filterInputs}>
                  <input
                    className={styles.fieldInput}
                    placeholder="field name"
                    value={row.field}
                    onChange={e => updateRow(row.id, "field", e.target.value)}
                  />
                  <select
                    className={styles.opSelect}
                    value={row.operator}
                    onChange={e => updateRow(row.id, "operator", e.target.value)}
                  >
                    {OPERATORS.map(op => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  <input
                    className={styles.valueInput}
                    placeholder={row.operator === "in" ? '["a","b"] or a,b' : "value"}
                    value={row.value}
                    onChange={e => updateRow(row.id, "value", e.target.value)}
                  />
                  <button
                    className={styles.deleteBtn}
                    onClick={() => deleteRow(row.id)}
                    title="Remove filter"
                    disabled={rows.length === 1}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button className={styles.addBtn} onClick={addRow}>
            + Add Filter
          </button>

          <div className={styles.previewSection}>
            <div className={styles.previewLabel}>Filter Preview (JSON)</div>
            <pre className={styles.previewCode}>
              {JSON.stringify(filter, null, 2)}
            </pre>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.clearBtn} onClick={clearAll}>Clear All</button>
          <div className={styles.footerRight}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button
              className={styles.applyBtn}
              onClick={() => { onApply(filter); onClose(); }}
              disabled={!hasValidRows}
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
