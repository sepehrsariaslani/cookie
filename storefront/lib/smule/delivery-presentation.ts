export function formatDeliveryMethod(value: string) {
  if (value === "ارسال") return "اسنپ‌پیک · کرج";
  if (value === "تحویل حضوری") return "تحویل حضوری";
  return value;
}

export function formatDeliveryStatus(value: string) {
  const known: Record<string, string> = {
    "Not Delivered": "هنوز ارسال یا تحویل نشده",
    "Partly Delivered": "بخشی از سفارش تحویل شده",
    "Fully Delivered": "سفارش کامل تحویل شده",
  };
  return known[value] ?? value;
}
