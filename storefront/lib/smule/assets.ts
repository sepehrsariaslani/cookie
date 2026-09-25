const FRAPPE_SITE_ASSET_ROOT = "/assets/smule_store/site";

/** Resolve app-owned static assets without rewriting ERPNext's own file URLs. */
export function smuleAsset(path: string) {
  if (/^(?:https?:)?\/\//i.test(path) || /^(?:\/files\/|\/private\/files\/|\/assets\/)/.test(path)) return path;
  return `${FRAPPE_SITE_ASSET_ROOT}${path.startsWith("/") ? path : `/${path}`}`;
}
