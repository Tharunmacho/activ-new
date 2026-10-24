import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BRAND, PALETTE, SPACE, PremiumSelect, PressableScale, SiteArt, SurfaceCard } from '../../ui';
import { getPublicContactInfo } from '../../services/publicContent';
import { contactMapHtml, publicOffices } from '../../utils/contactOffices';

let MapView: any = null;
try { MapView = require('react-native-webview').WebView; } catch { /* Contact details still work without a map module. */ }

export function ExploreContact({ openPage, refreshKey = 0 }: { openPage: (path: string, title: string) => void; refreshKey?: number }) {
  const [info, setInfo] = useState<any>(null);
  const [selected, setSelected] = useState('');
  const [mapFailed, setMapFailed] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    getPublicContactInfo(controller.signal).then(data => { if (!controller.signal.aborted) setInfo(data); }).catch(() => {});
    return () => controller.abort();
  }, [refreshKey]);
  const offices = useMemo(() => publicOffices(info), [info]);
  const office = offices.find(item => item.id === selected) || offices[0];
  const officeChoices = offices.map(item => ({ id: item.id, label: item.label
    + (item.state && !item.label.toLowerCase().includes(item.state.toLowerCase()) ? ' · ' + item.state : '') }));
  useEffect(() => { setMapFailed(false); setMapLoading(true); }, [office?.mapEmbedUrl, refreshKey]);
  const contact = () => openPage('/contact' + (office?.state && !office.isHeadOffice ? '?state=' + encodeURIComponent(office.state) : ''), 'Contact us');
  const directions = async () => {
    if (!office?.directionsUrl) return contact();
    try { await Linking.openURL(office.directionsUrl); }
    catch { Alert.alert('Map unavailable', 'Please try again or open the Contact us page.'); }
  };

  return <View style={s.section}>
    <Text style={s.heading} accessibilityRole="header">Contact us</Text>
    {offices.length > 1 && <PremiumSelect label="Choose an office" icon="place" iconBadge strong
      value={officeChoices.find(item => item.id === office?.id)?.label || ''} options={officeChoices.map(item => item.label)}
      onChange={label => { const choice = officeChoices.find(item => item.label === label); if (choice) setSelected(choice.id); }} />}
    <SurfaceCard padded={false}>
      <View style={s.body}>
        <View style={s.titleRow}><View style={s.art}><SiteArt kind="contact" size={34} /></View>
          <View style={s.copy}><Text style={s.title}>{office?.label || 'Let’s connect'}</Text>
            <Text style={s.description}>{office?.address || 'Questions about ACTIV? Our team is here to help.'}</Text></View>
        </View>
        <PressableScale onPress={contact} accessibilityRole="button" accessibilityLabel="Get in touch with ACTIV" contentStyle={s.contactButton}>
          <Text style={s.contactButtonText}>Contact our team</Text><Icon name="arrow-forward" size={17} color={BRAND.blue} />
        </PressableScale>
      </View>
      {office && <PressableScale onPress={directions} accessibilityRole="button" accessibilityLabel={'Open directions to ' + office.label}>
        <View style={s.map} pointerEvents="none">
          {MapView && office.mapEmbedUrl && !mapFailed ? <MapView key={office.mapEmbedUrl + refreshKey} source={{ html: contactMapHtml(office.mapEmbedUrl), baseUrl: 'https://activ.org.in/' }} style={s.map}
            incognito sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} scrollEnabled={false} javaScriptEnabled domStorageEnabled
            setSupportMultipleWindows={false} onError={() => { setMapFailed(true); setMapLoading(false); }} onLoadEnd={() => setMapLoading(false)} />
            : <View style={s.mapFallback}><SiteArt kind="zones" size={70} /><Text style={s.mapFallbackText}>Find your ACTIV office</Text></View>}
          {mapLoading && !mapFailed && !!office.mapEmbedUrl && MapView && <ActivityIndicator style={StyleSheet.absoluteFill} color={BRAND.blue} />}
          <View style={s.mapLabel}><Icon name="directions" size={17} color={BRAND.blue} /><Text style={s.mapLabelText}>Open map</Text></View>
        </View>
      </PressableScale>}
    </SurfaceCard>
  </View>;
}

const s = StyleSheet.create({
  section: { marginTop: SPACE.lg, marginBottom: SPACE.sm }, heading: { color: BRAND.navyDeep, fontSize: 20, lineHeight: 27, fontWeight: '800', letterSpacing: -0.4, marginBottom: SPACE.md },
  map: { height: 180, width: '100%', backgroundColor: PALETTE.blueSoft }, mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }, mapFallbackText: { color: BRAND.navy, fontSize: 13, fontWeight: '600' },
  mapLabel: { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: PALETTE.white, elevation: 3 }, mapLabelText: { color: BRAND.blue, fontSize: 12, fontWeight: '800' },
  body: { padding: SPACE.md }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md }, art: { width: 46, height: 50, borderRadius: 15, backgroundColor: BRAND.navy, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 }, title: { color: BRAND.navyDeep, fontSize: 16, lineHeight: 22, fontWeight: '800' }, description: { color: PALETTE.textMuted, fontSize: 12, lineHeight: 19, marginTop: 4 },
  contactButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: 12, backgroundColor: PALETTE.blueSoft, borderRadius: 12, marginTop: SPACE.md }, contactButtonText: { color: BRAND.blue, fontSize: 13, fontWeight: '700' },
});
