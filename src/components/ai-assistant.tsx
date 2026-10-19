"use client";

import { Bot, LoaderCircle, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Message = { role: "user" | "model"; text: string };

const welcomeMessage: Message = {
  role: "model",
  text: "Hello. I can help explain university processes and guide you around your workspace.",
};

export function AiAssistant({ requireAuth = false }: { requireAuth?: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || loading || text.length > 4000) return;
    if (requireAuth) {
      toast.info("Please sign in to use the AI assistant.");
      return;
    }

    const nextMessages = [...messages, { role: "user" as const, text }];
    setMessages(nextMessages);
    setDraft("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!response.ok) {
        const errorBody: unknown = await response.json().catch(() => undefined);
        const errorMessage = errorBody && typeof errorBody === "object" && typeof (errorBody as { message?: unknown }).message === "string"
          ? (errorBody as { message: string }).message
          : "The AI assistant is unavailable. Please try again";
        throw new Error(errorMessage);
      }
      const result: unknown = await response.json();
      const reply = result && typeof result === "object" && typeof (result as { text?: unknown }).text === "string"
        ? (result as { text: string }).text
        : "The assistant returned an empty response.";
      setMessages((current) => [...current, { role: "model", text: reply }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The AI assistant is unavailable. Please try again");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="ai-assistant">
      {open && <section className="ai-panel" aria-label="AI assistant">
        <header className="ai-panel-header">
          <div className="ai-panel-title"><span className="ai-avatar"><Sparkles size={17} /></span><div><strong>Campus assistant</strong><small>University workspace</small></div></div>
          <button className="icon-button" type="button" aria-label="Close AI assistant" onClick={() => setOpen(false)}><X size={19} /></button>
        </header>
        <div className="ai-messages" aria-live="polite">
          {messages.map((message, index) => <div className={`ai-message ai-message-${message.role}`} key={`${message.role}-${index}`}><span className="ai-message-icon">{message.role === "model" ? <Bot size={15} /> : "You"}</span><p>{message.text}</p></div>)}
          {loading && <div className="ai-message ai-message-model"><span className="ai-message-icon"><Bot size={15} /></span><p className="ai-thinking"><LoaderCircle className="spinner" size={15} /> Thinking</p></div>}
          <div ref={messagesEndRef} />
        </div>
        <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
          <textarea ref={textareaRef} value={draft} maxLength={4000} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder="Ask about your university workspace..." rows={2} aria-label="Message for AI assistant" />
          <button className="ai-send" type="submit" disabled={!draft.trim() || loading} aria-label="Send message" title="Send message"><Send size={17} /></button>
        </form>
      </section>}
      <button className={`ai-launcher${open ? " is-open" : ""}`} type="button" aria-label={open ? "Close AI assistant" : "Open AI assistant"} aria-expanded={open} onClick={() => setOpen((value) => !value)}><Sparkles size={21} /><span>Ask AI</span></button>
    </div>
  );
}