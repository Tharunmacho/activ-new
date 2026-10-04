export function isPublicPreviewPath(path: unknown): boolean;
export function fetchPagePreview(api: string, route: string): Promise<string | null>;
export function mergePagePreview(shell: string, preview: string, origin?: string): string;
