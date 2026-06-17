import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { nutritionSchema } from "@/lib/nutritionSchema";
import { supabaseAdmin } from "@/lib/supabase";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Runs the vision model over an uploaded photo to produce a structured
 * Nutrition Facts estimate, persists it on the chat row, and returns it.
 */
export async function POST(req: NextRequest) {
  try {
    const { chatId, imageUrl } = (await req.json()) as {
      chatId?: string;
      imageUrl?: string;
    };

    if (!chatId || !imageUrl) {
      return NextResponse.json({ error: "chatId and imageUrl are required" }, { status: 400 });
    }

    const { object: nutrition } = await generateObject({
      model: openai(config.model),
      schema: nutritionSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "You are a registered-dietitian-grade food estimator. Identify the food in this photo and " +
                "estimate the Nutrition Facts for ONE typical serving as plated. Estimate every field even when " +
                "uncertain (use your best judgment from visual portion size and typical recipes). Amounts only — " +
                "do not include percentages.",
            },
            { type: "image", image: new URL(imageUrl) },
          ],
        },
      ],
    });

    const { error: updateError } = await supabaseAdmin
      .from("chats")
      .update({ nutrition, food_name: nutrition.foodName })
      .eq("id", chatId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(nutrition);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
