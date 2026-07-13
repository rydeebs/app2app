/**
 * Support for "HTML apps" — user-imported .html files stored verbatim and
 * rendered in a sandboxed iframe, instead of being converted to an AppSpec.
 *
 * To avoid a DB migration these are stored in the existing `apps.app_spec`
 * jsonb column as `{ kind: "html", html }`; every other code path branches on
 * `isHtmlApp` before parsing the value as an AppSpec.
 */

export const MAX_HTML_BYTES = 2_000_000; // ~2 MB

export type HtmlApp = { kind: "html"; html: string };

export function isHtmlApp(spec: unknown): spec is HtmlApp {
  return (
    typeof spec === "object" &&
    spec !== null &&
    (spec as { kind?: unknown }).kind === "html" &&
    typeof (spec as { html?: unknown }).html === "string"
  );
}

/** True if the text looks like an HTML document (cheap structural check). */
export function looksLikeHtml(text: string): boolean {
  return /<!doctype html|<html[\s>]|<body[\s>]|<head[\s>]/i.test(text);
}

/** Pull the document <title>, falling back to a generic name. */
export function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = m?.[1]?.replace(/\s+/g, " ").trim();
  return title && title.length ? title.slice(0, 40) : "Imported app";
}

/** Pull a <meta name="theme-color"> hex value, if the file declares one. */
export function extractThemeColor(html: string): string | undefined {
  const m = html.match(
    /<meta[^>]*name=["']theme-color["'][^>]*content=["'](#[0-9a-fA-F]{6})["']/i
  );
  return m?.[1];
}
