import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Keyboard, Platform, ActivityIndicator, Linking, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Notice, PALETTE, SPACE, SIZE, TYPE, asArray,
  PremiumTopBar, GradientAvatar, GradientGlyph, CardSkeletons, StateView, ArtBadge, ChatBubbles3D, PressableScale,
  PREMIUM_GRADIENTS, BRAND, FitImage } from '../../../ui';
import { getThread, sendMessage, markConversationRead, uploadMessageAttachment, deleteMessage, getMessageStatuses } from '../../../services/memberApi';
import { ChatDraftAttachment, ChatAttachment, pickChatDocument, validateChatFile, fileSizeLabel, downloadChatAttachment } from '../../../services/messageAttachments';
import { useThreadKeyboard } from './useThreadKeyboard';
import { resolveMediaUrl } from '../../../config/api.config';
import { memberFacing, OPENERS, EMOJI, timeOf } from './messageCopy';
import { useMemberAccess } from '../useMemberAccess';
import StudentNetworkingGate from '../StudentNetworkingGate';
import { isStudentMembership } from '../../../utils/memberAudience';
import ChatAudio from './ChatAudio';

/**
 * One conversation — website `MemberInbox` thread pane.
 *
 *   GET  /messages/:id (oldest→newest, paged with `before`), re-read quietly every 10 s
 *   POST /messages/:id { body, attachmentUrl, attachment }     POST /messages/:id/read
 *   POST /messages/attachment (field `file`) → signed receipt — upload first, then send
 *
 * Website parity: the openers ("What is it about?" on an empty thread; a
 * "Start with" chip row on a live one, only while the box is empty), the
 * curated emoji grid inserted at the cursor, the chosen picture PREVIEWED with
 * an optional caption before it goes, the placeholder that changes with the
 * state, and plumbing errors never shown to a member.
 *
 * Premium: a fixed brand bar (tap the name for their directory card), day
 * separators, grouped bubbles — yours on the navy→blue gradient, theirs white
 * and lifted — and a composer that rides above the keyboard (Android resizes
 * natively; iOS lifts through the KeyboardAvoidingView around the body).
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const dayKey = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toDateString();
};

/** "Today", "Yesterday", "Monday", "12 Sep 2026". */
const dayLabel = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(d)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return WEEKDAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

type Row =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; m: any; tail: boolean };

function DaySeparator({ label }: { label: string }) {
  return (
    <View style={styles.dayRow} accessibilityRole="header">
      <View style={styles.dayLine} />
      <View style={styles.dayPill}><Text style={styles.dayText} maxFontSizeMultiplier={1.2}>{label}</Text></View>
      <View style={styles.dayLine} />
    </View>
  );
}

function Bubble({ m, tail, onOptions }: { m: any; tail: boolean; onOptions: (message: any) => void }) {
  const mine = !!m?.mine;
  const [downloading, setDownloading] = useState(false);
  const document = !m.deleted && m?.attachment?.kind === 'file' ? m.attachment as ChatAttachment : null;
  const audio = !m.deleted && m?.attachment?.kind === 'audio' ? m.attachment as ChatAttachment : null;
  const img = !m.deleted && !document && !audio && m?.attachmentUrl ? resolveMediaUrl(m.attachmentUrl) : '';
  const openDocument = async () => {
    if (!document || downloading) return;
    setDownloading(true);
    try {
      await downloadChatAttachment(document);
      if (Platform.OS === 'android') Alert.alert('Document saved', `${document.name}\nFind it in Downloads.`);
    } catch (error) { Alert.alert('Could not download', memberFacing(error, 'Please try downloading the document again.')); }
    finally { setDownloading(false); }
  };
  const openImage = () => {
    try { Linking.openURL(img).catch(() => null); } catch { /* nothing to open */ }
  };
  const content = (
    <>
      {m.deleted && <Text style={[styles.body, { fontStyle: 'italic', opacity: 0.8 }, mine && styles.white]}>Message deleted</Text>}
      {audio && <ChatAudio attachment={audio} mine={mine} />}
      {document ? (
        <TouchableOpacity onPress={openDocument} disabled={downloading} accessibilityRole="button" accessibilityLabel={`Download ${document.name}`} style={styles.document}>
          {downloading ? <ActivityIndicator color={mine ? PALETTE.white : PALETTE.blue} /> : <Icon name="description" size={28} color={mine ? PALETTE.white : PALETTE.blue} />}
          <View style={styles.documentText}>
            <Text style={[styles.documentName, mine && styles.white]} numberOfLines={2}>{document.name}</Text>
            <Text style={[styles.documentHint, mine && styles.white]}>{fileSizeLabel(document.size)} · {downloading ? 'Downloading…' : 'Tap to download'}</Text>
          </View>
          <Icon name="download" size={19} color={mine ? PALETTE.white : PALETTE.blue} />
        </TouchableOpacity>
      ) : null}
      {img ? (
        <TouchableOpacity activeOpacity={0.9} onPress={openImage} accessibilityRole="imagebutton" accessibilityLabel="Open picture">
          <FitImage uri={img} style={[styles.img, !m?.body && { marginBottom: SPACE.xs }]} />
        </TouchableOpacity>
      ) : null}
      {!m.deleted && m?.body ? <Text style={[styles.body, mine && { color: PALETTE.white }]} selectable>{m.body}</Text> : null}
      <View style={styles.metaRow}>
        <Text style={[styles.meta, mine && { color: 'rgba(255,255,255,0.78)' }]}>{timeOf(m?.at)}</Text>
        {mine && !m.deleted ? (
          <Icon
            name={m?.readAt ? 'done-all' : 'done'}
            size={14}
            color={m?.readAt ? '#A7F3D0' : 'rgba(255,255,255,0.78)'}
            accessibilityLabel={m?.readAt ? 'Read' : 'Sent'}
          />
        ) : null}
        <TouchableOpacity onPress={() => onOptions(m)} accessibilityRole="button" accessibilityLabel={`Message options ${m.id}`} style={styles.messageOptions}><Icon name="more-horiz" size={18} color={mine ? PALETTE.white : PALETTE.textMuted} /></TouchableOpacity>
      </View>
    </>
  );
  const shape = mine
    ? [styles.bubble, tail && { borderBottomRightRadius: 6 }]
    : [styles.bubble, tail && { borderBottomLeftRadius: 6 }];
  return (
    <View style={[styles.bubbleRow, mine ? styles.right : styles.left, tail ? styles.tailGap : styles.groupGap]}>
      {mine ? (
        <View style={[styles.mineShadow, shape]}>
          <LinearGradient colors={PREMIUM_GRADIENTS.memberButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubbleFill, tail && { borderBottomRightRadius: 6 }, styles.bubblePad]}>
            {content}
          </LinearGradient>
        </View>
      ) : (
        <View style={[styles.theirs, shape, styles.bubblePad]}>{content}</View>
      )}
    </View>
  );
}

const MessageThreadScreen = ({ navigation, route }: any) => {
  const { profile } = useMemberAccess();
  const conversationId = String(route?.params?.conversationId || '');
  const [messages, setMessages] = useState<any[]>([]);
  const [other, setOther] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [older, setOlder] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [picture, setPicture] = useState<ChatDraftAttachment | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const uploaded = useRef<ChatAttachment | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const listRef = useRef<FlatList>(null);
  const focused = useRef(false);
  const followLatest = useRef(true);
  const dragging = useRef(false);
  const loadingOlder = useRef(false);
  const messagesRef = useRef<any[]>([]);
  messagesRef.current = messages;
  const requestVersion = useRef(0);
  const deletedLocally = useRef(new Map<string, 'me' | 'everyone'>());
  const deleting = useRef(false);
  const keyboard = useThreadKeyboard();
  // The composer is the screen's bottom edge — pad it past the home indicator.
  const insets = useSafeAreaInsets();
  const composerBottom = keyboard.visible ? SPACE.sm : Math.max(Number(insets?.bottom || 0), SPACE.md);
  const scrollLatest = useCallback((animated = false) => {
    if (followLatest.current && !loadingOlder.current) listRef.current?.scrollToEnd({ animated });
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (!conversationId) return;
    const request = ++requestVersion.current;
    if (!quiet) { setLoading(true); setError(''); }
    try {
      const [res, statuses] = await Promise.all([getThread(conversationId), quiet && messagesRef.current.length ? getMessageStatuses(conversationId, messagesRef.current.map(message => String(message.id))) : Promise.resolve([])]);
      if (request !== requestVersion.current) return;
      const list = asArray<any>(res?.messages);
      const stateById = new Map(statuses.map(status => [status.id, status]));
      const reconcile = (rows: any[]) => rows.filter(message => deletedLocally.current.get(message.id) !== 'me' && !stateById.get(message.id)?.hidden)
        .map(message => deletedLocally.current.get(message.id) === 'everyone' || stateById.get(message.id)?.deleted ? { ...message, deleted: true, body: '', attachmentUrl: '', attachment: null } : { ...message, ...(stateById.has(message.id) ? { readAt: stateById.get(message.id)?.readAt } : {}) });
      // A quiet poll only ever grows the thread — it never drops "load earlier" pages.
      setMessages((prev) => {
        if (!quiet) return reconcile(list);
        const merged = new Map(prev.map(message => [String(message.id || message._id), message]));
        list.forEach(message => merged.set(String(message.id || message._id), message));
        return reconcile([...merged.values()]).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      });
      if (!quiet) setHasMore(!!res?.hasMore);
      setOther(res?.conversation?.withMember || null);
      markConversationRead(conversationId);
    } catch (err) {
      if (!quiet) setError(memberFacing(err, 'Could not open this conversation'));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { followLatest.current = true; load(); }, [load]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; };
  }, []));

  // The website re-reads the open thread every 10 s.
  useEffect(() => {
    const timer = setInterval(() => { if (focused.current && !sending) load(true); }, 10000);
    return () => clearInterval(timer);
  }, [load, sending]);

  const loadOlder = async () => {
    if (!hasMore || older || !messages.length) return;
    followLatest.current = false;
    loadingOlder.current = true;
    setOlder(true);
    try {
      const res = await getThread(conversationId, String(messages[0]?.at || ''));
      setMessages((prev) => [...new Map([...prev, ...asArray<any>(res?.messages)].map(message => [message.id, message])).values()].filter(message => deletedLocally.current.get(message.id) !== 'me').map(message => deletedLocally.current.get(message.id) === 'everyone' ? { ...message, deleted: true, body: '', attachmentUrl: '', attachment: null } : message).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()));
      setHasMore(!!res?.hasMore);
    } catch { /* keep what is shown */ } finally {
      loadingOlder.current = false;
      setOlder(false);
    }
  };

  const peerName = String(other?.fullName || route?.params?.name || 'Member');
  const firstName = peerName.split(' ').filter(Boolean)[0] || 'there';
  const peerWhere = other?.organizationName || [other?.block, other?.district, other?.state].filter(Boolean).join(', ');
  const peerId = String(other?.id || '');
  const peerPhoto = other?.photoUrl ? resolveMediaUrl(other.photoUrl) : '';

  /** Messages interleaved with day separators; the last of a run from one sender carries the tail. */
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const list = asArray<any>(messages);
    let lastDay = '';
    list.forEach((m, i) => {
      const key = dayKey(m?.at);
      if (key && key !== lastDay) {
        out.push({ kind: 'day', key: `day-${key}`, label: dayLabel(m?.at) });
        lastDay = key;
      }
      const next = list[i + 1];
      const tail = !next || !!next?.mine !== !!m?.mine || dayKey(next?.at) !== key;
      out.push({ kind: 'msg', key: String(m?.id || m?._id || `m-${i}`), m, tail });
    });
    return out;
  }, [messages]);

  const submit = async () => {
    const body = (text || '').trim();
    // A picture alone is a message; one with neither is nothing at all.
    if ((!body && !picture) || sending) return;
    setSending(true);
    setSendError('');
    try {
      let url = '';
      let attachment: ChatAttachment | null = null;
      if (picture) {
        setUploadProgress(0);
        const up = uploaded.current || await uploadMessageAttachment(picture, setUploadProgress);
        uploaded.current = up;
        attachment = up;
        url = String(up?.url || '');
        if (!url || !up.token) throw new Error('The attachment could not be uploaded. Choose the file again.');
      }
      setUploadProgress(null);
      const msg = await sendMessage(conversationId, body, url, attachment || undefined);
      followLatest.current = true;
      setText('');
      setPicture(null);
      uploaded.current = null;
      if (msg && (msg.id || msg.body || msg.attachmentUrl)) setMessages((prev) => [...prev, msg]);
      scrollLatest(true);
    } catch (err) {
      setSendError(memberFacing(err, 'That message could not be sent'));
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  };

  const pickPicture = () => {
    Keyboard.dismiss();
    try {
      if (typeof launchImageLibrary !== 'function') return;
      launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 1600, maxHeight: 1600 }, (res) => {
        const asset = res?.assets?.[0];
        if (!asset?.uri || res?.didCancel) return;
        try {
          const meta = validateChatFile(asset.fileName || 'photo.jpg', asset.type || 'image/jpeg', asset.fileSize);
          setPicture({ ...meta, uri: asset.uri });
          uploaded.current = null;
          setSendError(''); setEmojiOpen(false);
        } catch (error) { setSendError(memberFacing(error, 'Choose another photo.')); }
      });
    } catch (err) {
      console.warn('Native module call safely caught:', err);
    }
  };

  const pickDocument = async (audio = false) => {
    Keyboard.dismiss(); setEmojiOpen(false);
    try {
      const document = await pickChatDocument(audio);
      if (document) { setPicture(document); uploaded.current = null; setSendError(''); }
    } catch (error) { setSendError(memberFacing(error, 'The document could not be opened.')); }
  };

  const remove = async (message: any, scope: 'me' | 'everyone') => {
    if (deleting.current) return;
    deleting.current = true;
    try {
      await deleteMessage(conversationId, String(message.id), scope);
      ++requestVersion.current;
      deletedLocally.current.set(String(message.id), scope);
      setMessages(rows => scope === 'me' ? rows.filter(row => row.id !== message.id) : rows.map(row => row.id === message.id ? { ...row, deleted: true, body: '', attachmentUrl: '', attachment: null } : row));
    } catch (err) { setSendError(memberFacing(err, 'The message could not be deleted. Please try again.')); }
    finally { deleting.current = false; }
  };

  const messageOptions = (message: any) => {
    Keyboard.dismiss();
    Alert.alert('Delete message', 'Delete for me removes this message from your account. Delete for everyone removes your message from both sides.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete for me', onPress: () => { void remove(message, 'me'); } },
      ...(message.mine && !message.deleted ? [{ text: 'Delete for everyone', style: 'destructive' as const, onPress: () => { void remove(message, 'everyone'); } }] : []),
    ]);
  };

  const insertEmoji = (mark: string) => {
    const current = text || '';
    const at = Math.min(selection.start, current.length);
    const to = Math.min(selection.end, current.length);
    const next = current.slice(0, at) + mark + current.slice(to);
    setText(next);
    const caret = at + mark.length;
    setSelection({ start: caret, end: caret });
    setEmojiOpen(false);
  };

  const applyOpener = (tpl: string) => {
    const next = String(tpl || '').replace('{name}', firstName);
    setText(next);
    setSelection({ start: next.length, end: next.length });
  };

  const draftEmpty = !(text || '').trim();
  const cannotSend = sending || (draftEmpty && !picture);
  const placeholder = picture
    ? picture.kind === 'image' ? 'Add a caption, or send the picture on its own…' : picture.kind === 'audio' ? 'Add a caption, or send the audio…' : 'Add a caption, or send the document on its own…'
    : messages.length === 0
      ? 'Write about your business — what you make, what you need…'
      : `Message ${firstName === 'there' ? 'member' : firstName}…`;

  const topBar = (
    <PremiumTopBar
      title={peerName}
      subtitle={peerWhere || 'ACTIV member'}
      onBack={() => navigation.goBack()}
      leading={<GradientAvatar name={peerName} uri={peerPhoto || undefined} size={42} />}
      onTitlePress={peerId ? () => navigation.navigate('DirectoryProfile', { id: peerId, name: peerName }) : undefined}
      right={peerId ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('DirectoryProfile', { id: peerId, name: peerName })}
          style={styles.barBtn}
          accessibilityRole="button"
          accessibilityLabel={`View ${firstName}'s profile`}
        >
          <Icon name="badge" size={20} color={PALETTE.white} />
        </TouchableOpacity>
      ) : undefined}
    />
  );

  const body = loading ? <CardSkeletons rows={5} variant="bubble" style={{ paddingTop: SPACE.lg }} /> : error ? (
    <StateView kind="error" title="Could not open this conversation" message={error} onAction={() => load()} />
  ) : (
    <>
      <FlatList
        ref={listRef}
        testID="chat-message-list"
        style={styles.flex}
        data={rows}
        keyExtractor={(r, i) => String(r?.key || i)}
        renderItem={({ item }) => (item.kind === 'day'
          ? <DaySeparator label={item.label} />
          : <Bubble m={item.m} tail={item.tail} onOptions={messageOptions} />)}
        onContentSizeChange={() => scrollLatest()}
        onLayout={() => scrollLatest()}
        onScrollBeginDrag={() => { dragging.current = true; }}
        onScrollEndDrag={() => { dragging.current = false; }}
        onMomentumScrollBegin={() => { dragging.current = true; }}
        onMomentumScrollEnd={() => { dragging.current = false; }}
        onScroll={event => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          const nearBottom = contentSize.height - layoutMeasurement.height - contentOffset.y <= 80;
          // A keyboard/layout resize is not the reader choosing older history.
          if (nearBottom || dragging.current) {
            followLatest.current = nearBottom;
          }
        }}
        scrollEventThrottle={100}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        ListHeaderComponent={hasMore ? (
          <TouchableOpacity onPress={loadOlder} style={styles.older} accessibilityRole="button">
            {older ? <ActivityIndicator color={PALETTE.blue} /> : (
              <>
                <Icon name="history" size={16} color={PALETTE.blue} />
                <Text style={styles.olderText}>Load earlier messages</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
        ListEmptyComponent={(
          <View style={styles.emptyWrap}>
            <ArtBadge size={96}><ChatBubbles3D size={72} /></ArtBadge>
            <Text style={styles.empty}>No messages yet. Say hello.</Text>
            <Text style={styles.emptySub}>Your first message opens the conversation with {firstName === 'there' ? 'this member' : firstName}.</Text>
          </View>
        )}
        contentContainerStyle={styles.listPad}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        initialNumToRender={10}
        maxToRenderPerBatch={10}
      />

      {/* An EMPTY thread: the labelled openers (website "What is it about?"). */}
      {messages.length === 0 && draftEmpty && !picture && !keyboard.visible ? (
        <View style={styles.openers}>
          <Text style={styles.openersTitle}>What is it about?</Text>
          <Text style={styles.openersHint}>Pick one to start. It goes in the box below for you to change before you send it.</Text>
          {OPENERS.map((o, i) => (
            <PressableScale
              key={o.label}
              onPress={() => applyOpener(o.text)}
              contentStyle={styles.opener}
              accessibilityRole="button"
              accessibilityLabel={`${o.label}. ${o.hint}`}
            >
              <GradientGlyph icon={o.icon} tone={i === 0 ? 'blue' : i === 1 ? 'teal' : 'amber'} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.openerTitle}>{o.label}</Text>
                <Text style={styles.openerSub} numberOfLines={2}>{o.hint}</Text>
              </View>
              <Icon name="north-east" size={16} color={PALETTE.textFaint} />
            </PressableScale>
          ))}
        </View>
      ) : null}

      {/* A LIVE thread: one quiet chip row, only while the box is empty. */}
      {messages.length > 0 && draftEmpty && !picture && !keyboard.visible ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled" style={styles.chipScroll}>
          <Text style={styles.chipLead}>START WITH</Text>
          {OPENERS.map((o) => (
            <TouchableOpacity key={o.label} style={styles.chip} onPress={() => applyOpener(o.text)} accessibilityRole="button">
              <Icon name={o.icon} size={14} color={PALETTE.blue} />
              <Text style={styles.chipText}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {/* The chosen picture, before it goes. */}
      {picture ? (
        <View style={styles.preview}>
          {picture.kind === 'image' ? <FitImage uri={picture.uri} style={styles.previewImg} /> : <Icon name={picture.kind === 'audio' ? 'audiotrack' : 'description'} size={36} color={PALETTE.blue} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.previewName} numberOfLines={1}>{picture.name}</Text>
            <Text style={styles.previewHint}>{picture.kind === 'image' ? 'Ready to send — a caption is optional.' : sending ? uploadProgress === null ? 'Sending…' : `Uploading ${uploadProgress}%…` : [fileSizeLabel(picture.size), 'Caption optional'].filter(Boolean).join(' · ')}</Text>
          </View>
          <TouchableOpacity disabled={sending} onPress={() => { setPicture(null); uploaded.current = null; }} accessibilityLabel={picture.kind === 'image' ? 'Remove picture' : 'Remove attachment'} style={styles.previewX}>
            <Icon name="close" size={SIZE.icon} color={PALETTE.textMuted} />
          </TouchableOpacity>
        </View>
      ) : null}

      {emojiOpen ? (
        <View style={styles.emojiGrid}>
          {EMOJI.map((mark, i) => (
            <TouchableOpacity key={`${mark}-${i}`} style={styles.emojiCell} onPress={() => insertEmoji(mark)} accessibilityRole="button" accessibilityLabel={`Insert ${mark}`}>
              <Text style={styles.emoji}>{mark}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {sendError ? <Notice kind="warning" text={sendError} style={styles.sendError} /> : null}
      <View style={styles.attachmentTools}>
        <TouchableOpacity onPress={pickPicture} disabled={sending} style={styles.attachmentTool} accessibilityRole="button" accessibilityLabel="Send a picture"><Icon name="add-photo-alternate" size={22} color={PALETTE.blueDark} /><Text style={styles.toolLabel}>Photo</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => void pickDocument()} disabled={sending} style={styles.attachmentTool} accessibilityRole="button" accessibilityLabel="Attach a document"><Icon name="description" size={22} color={PALETTE.blueDark} /><Text style={styles.toolLabel}>Document</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => void pickDocument(true)} disabled={sending} style={styles.attachmentTool} accessibilityRole="button" accessibilityLabel="Attach audio"><Icon name="audiotrack" size={22} color={PALETTE.blueDark} /><Text style={styles.toolLabel}>Audio</Text></TouchableOpacity>
      </View>
      <View style={[styles.composer, { paddingBottom: composerBottom }]}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={text}
            editable={!sending}
            onFocus={() => setEmojiOpen(false)}
            onChangeText={(v) => { setText(v); if (sendError) setSendError(''); }}
            onSelectionChange={(ev) => setSelection(ev?.nativeEvent?.selection || { start: (text || '').length, end: (text || '').length })}
            placeholder={placeholder}
            placeholderTextColor={PALETTE.textFaint}
            selectionColor={PALETTE.blue}
            multiline
            maxLength={4000}
            accessibilityLabel="Message"
          />
          <TouchableOpacity
            onPress={() => setEmojiOpen((v) => !v)}
            style={styles.emojiBtn}
            accessibilityRole="button"
            accessibilityLabel={emojiOpen ? 'Close emoji' : 'Insert an emoji'}
          >
            <Icon name={emojiOpen ? 'keyboard' : 'insert-emoticon'} size={SIZE.iconLg - 2} color={emojiOpen ? PALETTE.blue : PALETTE.textMuted} />
          </TouchableOpacity>
        </View>
        <PressableScale
          onPress={submit}
          disabled={cannotSend}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: cannotSend, busy: sending }}
        >
          {cannotSend && !sending ? (
            <View style={[styles.sendBtn, { backgroundColor: PALETTE.disabled }]}><Icon name="send" size={SIZE.icon} color={PALETTE.textFaint} /></View>
          ) : (
            <LinearGradient colors={PREMIUM_GRADIENTS.memberButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.sendBtn, styles.sendShadow]}>
              {sending ? <ActivityIndicator color={PALETTE.white} /> : <Icon name="send" size={SIZE.icon} color={PALETTE.white} />}
            </LinearGradient>
          )}
        </PressableScale>
      </View>
    </>
  );

  if (isStudentMembership(profile)) return <StudentNetworkingGate navigation={navigation} />;
  return (
    <View ref={keyboard.ref} onLayout={keyboard.onLayout} style={styles.screen}>
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {topBar}
          {body}
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.flex, { paddingBottom: keyboard.overlap }]} testID="chat-keyboard-frame">
          {topBar}
          <View style={styles.flex}>{body}</View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  attachmentTools: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACE.md, backgroundColor: PALETTE.white, borderTopWidth: 1, borderTopColor: PALETTE.border },
  attachmentTool: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { fontSize: 12, fontWeight: '700', color: PALETTE.blueDark },
  messageOptions: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: PALETTE.canvas },
  flex: { flex: 1 },
  document: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 170, maxWidth: 250, paddingVertical: 6 },
  documentText: { flex: 1, minWidth: 0 },
  documentName: { fontSize: 14, fontWeight: '700', color: PALETTE.text },
  documentHint: { fontSize: 11, color: PALETTE.textMuted, marginTop: 4 },
  white: { color: PALETTE.white },
  barBtn: {
    width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2, alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND.glass, borderWidth: 1, borderColor: BRAND.glassBorder,
  },
  listPad: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, paddingBottom: SPACE.md, flexGrow: 1 },

  dayRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginVertical: SPACE.md },
  dayLine: { flex: 1, height: 1, backgroundColor: PALETTE.border },
  dayPill: { paddingHorizontal: SPACE.md, paddingVertical: 4, borderRadius: 999, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border },
  dayText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: PALETTE.textMuted, letterSpacing: 0.3 },

  bubbleRow: { flexDirection: 'row' },
  tailGap: { marginBottom: SPACE.md },
  groupGap: { marginBottom: 3 },
  left: { justifyContent: 'flex-start', paddingRight: SPACE.xxl },
  right: { justifyContent: 'flex-end', paddingLeft: SPACE.xxl },
  bubble: { maxWidth: '82%', minWidth: 76, borderRadius: 20 },
  bubbleFill: { borderRadius: 20 },
  bubblePad: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: SPACE.sm },
  mineShadow: {
    backgroundColor: BRAND.blue, shadowColor: BRAND.blue, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 4,
  },
  theirs: {
    backgroundColor: PALETTE.white, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)',
    shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  img: { width: 220, maxWidth: '100%', height: 180, borderRadius: 14, marginBottom: SPACE.xs + 2, backgroundColor: PALETTE.field },
  body: { fontSize: 15, lineHeight: 21, color: PALETTE.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: SPACE.xs, marginTop: SPACE.xs },
  meta: { fontSize: 11, lineHeight: 14, color: PALETTE.textFaint },

  older: {
    flexDirection: 'row', gap: 6, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', minHeight: 36,
    paddingHorizontal: SPACE.lg, marginBottom: SPACE.md, borderRadius: 999, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border,
  },
  olderText: { color: PALETTE.blue, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.xl, gap: SPACE.sm },
  empty: { ...TYPE.heading, textAlign: 'center', marginTop: SPACE.sm },
  emptySub: { ...TYPE.caption, textAlign: 'center', maxWidth: 280 },

  openers: {
    backgroundColor: PALETTE.white, paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, paddingBottom: SPACE.sm,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8,
  },
  openersTitle: { ...TYPE.heading },
  openersHint: { ...TYPE.caption, fontSize: 13, lineHeight: 18, fontWeight: '400', marginTop: 2, marginBottom: SPACE.xs },
  opener: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, borderWidth: 1, borderColor: PALETTE.border, borderRadius: 16,
    padding: SPACE.md, marginTop: SPACE.sm, backgroundColor: PALETTE.fieldBg,
  },
  openerTitle: { ...TYPE.bodyStrong },
  openerSub: { ...TYPE.caption, fontWeight: '400', marginTop: 2 },

  chipScroll: { flexGrow: 0, backgroundColor: PALETTE.white, borderTopWidth: 1, borderTopColor: PALETTE.border },
  chipRow: { alignItems: 'center', gap: SPACE.xs + 2, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
  chipLead: { ...TYPE.eyebrow, color: PALETTE.textFaint, marginRight: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#C7DAFB', borderRadius: 999,
    paddingHorizontal: SPACE.md, minHeight: 34, backgroundColor: PALETTE.blueTint,
  },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: PALETTE.blueDark },

  preview: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginHorizontal: SPACE.lg, marginVertical: SPACE.sm, padding: SPACE.sm,
    borderRadius: 16, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: PALETTE.white,
  },
  previewImg: { width: 56, height: 56, borderRadius: 12, backgroundColor: PALETTE.field },
  previewName: { ...TYPE.bodyStrong },
  previewHint: { ...TYPE.caption, marginTop: 2 },
  previewX: { width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2, alignItems: 'center', justifyContent: 'center' },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderTopWidth: 1, borderTopColor: PALETTE.border, backgroundColor: PALETTE.white },
  emojiCell: { width: '12.5%', minHeight: SIZE.touch, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },

  sendError: { marginHorizontal: SPACE.lg, marginBottom: SPACE.sm },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.sm, paddingHorizontal: SPACE.md, paddingTop: SPACE.sm,
    backgroundColor: PALETTE.white, borderTopWidth: 1, borderTopColor: PALETTE.border,
  },
  iconBtn: { width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.blueSoft },
  inputWrap: {
    flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-end', minHeight: SIZE.touch, borderRadius: 22,
    backgroundColor: PALETTE.fieldBg, borderWidth: 1, borderColor: PALETTE.border,
  },
  input: {
    flex: 1, minWidth: 0, maxHeight: 120, paddingLeft: 14, paddingRight: 4,
    paddingTop: Platform.OS === 'ios' ? 12 : 10, paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15, lineHeight: 20, color: PALETTE.text,
  },
  emojiBtn: { width: 40, height: SIZE.touch - 2, alignItems: 'center', justifyContent: 'center' },
  sendBtn: { width: SIZE.touch, height: SIZE.touch, borderRadius: SIZE.touch / 2, alignItems: 'center', justifyContent: 'center' },
  sendShadow: { shadowColor: BRAND.blue, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
});

export default MessageThreadScreen;
