export function sanitizeLogMeta<T extends Record<string, unknown> | undefined | null>(meta: T): T {
  if (!meta) return meta;

  const sanitizeValue = (key: string, value: unknown): unknown => {
    if (value === null || value === undefined) return value;

    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message
      };
    }

    if (typeof value === "string") {
      if (["snippet", "raw", "rawHtml", "rawHtmlPath", "html", "body"].includes(key)) {
        return "[redacted]";
      }
      if (["url", "normalizedUrl", "link", "uri"].includes(key)) {
        try {
          const parsed = new URL(value);
          parsed.search = "";
          parsed.hash = "";
          return parsed.toString();
        } catch {
          return value;
        }
      }
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => sanitizeValue(`${key}[${index}]`, item));
    }

    if (typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
          childKey,
          sanitizeValue(childKey, childValue)
        ])
      );
    }

    return value;
  };

  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [key, sanitizeValue(key, value)])
  ) as T;
}
