import { useState } from "react";
import styles from "./ConfigPanel.module.css";

function FieldInput({ field, value, onChange }) {
  const isSecret = field.type === "password";
  const [visible, setVisible] = useState(false);

  const inputType = isSecret
    ? (visible ? "text" : "password")
    : field.type === "number" ? "number" : "text";

  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {field.label}
        {field.required && <span className={styles.req}>*</span>}
      </label>
      <div className={`${styles.inputWrap} ${isSecret ? styles.secretWrap : ""}`}>
        <input
          className={styles.input}
          type={inputType}
          value={value ?? field.default ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder ?? field.default ?? ""}
          autoComplete="off"
          spellCheck={false}
        />
        {isSecret && (
          <button
            type="button"
            className={styles.eyeBtn}
            onClick={() => setVisible(v => !v)}
            title={visible ? "Hide" : "Show"}
            aria-label={visible ? "Hide API key" : "Show API key"}
          >
            {visible ? "🙈" : "👁"}
          </button>
        )}
      </div>
      {isSecret && value && (
        <div className={styles.keyPreview}>
          {visible
            ? value
            : `${value.slice(0, 6)}${"•".repeat(Math.min(value.length - 6, 20))}${value.slice(-3)}`
          }
        </div>
      )}
    </div>
  );
}

export default function ConfigPanel({ title, fields, values, onChange }) {
  const [collapsed, setCollapsed] = useState(false);
  if (!fields || fields.length === 0) return null;

  return (
    <div className={styles.panel}>
      <button className={styles.toggle} onClick={() => setCollapsed((c) => !c)}>
        <span>{title}</span>
        <span className={styles.chevron}>{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && (
        <div className={styles.fields}>
          {fields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
