import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Video, { VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ChatAttachment, chatAudioSource } from '../../../services/messageAttachments';
import { PALETTE } from '../../../ui';

export default function ChatAudio({ attachment, mine }: { attachment: ChatAttachment; mine: boolean }) {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const [source, setSource] = useState<Awaited<ReturnType<typeof chatAudioSource>> | null>(null);
  const [paused, setPaused] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const mounted = useRef(true);
  const focused = useRef(false);
  const player = useRef<VideoRef>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; setPaused(true); }; }, []));
  useEffect(() => { const listener = AppState.addEventListener('change', state => { if (state !== 'active') setPaused(true); }); return () => listener.remove(); }, []);
  const play = async () => {
    if (loading) return;
    if (source) { if (duration && position >= duration - 0.25) player.current?.seek(0); setPaused(!paused); return; }
    setLoading(true); setError('');
    try { const value = await chatAudioSource(attachment); if (mounted.current && focused.current) { setSource(value); setPaused(false); } }
    catch { if (mounted.current) setError('Audio could not be opened. Please try again.'); }
    finally { if (mounted.current) setLoading(false); }
  };
  const color = mine ? PALETTE.white : PALETTE.blue;
  const clock = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
  return <View style={styles.wrap}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${paused ? 'Play' : 'Pause'} ${attachment.name}`} onPress={() => void play()} disabled={loading} style={styles.control}>
      {loading ? <ActivityIndicator color={color} /> : <Icon name={paused ? 'play-arrow' : 'pause'} size={30} color={color} />}
      <View style={styles.text}><Text numberOfLines={2} style={[styles.name, { color }]}>{attachment.name}</Text><Text style={[styles.time, { color }]}>{clock(position)}{duration ? ` / ${clock(duration)}` : ' · Audio'}</Text></View>
    </TouchableOpacity>
    {source && <Video ref={player} source={source} paused={paused} playInBackground={false} playWhenInactive={false} ignoreSilentSwitch="ignore" style={styles.player} onLoad={event => setDuration(event.duration)} onProgress={event => setPosition(event.currentTime)} onEnd={() => { setPaused(true); setPosition(duration); }} onError={() => { setPaused(true); setSource(null); setError('This audio could not be played. Try an MP3 or M4A recording.'); }} />}
    {!!error && <Text accessibilityRole="alert" style={[styles.time, { color }]}>{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({ wrap: { minWidth: 170, maxWidth: 250 }, control: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48 }, text: { flex: 1 }, name: { fontSize: 14, fontWeight: '700' }, time: { fontSize: 11, marginTop: 4 }, player: { width: 1, height: 1 } });

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_styles = styles;
