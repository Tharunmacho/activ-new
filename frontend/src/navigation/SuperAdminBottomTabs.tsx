import React from 'react';
import { useAppTheme } from '../ui/AppTheme';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { adminTabScreenOptions, makeAdminTabIcon } from '../screens/admin/shared/adminTabBar';

import { SuperAdminProvider } from '../screens/admin/super/context/SuperAdminContext';
import SuperAdminActionHubScreen from '../screens/admin/super/SuperAdminActionHubScreen';
import ManageAdminsScreen from '../screens/admin/super/ManageAdminsScreen';
import ManageEventsScreen from '../screens/admin/super/ManageEventsScreen';
import SystemScreen from '../screens/admin/super/SystemScreen';
import SuperMenuScreen from '../screens/admin/super/SuperMenuScreen';
import { SuperMenuDrawer } from '../screens/admin/super/SuperMenuDrawer';
import { TierMenuProvider, useTierMenu } from '../screens/admin/shared/TierMenu';

/**
 * The Super Admin console — five tabs (the most that fit a 360dp phone with
 * their labels): Hub, Admins, Events, Settings, and More (every other feature
 * the website's sidebar has — SuperMenuScreen). Everything deeper is a stack
 * screen (routes/superRoutes.tsx) pushed over the tabs.
 *
 * Plus the ☰ side menu the tier dashboards have (SuperMenuDrawer), opened
 * from the button at the top-left of every tab.
 */
export type SuperAdminBottomTabParamList = {
  Hub: undefined;
  Admins: { q?: string } | undefined;
  /** Every event — create, edit, QR, delete (website /super-admin/events). */
  Events: undefined;
  Settings: undefined;
  /** Every other Super Admin feature (the website sidebar) — see SuperMenuScreen. */
  More: undefined;
};

const Tab = createBottomTabNavigator<SuperAdminBottomTabParamList>();

const HubIcon = makeAdminTabIcon('space-dashboard');
const AdminsIcon = makeAdminTabIcon('manage-accounts');
const EventsIcon = makeAdminTabIcon('event');
const SettingsIcon = makeAdminTabIcon('settings');
const MoreIcon = makeAdminTabIcon('apps');

function Tabs({ navigation }: { navigation: any }) {
  const { palette } = useAppTheme();
  // Without this the bar sits under Android's gesture pill and iOS's home
  // indicator: labels get clipped and the last rows of a list scroll behind it.
  const insets = useSafeAreaInsets();
  const menu = useTierMenu();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenListeners={{
          focus: (e: any) => { try { menu.setActive(String(e?.target || '').split('-')[0]); } catch { /* ignore */ } },
        }}
        screenOptions={adminTabScreenOptions(insets.bottom, palette)}
      >
        <Tab.Screen name="Hub" component={SuperAdminActionHubScreen} options={{ tabBarIcon: HubIcon }} />
        <Tab.Screen name="Admins" component={ManageAdminsScreen} options={{ tabBarIcon: AdminsIcon }} />
        <Tab.Screen name="Events" component={ManageEventsScreen} options={{ tabBarIcon: EventsIcon }} />
        <Tab.Screen name="Settings" component={SystemScreen} options={{ tabBarIcon: SettingsIcon }} />
        <Tab.Screen name="More" component={SuperMenuScreen} options={{ tabBarIcon: MoreIcon }} />
      </Tab.Navigator>
      <SuperMenuDrawer rootNavigation={navigation} />
    </View>
  );
}

const SuperAdminBottomTabs = ({ navigation }: any) => (
  <SuperAdminProvider>
    <TierMenuProvider>
      <Tabs navigation={navigation} />
    </TierMenuProvider>
  </SuperAdminProvider>
);

export default SuperAdminBottomTabs;
