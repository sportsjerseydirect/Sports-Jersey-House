"use client";

import { useState } from "react";
import { featureFlags } from "@/lib/env";

type Message = { role: "user" | "assistant"; text: string };

export function ShoppingAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hi — I'm SJH AI. I can help you find jerseys by team, league, player, or budget. How can I help?"
    }
  ]);
  const [loading, setLoading] = useState(false);

  if (!featureFlags.enableAiShoppingAssistant) {
    return null;
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);
    try {
      const response = await fetch("/api/shopping-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      const payload = (await response.json()) as { reply?: string; error?: string };
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: payload.reply ?? payload.error ?? "Sorry, I could not process that request."
        }
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Sorry, SJH AI is temporarily unavailable." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sjh-ai-widget">
      {open ? (
        <div aria-label="SJH AI shopping assistant" className="sjh-ai-panel" role="dialog">
          <header className="sjh-ai-header">
            <strong>SJH AI</strong>
            <span className="sjh-ai-badge">AI-powered</span>
            <button aria-label="Close assistant" className="text-button" onClick={() => setOpen(false)} type="button">
              Close
            </button>
          </header>
          <div className="sjh-ai-messages">
            {messages.map((message, index) => (
              <p className={`sjh-ai-message is-${message.role}`} key={`${message.role}-${index}`}>
                {message.text}
              </p>
            ))}
          </div>
          <form
            className="sjh-ai-input"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input
              aria-label="Ask SJH AI"
              onChange={(event) => setInput(event.target.value)}
              placeholder="Find me a Lakers jersey under £40"
              type="text"
              value={input}
            />
            <button className="button primary" disabled={loading} type="submit">
              {loading ? "…" : "Ask"}
            </button>
          </form>
        </div>
      ) : null}
      <button
        aria-expanded={open}
        className="sjh-ai-launcher button primary"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        SJH AI
      </button>
    </div>
  );
}
