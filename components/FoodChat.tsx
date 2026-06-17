"use client";

import { useEffect, useRef } from "react";
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

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const showQuickReplies = !isLoading && messages.length <= 1;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="mt-6 text-center text-sm text-gray-400">
            Ask me anything about your meal — ingredients, swaps, how it fits your day…
          </p>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-800"
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
        <div ref={bottomRef} />
      </div>

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
