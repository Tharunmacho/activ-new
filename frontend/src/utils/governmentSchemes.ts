/** "None" is an answer to the form, not an availed government scheme. */
export function governmentSchemes(value: unknown, otherDetails?: unknown) {
  const entries = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const schemes: string[] = [];
  let none = false;
  for (const entry of entries) {
    if (typeof entry !== 'string') continue;
    const name = entry.trim();
    if (!name) continue;
    if (/^(none|nil|n\/?a|no|not applicable)$/i.test(name)) { none = true; continue; }
    const label = /^others?$/i.test(name) && typeof otherDetails === 'string' && otherDetails.trim() ? otherDetails.trim() : name;
    if (!schemes.some(scheme => scheme.toLowerCase() === label.toLowerCase())) schemes.push(label);
  }
  return { schemes, explicitlyNone: none && !schemes.length };
}
