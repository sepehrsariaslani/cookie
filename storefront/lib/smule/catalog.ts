import { smuleAsset } from "./assets";
import { formatPersianNumber, toDisplayTomans, type SmuleProduct } from "./products";

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function mapCatalogProducts(rows: Array<Record<string, unknown>>, currency: string | null): SmuleProduct[] {
  return rows.map((row, index) => {
    const nutrition = row.nutrition && typeof row.nutrition === "object"
      ? row.nutrition as Record<string, unknown>
      : {};
    const image = asString(row.image);
    const availableQty = row.availableQty === null ? null : asNumber(row.availableQty);

    return {
      itemCode: asString(row.itemCode),
      category: asString(row.category, "کوکی"),
      slug: asString(row.slug),
      number: formatPersianNumber(index + 1).padStart(2, "۰"),
      name: asString(row.name),
      shortName: asString(row.shortName, asString(row.name)),
      description: asString(row.description),
      price: toDisplayTomans(asNumber(row.price), currency),
      className: ["product-classic", "product-salt", "product-caramel", "product-mini"][index % 4],
      image: image ? smuleAsset(image) : smuleAsset("/images/smule-cookie.png"),
      imageIsSample: !image,
      imageFilter: "none",
      serving: asString(row.serving, "یک عدد"),
      nutrition: {
        calories: asNumber(nutrition.calories),
        protein: asNumber(nutrition.protein),
        carbohydrates: asNumber(nutrition.carbohydrates),
        fat: asNumber(nutrition.fat),
        sugar: asNumber(nutrition.sugar),
      },
      ingredients: asList(row.ingredients),
      notIncluded: asList(row.notIncluded),
      allergens: asList(row.allergens),
      isSample: Boolean(row.isSample),
      isAvailable: row.isAvailable === true,
      availableQty,
      availabilityReason: asString(row.availabilityReason),
    };
  });
}
