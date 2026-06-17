import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin, FOOD_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Accepts a multipart form with a single `file` (the food photo).
 * Uploads it to Supabase Storage, creates a `chats` row, and returns the
 * new chat id + public image URL.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const path = `${randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(FOOD_BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(FOOD_BUCKET).getPublicUrl(path);

    const { data: chat, error: insertError } = await supabaseAdmin
      .from("chats")
      .insert({ image_url: publicUrl })
      .select("id")
      .single();

    if (insertError || !chat) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to create chat" },
        { status: 500 },
      );
    }

    return NextResponse.json({ chatId: chat.id, imageUrl: publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
