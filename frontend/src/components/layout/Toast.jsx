import { useState, useCallback, useRef } from "react";
import styles from "./Toast.module.css";

let _addToast = null;

export function toast(msg, type = "info") {
  _addToast?.(msg, type);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  _addToast = useCallback((msg, type) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    timers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  function dismiss(id) {
    clearTimeout(timers.current[id]);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <>
      {children}
      <div className={styles.container}>
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
            <span className={styles.icon}>
              {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
            </span>
            <span className={styles.msg}>{t.msg}</span>
            <button className={styles.close} onClick={() => dismiss(t.id)}>✕</button>
          </div>
        ))}
      </div>
    </>
  );
}
