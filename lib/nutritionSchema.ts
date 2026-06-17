import { z } from "zod";

/**
 * Structured nutrition estimate for a single serving of the photographed food.
 *
 * The model only returns raw amounts. Percent Daily Values are computed
 * deterministically from FDA reference Daily Values (see `dailyValues` below)
 * so the label math is consistent rather than hallucinated.
 */
export const nutritionSchema = z.object({
  foodName: z.string().describe("Short, specific name of the dish, e.g. 'Chicken Caesar Salad'."),
  description: z
    .string()
    .describe("One or two friendly sentences describing what is visible in the photo."),
  servingSize: z
    .string()
    .describe("Human-readable serving size as shown, e.g. '1 bowl (about 350g)'."),
  servingsPerContainer: z
    .number()
    .nullable()
    .describe("Estimated servings shown in the photo, or null if it is clearly a single serving."),
  ingredients: z
    .array(z.string())
    .describe("Likely main ingredients visible or implied in the dish."),
  estimateConfidence: z
    .enum(["low", "medium", "high"])
    .describe("How confident the estimate is, based on how clearly the food is identifiable."),

  // Amounts for one serving. Use 0 when a nutrient is genuinely absent.
  calories: z.number().describe("Calories per serving (kcal)."),
  totalFat_g: z.number(),
  saturatedFat_g: z.number(),
  transFat_g: z.number(),
  cholesterol_mg: z.number(),
  sodium_mg: z.number(),
  totalCarbohydrate_g: z.number(),
  dietaryFiber_g: z.number(),
  totalSugars_g: z.number(),
  addedSugars_g: z.number(),
  protein_g: z.number(),
  vitaminD_mcg: z.number(),
  calcium_mg: z.number(),
  iron_mg: z.number(),
  potassium_mg: z.number(),
});

export type Nutrition = z.infer<typeof nutritionSchema>;

/**
 * FDA reference Daily Values (2,000 calorie diet) used to compute %DV.
 * Source: FDA Nutrition Facts Label reference values.
 */
export const dailyValues = {
  totalFat_g: 78,
  saturatedFat_g: 20,
  cholesterol_mg: 300,
  sodium_mg: 2300,
  totalCarbohydrate_g: 275,
  dietaryFiber_g: 28,
  addedSugars_g: 50,
  protein_g: 50,
  vitaminD_mcg: 20,
  calcium_mg: 1300,
  iron_mg: 18,
  potassium_mg: 4700,
} as const;

/** Compute a rounded percent Daily Value, or null when there is no DV. */
export function percentDV(amount: number, dv: number | undefined): number | null {
  if (!dv || dv <= 0) return null;
  return Math.round((amount / dv) * 100);
}
