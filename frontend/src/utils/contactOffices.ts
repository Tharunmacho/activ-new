export type PublicOffice = {
  id: string; label: string; state: string; isHeadOffice: boolean; address: string;
  mapEmbedUrl: string; directionsUrl: string;
};

const text = (value: any) => String(value || '').trim();
const googleMap = (value: any) => /^https:\/\/(?:(?:www|maps)\.)?google\.(?:com|co\.in)\/(?:maps(?:[/?]|$)|\?)/i.test(text(value)) ? text(value) : '';

export function contactMapHtml(url: string) {
  const safe = googleMap(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;overflow:hidden}body{background:#eaf1ff}</style></head><body><iframe title="ACTIV office map" src="${safe}" referrerpolicy="no-referrer-when-downgrade"></iframe></body></html>`;
}

/** Uses the same active offices and legacy fallback as the website Contact page. */
export function publicOffices(info: any): PublicOffice[] {
  if (!info || info.sections?.some((section: any) => section?.key === 'contact.info' && section.hidden === true)) return [];
  const current = Array.isArray(info.offices) ? info.offices.filter((office: any) => office && office.isActive !== false) : [];
  const legacy = info.addressLines?.length || info.phone || info.email || info.mapEmbedUrl;
  return (current.length ? current : legacy ? [{ ...info, id: 'head-office', label: 'Head Office', isHeadOffice: true }] : [])
    .sort((a: any, b: any) => Number(!!b.isHeadOffice) - Number(!!a.isHeadOffice) || Number(a.order || 0) - Number(b.order || 0))
    .map((office: any, index: number) => {
      const address = (Array.isArray(office.addressLines) ? office.addressLines : []).map(text).map((line: string) => line.replace(/[,;]+$/, '')).filter(Boolean).join(', ');
      return {
        id: text(office.id) || String(index), label: text(office.label || office.state) || 'ACTIV office',
        state: text(office.state), isHeadOffice: !!office.isHeadOffice, address,
        mapEmbedUrl: googleMap(office.mapEmbedUrl) || (address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed` : ''),
        directionsUrl: googleMap(office.directionsUrl) || googleMap(office.mapLink)
          || (address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}` : ''),
      };
    });
}
