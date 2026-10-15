import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Custom text tokens are font sizes, not colours. Keep colour utilities alongside them.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['ui-body', 'ui-small', 'ui-caption'] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
