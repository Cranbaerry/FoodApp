import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, type ChatRow, type MessageRow } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Returns a chat's food context + full message history so the UI can restore
 * a previous session on page refresh (keyed by chatId in localStorage).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { data: chat, error } = await supabaseAdmin
    .from("chats")
    .select("*")
    .eq("id", id)
    .single<ChatRow>();

  if (error || !chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const { data: messages } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("chat_id", id)
    .order("created_at", { ascending: true })
    .returns<MessageRow[]>();

  return NextResponse.json({
    chatId: chat.id,
    imageUrl: chat.image_url,
    foodName: chat.food_name,
    nutrition: chat.nutrition,
    messages: (messages ?? []).map((m) => ({ id: m.id, role: m.role, content: m.content })),
  });
}
