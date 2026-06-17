import { dailyValues, percentDV, type Nutrition } from "@/lib/nutritionSchema";

/** A single indented sub-nutrient row with optional %DV. */
function SubRow({
  label,
  amount,
  unit,
  dvKey,
  bold,
}: {
  label: string;
  amount: number;
  unit: string;
  dvKey?: keyof typeof dailyValues;
  bold?: boolean;
}) {
  const dv = dvKey ? percentDV(amount, dailyValues[dvKey]) : null;
  return (
    <div className="flex justify-between border-t border-gray-300 py-0.5 text-sm">
      <span className={bold ? "font-bold" : ""}>
        <span className={bold ? "" : "pl-4 inline-block"}>{label}</span>{" "}
        {amount}
        {unit}
      </span>
      {dv !== null && <span className="font-bold">{dv}%</span>}
    </div>
  );
}

/**
 * A faithful-ish rendering of the FDA Nutrition Facts label.
 * Percent Daily Values are computed from FDA reference values, not the model.
 */
export function NutritionLabel({ nutrition }: { nutrition: Nutrition }) {
  return (
    <div className="mx-auto w-full max-w-sm border-2 border-black bg-white p-3 font-sans text-black">
      <h2 className="text-3xl font-extrabold leading-none tracking-tight">Nutrition Facts</h2>
      <div className="border-b border-gray-400 pb-1 text-sm">
        {nutrition.servingsPerContainer ? (
          <div>{nutrition.servingsPerContainer} servings per container</div>
        ) : null}
        <div className="flex justify-between font-bold">
          <span>Serving size</span>
          <span>{nutrition.servingSize}</span>
        </div>
      </div>

      <div className="flex items-end justify-between border-b-8 border-black py-1">
        <div>
          <div className="text-xs font-bold">Amount per serving</div>
          <div className="text-3xl font-extrabold">Calories</div>
        </div>
        <div className="text-4xl font-extrabold">{Math.round(nutrition.calories)}</div>
      </div>

      <div className="py-0.5 text-right text-xs font-bold">% Daily Value*</div>

      <SubRow label="Total Fat" amount={nutrition.totalFat_g} unit="g" dvKey="totalFat_g" bold />
      <SubRow label="Saturated Fat" amount={nutrition.saturatedFat_g} unit="g" dvKey="saturatedFat_g" />
      <div className="flex justify-between border-t border-gray-300 py-0.5 text-sm">
        <span>
          <span className="pl-4 inline-block italic">Trans</span> Fat {nutrition.transFat_g}g
        </span>
      </div>
      <SubRow label="Cholesterol" amount={nutrition.cholesterol_mg} unit="mg" dvKey="cholesterol_mg" bold />
      <SubRow label="Sodium" amount={nutrition.sodium_mg} unit="mg" dvKey="sodium_mg" bold />
      <SubRow
        label="Total Carbohydrate"
        amount={nutrition.totalCarbohydrate_g}
        unit="g"
        dvKey="totalCarbohydrate_g"
        bold
      />
      <SubRow label="Dietary Fiber" amount={nutrition.dietaryFiber_g} unit="g" dvKey="dietaryFiber_g" />
      <div className="flex justify-between border-t border-gray-300 py-0.5 text-sm">
        <span>
          <span className="pl-4 inline-block">Total Sugars</span> {nutrition.totalSugars_g}g
        </span>
      </div>
      <div className="flex justify-between border-t border-gray-300 py-0.5 text-sm">
        <span className="pl-8">
          Includes {nutrition.addedSugars_g}g Added Sugars
        </span>
        <span className="font-bold">
          {percentDV(nutrition.addedSugars_g, dailyValues.addedSugars_g)}%
        </span>
      </div>
      <SubRow label="Protein" amount={nutrition.protein_g} unit="g" dvKey="protein_g" bold />

      <div className="border-t-8 border-black" />
      <SubRow label="Vitamin D" amount={nutrition.vitaminD_mcg} unit="mcg" dvKey="vitaminD_mcg" />
      <SubRow label="Calcium" amount={nutrition.calcium_mg} unit="mg" dvKey="calcium_mg" />
      <SubRow label="Iron" amount={nutrition.iron_mg} unit="mg" dvKey="iron_mg" />
      <SubRow label="Potassium" amount={nutrition.potassium_mg} unit="mg" dvKey="potassium_mg" />

      <p className="mt-2 border-t-4 border-black pt-1 text-[10px] leading-snug text-gray-700">
        * The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a
        daily diet. 2,000 calories a day is used for general nutrition advice.
      </p>
      <p className="mt-1 text-[10px] italic leading-snug text-gray-500">
        Estimated from a photo ({nutrition.estimateConfidence} confidence). Not a substitute for lab
        analysis or a product label.
      </p>
    </div>
  );
}
