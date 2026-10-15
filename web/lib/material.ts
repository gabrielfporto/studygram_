export function safeMaterialUrl(value:string|null|undefined):string|null {
  if(!value?.trim()) return null;
  try { const url=new URL(value.trim()); return ['http:','https:'].includes(url.protocol) && !url.username && !url.password && url.href.length<=2048?url.href:null; } catch { return null; }
}
