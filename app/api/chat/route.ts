import { openai } from "@ai-sdk/openai";
import { streamText, type CoreMessage } from "ai";
import { supabaseAdmin, type ChatRow } from "@/lib/supabase";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Streams the assistant's reply for a food conversation.
 *
 * The request carries the running `messages` plus the `chatId`. The server
 * loads the food context (name + nutrition + image) for that chat, builds a
 * grounded system prompt, prepends the photo so the model keeps "seeing" the
 * food, and persists both the latest user turn and the assistant reply.
 */
export async function POST(req: Request) {
  const { messages, chatId } = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
    chatId?: string;
  };

  if (!chatId) {
    return new Response(JSON.stringify({ error: "chatId is required" }), { status: 400 });
  }

  const { data: chat, error } = await supabaseAdmin
    .from("chats")
    .select("*")
    .eq("id", chatId)
    .single<ChatRow>();

  if (error || !chat) {
    return new Response(JSON.stringify({ error: "Chat not found" }), { status: 404 });
  }

  // Persist the newest user message before we stream the reply.
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    await supabaseAdmin
      .from("messages")
      .insert({ chat_id: chatId, role: "user", content: lastMessage.content });
  }

  const system = `${config.systemPrompt}

--- FOOD CONTEXT ---
Dish: ${chat.food_name ?? "the food in the photo"}
Nutrition estimate (per serving, JSON):
${JSON.stringify(chat.nutrition, null, 2)}
--- END CONTEXT ---`;

  // Prepend the photo so vision context persists across the whole conversation.
  const modelMessages: CoreMessage[] = [
    {
      role: "user",
      content: [
        { type: "text", text: "Here is the photo of the food I'm eating." },
        { type: "image", image: new URL(chat.image_url) },
      ],
    },
    ...messages.map((m) => ({ role: m.role, content: m.content }) as CoreMessage),
  ];

  const result = streamText({
    model: openai(config.model),
    system,
    messages: modelMessages,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    onFinish: async ({ text }) => {
      await supabaseAdmin
        .from("messages")
        .insert({ chat_id: chatId, role: "assistant", content: text });
    },
  });

  return result.toDataStreamResponse();
}
