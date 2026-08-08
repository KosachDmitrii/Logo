const SINGLE_CHAR_FOLDS: Record<string, string> = {
  ø: "o",
  æ: "ae",
  œ: "oe",
  ð: "d",
  þ: "th",
  ł: "l",
  ß: "ss",
};

export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[øæœðþłß]/gi, (char) => {
      const folded = SINGLE_CHAR_FOLDS[char.toLocaleLowerCase()];
      return folded ?? char;
    })
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function nameKey(value: string): string {
  return normalizeText(value);
}

export function matchesRule(pattern: RegExp, context: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(context);
}

export function audienceToText(audience?: string[] | string): string {
  if (Array.isArray(audience)) return audience.filter(Boolean).join(" ");
  return audience ?? "";
}
