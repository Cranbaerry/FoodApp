"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat, type Message } from "@ai-sdk/react";

const QUICK_REPLIES = [
  "Is this a healthy choice?",
  "How can I make it healthier?",
  "What should I pair with it?",
  "Estimate the portion size",
];

/**
 * Streaming chat about the analysed food. Uses the Vercel AI SDK `useChat`
 * hook against /api/chat; the server injects the food + nutrition context.
 *
 * The message list scrolls *within itself* (never the page), auto-sticks to
 * the bottom while you're already there, and shows a "jump to latest" button
 * when you've scrolled up.
 */
export function FoodChat({
  chatId,
  initialMessages,
}: {
  chatId: string;
  initialMessages: Message[];
}) {
  const { messages, input, handleInputChange, handleSubmit, append, isLoading, error } = useChat({
    api: "/api/chat",
    id: chatId,
    initialMessages,
    body: { chatId },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Track whether the user is near the bottom of the message list.
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance < 80);
  }, []);

  // Auto-stick to the bottom only when the user is already there.
  useEffect(() => {
    if (atBottom) scrollToBottom(messages.length <= 1 ? "auto" : "smooth");
  }, [messages, atBottom, scrollToBottom]);

  const showQuickReplies = !isLoading && messages.length <= 1;

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 space-y-3 overflow-y-auto p-4"
      >
        {messages.length === 0 && (
          <p className="mt-6 text-center text-sm text-gray-400">
            Ask me anything about your meal — ingredients, swaps, how it fits your day…
          </p>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === "user" ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-gray-100 px-4 py-2 text-sm text-gray-400">…</div>
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-red-500">Something went wrong. Try again.</p>
        )}
      </div>

      {/* Jump-to-latest appears only when scrolled up. */}
      {!atBottom && (
        <button
          type="button"
          onClick={() => {
            setAtBottom(true);
            scrollToBottom();
          }}
          aria-label="Scroll to latest message"
          className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-brand-700"
        >
          ↓ Latest
        </button>
      )}

      {showQuickReplies && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => append({ role: "user", content: q })}
              className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-100 p-3">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Say something about your food…"
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
