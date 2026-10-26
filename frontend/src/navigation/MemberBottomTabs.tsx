import { useLegacyAppearance } from '../ui/legacyAppearance';
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MemberBottomTabParamList } from '../types';
import DashboardScreen from '../screens/member/dashboard/DashboardScreen';
// The member "Explore" tab is the paid-gated Member Directory (GET /members/directory),
// never BrowseMembersScreen — that one reads the ADMIN dashboard (/admin/block/dashboard)
// and answers a member with 403.
import MemberDirectoryScreen from '../screens/member/directory/MemberDirectoryScreen';
import NotificationScreen from '../screens/member/NotificationScreen';
import ProfileScreen from '../screens/member/profile/ProfileScreen';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { View } from 'react-native';
import { BRAND, PALETTE, SHADOW, SIZE, SPACE } from '../ui';

const Tab = createBottomTabNavigator<MemberBottomTabParamList>();

/* Tab bar look — kit tokens only (white bar, hairline top border, soft upward shadow). */
const TAB_BAR = {
  backgroundColor: PALETTE.card,
  borderTopColor: PALETTE.border,
  borderTopWidth: 1,
  borderTopLeftRadius: 22,
  borderTopRightRadius: 22,
  minHeight: SIZE.row + SPACE.sm,
  paddingTop: SPACE.xs + 2,
  ...SHADOW.top,
  shadowColor: BRAND.shadowNavy,
};
const TAB_PILL = { minWidth: 52, height: 30, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const };
const TAB_LABEL = { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, marginBottom: SPACE.xxs };
const TAB_ITEM = { paddingVertical: SPACE.xxs };

// Tab bar icons — the focused one sits on a soft blue pill (premium look).
const TabGlyph = ({ name, color, size, focused }: { name: string; color: string; size: number; focused: boolean }) => {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
  <View style={[TAB_PILL, focused && { backgroundColor: PALETTE.blueSoft }]}>
    <Icon name={name} size={size} color={color} />
  </View>
);
};

const HomeIcon = ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
  <TabGlyph name="home" color={color} size={size} focused={focused} />
);

const ExploreIcon = ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
  <TabGlyph name="explore" color={color} size={size} focused={focused} />
);

const NotificationsIcon = ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
  <TabGlyph name="notifications" color={color} size={size} focused={focused} />
);

const ProfileIcon = ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
  <TabGlyph name="person" color={color} size={size} focused={focused} />
);

const MemberBottomTabs = () => {
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const TAB_BAR = useLegacyAppearance(legacyAppearance_TAB_BAR);
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: BRAND.blue900,
        tabBarInactiveTintColor: PALETTE.textFaint,
        tabBarLabelStyle: TAB_LABEL,
        tabBarItemStyle: TAB_ITEM,
        // Hidden by design: the member area navigates from the dashboard header
        // (menu, messages, bell). The style is kept on-brand for when it is shown.
        tabBarStyle: [TAB_BAR, { display: 'none' }],
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: HomeIcon,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="BrowseMembers"
        component={MemberDirectoryScreen}
        options={{
          tabBarLabel: 'Explore',
          tabBarIcon: ExploreIcon,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationScreen}
        options={{
          tabBarLabel: 'Notifications',
          tabBarIcon: NotificationsIcon,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ProfileIcon,
        }}
      />
    </Tab.Navigator>
  );
};

export default MemberBottomTabs;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_BRAND = BRAND;
const legacyAppearance_TAB_BAR = TAB_BAR;
