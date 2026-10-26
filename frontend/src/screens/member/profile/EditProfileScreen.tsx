import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../types';
import { Notice, PALETTE, SPACE, TYPE, SurfaceCard, GradientAvatar } from '../../../ui';
import { errorText } from '../../../ui/data';
import { getMyProfile, uploadProfilePhoto } from '../../../services/memberApi';
import { resolveMediaUrl } from '../../../config/api.config';
import { useMemberStore } from '../../../stores/memberStore';
import PersonalDetailsFormScreen from '../../profile/PersonalDetailsFormScreen';

/**
 * ============================================================================
 * EDIT PERSONAL DETAILS (website: /member/profile?step=1 from ProfileView)
 * ============================================================================
 *
 * The SAME form as step 1 of the application — same fields, option lists,
 * validation and `PUT /members/profile` body — in edit mode: it saves and
 * returns instead of walking on to step 2, and honours the server's `isLocked`.
 *
 * The photo sits on top, uploaded the website's way (POST
 * /members/profile-photo, multipart `profilePhoto`). The old screen posted a
 * `photo` field the server does not read, and wrote a flat subset of the
 * profile without the demographic fields.
 *
 * Password changes live in Account Settings (POST /auth/change-password), as
 * the website's form keeps them apart from the profile writer.
 */

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EditProfile'>;
};

function PhotoSlot() {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const TYPE = useLegacyAppearance(legacyAppearance_TYPE);
  const { updateMember } = useMemberStore();
  const [photo, setPhoto] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await getMyProfile();
      setPhoto(String(me?.profilePhoto || me?.profileImage || ''));
      setName(String(me?.fullName || me?.name || ''));
    } catch {
      /* the form below reports load failures */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pick = () => {
    setMsg(null);
    try {
      if (typeof launchImageLibrary !== 'function') {
        setMsg({ kind: 'danger', text: 'The photo picker is not available on this device.' });
        return;
      }
      launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 1200, maxHeight: 1200, selectionLimit: 1 }, async (res: any) => {
        try {
          if (res?.didCancel) return;
          if (res?.errorCode) {
            setMsg({ kind: 'danger', text: res?.errorMessage || 'Could not open your photos.' });
            return;
          }
          const asset = (res?.assets || [])[0];
          if (!asset?.uri) return;
          if (asset?.type && !String(asset.type).startsWith('image/')) {
            setMsg({ kind: 'danger', text: 'Please choose an image file (JPG, PNG or WebP).' });
            return;
          }
          if (Number(asset?.fileSize || 0) > 5 * 1024 * 1024) {
            setMsg({ kind: 'danger', text: 'The photo must be under 5 MB.' });
            return;
          }
          setBusy(true);
          const stored = await uploadProfilePhoto(asset.uri, asset?.type || 'image/jpeg', asset?.fileName || 'profile.jpg');
          setPhoto(stored);
          setBroken(false);
          try { updateMember({ profilePhoto: stored }); } catch { /* cache only */ }
          setMsg({ kind: 'success', text: 'Profile photo updated' });
        } catch (err) {
          setMsg({ kind: 'danger', text: errorText(err, 'Failed to upload photo') });
        } finally {
          setBusy(false);
        }
      });
    } catch (err) {
      console.warn('Native module call safely caught:', err);
    }
  };

  const uri = resolveMediaUrl(photo || '');

  return (
    <SurfaceCard style={s.card}>
      <View style={s.row}>
        <TouchableOpacity onPress={pick} disabled={busy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Change profile photo">
          <View>
            <GradientAvatar name={name || 'Member'} uri={uri && !broken ? uri : undefined} size={68} />
            <View style={s.camera}>
              {busy ? <ActivityIndicator size="small" color={PALETTE.white} /> : <Icon name="photo-camera" size={14} color={PALETTE.white} />}
            </View>
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={TYPE.heading}>Profile photo</Text>
          <Text style={[TYPE.small, { color: PALETTE.textMuted, marginTop: 2 }]}>JPG, PNG or WebP, under 5 MB. Tap to change.</Text>
        </View>
      </View>
      {msg ? <Notice kind={msg.kind} text={msg.text} style={s.msg} /> : null}
    </SurfaceCard>
  );
}

const EditProfileScreen: React.FC<Props> = ({ navigation }) => (
  <PersonalDetailsFormScreen
    navigation={navigation as any}
    route={{ key: 'EditProfile', name: 'PersonalDetailsForm', params: { userData: {} } } as any}
    editMode
    topSlot={<PhotoSlot />}
  />
);

const s = StyleSheet.create({
  card: { marginBottom: SPACE.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  msg: { marginHorizontal: 0, marginTop: SPACE.md, marginBottom: 0 },
  camera: {
    position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: PALETTE.blue, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: PALETTE.white,
  },
});

export default EditProfileScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_TYPE = TYPE;
