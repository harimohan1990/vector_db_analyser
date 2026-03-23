/**
 * Robust clipboard copy — tries modern API first, falls back to execCommand.
 * Works on HTTP localhost and older browsers.
 * @param {string} text
 * @returns {Promise<boolean>} true if succeeded
 */
export async function copyToClipboard(text) {
  // Modern Clipboard API (HTTPS or localhost in most browsers)
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to execCommand
    }
  }

  // Legacy fallback
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
