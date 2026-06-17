"use client";

import { useEffect, useState } from "react";
import type { Message } from "@ai-sdk/react";
import { ImageUploader } from "@/components/ImageUploader";
import { NutritionLabel } from "@/components/NutritionLabel";
import { FoodChat } from "@/components/FoodChat";
import type { Nutrition } from "@/lib/nutritionSchema";

type Status = "idle" | "uploading" | "analyzing" | "ready";

const STORAGE_KEY = "foodapp-chat-id";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [chatId, setChatId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState<Nutrition | null>(null);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Restore a previous session on refresh.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    (async () => {
      try {
        const res = await fetch(`/api/chats/${saved}`);
        if (!res.ok) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        const data = await res.json();
        if (!data.nutrition) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        setChatId(data.chatId);
        setImageUrl(data.imageUrl);
        setNutrition(data.nutrition);
        setInitialMessages(data.messages ?? []);
        setStatus("ready");
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    })();
  }, []);

  async function handleFile(file: File) {
    setError(null);
    setStatus("uploading");
    setImageUrl(URL.createObjectURL(file));
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      if (!uploadRes.ok) throw new Error((await uploadRes.json()).error ?? "Upload failed");
      const { chatId: newChatId, imageUrl: url } = await uploadRes.json();

      localStorage.setItem(STORAGE_KEY, newChatId);
      setChatId(newChatId);
      setImageUrl(url);
      setStatus("analyzing");

      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: newChatId, imageUrl: url }),
      });
      if (!analyzeRes.ok) throw new Error((await analyzeRes.json()).error ?? "Analysis failed");
      const nutritionData: Nutrition = await analyzeRes.json();

      setNutrition(nutritionData);
      setInitialMessages([]);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("idle");
    }
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setStatus("idle");
    setChatId(null);
    setImageUrl(null);
    setNutrition(null);
    setInitialMessages([]);
    setError(null);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-brand-700">
          🍴 NomNom
        </h1>
        <p className="mt-1 text-gray-500">
          Snap your meal, get a nutrition label, and chat about it.
        </p>
      </header>

      {error && (
        <div className="mx-auto mb-4 max-w-xl rounded-lg bg-red-50 px-4 py-2 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      {status === "idle" && (
        <div className="mx-auto max-w-xl">
          <ImageUploader onFile={handleFile} />
        </div>
      )}

      {(status === "uploading" || status === "analyzing") && (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Your food"
              className="max-h-72 rounded-2xl object-cover shadow"
            />
          )}
          <div className="flex items-center gap-3 text-brand-700">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
            <span className="font-medium">
              {status === "uploading" ? "Uploading your photo…" : "Reading the nutrition facts…"}
            </span>
          </div>
        </div>
      )}

      {status === "ready" && nutrition && chatId && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={nutrition.foodName}
                className="max-h-64 w-full rounded-2xl object-cover shadow"
              />
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-800">{nutrition.foodName}</h2>
              <p className="text-sm text-gray-500">{nutrition.description}</p>
            </div>
            <NutritionLabel nutrition={nutrition} />
            <button
              onClick={reset}
              className="w-full rounded-full border border-brand-300 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              Analyze another meal
            </button>
          </div>

          <div className="h-[70vh] md:h-auto">
            <FoodChat chatId={chatId} initialMessages={initialMessages} />
          </div>
        </div>
      )}
    </main>
  );
}
