import { useState, useRef, useEffect } from "react";
import styles from "./AIChatBot.module.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

const SUGGESTIONS = [
  "Explain these search results",
  "Why is the top result ranked #1?",
  "Suggest better search queries",
  "How can I improve my embedding config?",
  "What does this vector score mean?",
  "How do I reduce search latency?",
];

export default function AIChatBot({ open, onToggle, searchContext = {} }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm your VectorDB AI assistant. I can help you understand search results, optimize queries, and debug your vector database setup. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send(text) {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          context: searchContext,
          openai_api_key: searchContext.openai_api_key || "",
        }),
      });
      const data = await res.json();
      const reply = data.message || data.content || "Sorry, I couldn't generate a response.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm having trouble connecting to the backend. Make sure the server is running.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    setMessages([{
      role: "assistant",
      content: "Chat cleared. How can I help you?",
    }]);
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        className={`${styles.fab} ${open ? styles.fabOpen : ""}`}
        onClick={onToggle}
        aria-label="Toggle AI Chat"
        title="AI Assistant"
      >
        {open ? "✕" : "💬"}
      </button>

      {/* Chat panel */}
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <span className={styles.avatar}>🤖</span>
              <div>
                <div className={styles.name}>AI Assistant</div>
                <div className={styles.status}>
                  <span className={styles.statusDot} />
                  {searchContext.hasResults ? "Context: search loaded" : "Ready"}
                </div>
              </div>
            </div>
            <button className={styles.clearBtn} onClick={clearChat} title="Clear chat">🗑</button>
          </div>

          <div className={styles.messages}>
            {messages.map((msg, i) => (
              <div key={i} className={`${styles.msg} ${msg.role === "user" ? styles.msgUser : styles.msgBot}`}>
                {msg.role === "assistant" && <span className={styles.msgAvatar}>🤖</span>}
                <div className={styles.msgBubble}>{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className={`${styles.msg} ${styles.msgBot}`}>
                <span className={styles.msgAvatar}>🤖</span>
                <div className={styles.msgBubble}>
                  <span className={styles.typing}><span /><span /><span /></span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestion chips */}
          {messages.length <= 1 && (
            <div className={styles.chips}>
              {SUGGESTIONS.slice(0, 4).map(s => (
                <button key={s} className={styles.chip} onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          )}

          <div className={styles.inputRow}>
            <textarea
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything about your vector search…"
              rows={1}
            />
            <button
              className={styles.sendBtn}
              onClick={() => send()}
              disabled={!input.trim() || loading}
              aria-label="Send"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
