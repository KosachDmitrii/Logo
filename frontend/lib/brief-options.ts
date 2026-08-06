/** Canonical English values stored in brief state; display via i18n. */

export const INDUSTRY_OPTIONS = [
  "Architecture",
  "Interior Design",
  "Real Estate",
  "Construction",
  "Technology",
  "Artificial Intelligence",
  "Software",
  "Finance",
  "Healthcare",
  "Beauty & Wellness",
  "Fashion",
  "Food & Beverage",
  "Hospitality",
  "Travel",
  "Retail",
  "E-commerce",
  "Education",
  "Media",
  "Entertainment",
  "Culture & Arts",
  "Creative Services",
  "Professional Services",
  "Clean Energy",
  "Automotive",
  "Consumer Products",
  "Nonprofit",
  "Other",
] as const;

export type IndustryOption = (typeof INDUSTRY_OPTIONS)[number];

const KNOWN_INDUSTRIES = new Set<string>(
  INDUSTRY_OPTIONS.filter((item) => item !== "Other"),
);

export function optionKey(prefix: string, value: string): string {
  return `${prefix}.${value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")}`;
}

export function splitIndustry(value: string): {
  choice: string;
  other: string;
} {
  const trimmed = value.trim();
  if (!trimmed) return { choice: "", other: "" };
  if (KNOWN_INDUSTRIES.has(trimmed)) return { choice: trimmed, other: "" };
  return {
    choice: "Other",
    other: trimmed === "Other" ? "" : trimmed,
  };
}
