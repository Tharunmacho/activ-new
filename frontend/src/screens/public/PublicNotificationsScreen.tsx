import { useEffect } from 'react';

// Existing bookmarks and delivered push links open the same header card as the bell.
export default function PublicNotificationsScreen({ navigation, route }: any) {
  useEffect(() => {
    navigation.replace('PublicExplore', { notifications: 'open', noticeId: route?.params?.id });
  }, [navigation, route?.params?.id]);
  return null;
}
