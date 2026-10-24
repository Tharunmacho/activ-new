import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { GlassIconButton } from './premium/controls';
import { resolveMediaUrl } from '../config/api.config';

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const imageDocument = (url: string, fit: 'contain' | 'width') => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes"><style>html,body{margin:0;background:#0B1330}img{display:block;width:100%;${fit === 'contain' ? 'height:100vh;object-fit:contain' : 'height:auto'}}</style></head><body><img alt="Full image" src="${escape(url)}"></body></html>`;

/** Opaque full-screen viewer, mounted beside a Stack screen; never a nested transparent modal. */
export function PhotoViewer({ url, visible, onClose, title = 'Photo', closeLabel = 'Close photo', fit = 'contain' }: {
  url?: string; visible: boolean; onClose: () => void; title?: string; closeLabel?: string; fit?: 'contain' | 'width';
}) {
  const insets = useSafeAreaInsets();
  const uri = resolveMediaUrl(url || '');
  return <Modal visible={visible && !!uri} animationType="slide" onRequestClose={onClose}>
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.bar}>
        <View style={styles.text}><Text numberOfLines={1} style={styles.title}>{title}</Text><Text style={styles.hint}>Pinch to zoom</Text></View>
        <GlassIconButton icon="close" accessibilityLabel={closeLabel} onPress={onClose} />
      </View>
      {visible && !!uri && <WebView source={{ html: imageDocument(uri, fit) }} javaScriptEnabled={false} domStorageEnabled={false}
        originWhitelist={['about:blank']} onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('data:text/html')}
        style={styles.screen} />}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1330' },
  bar: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, minWidth: 0 },
  title: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, fontWeight: '700' },
  hint: { color: '#C7D4EA', fontSize: 12, lineHeight: 18, marginTop: 2 },
});
