import React from 'react';
import { useAppTheme } from '../../../ui/AppTheme';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminTier, TierMenuDrawer, TierMenuProvider, useTierMenu, TierTab } from './TierMenu';
import { adminTabScreenOptions, makeAdminTabIcon } from './adminTabBar';

/**
 * The bottom tabs + the menu drawer, shared by the Block, District and State
 * navigators so the three tiers can never drift apart. The tabs are the
 * website's rail (TierMenu.tierNav): the Hub only for District and State.
 */

const Tab = createBottomTabNavigator();

const ICONS: Record<TierTab, string> = {
  Dashboard: 'space-dashboard',
  Approvals: 'fact-check',
  Members: 'groups',
  Hub: 'account-tree',
  Settings: 'manage-accounts',
};

const TAB_ICONS: Record<TierTab, any> = {
  Dashboard: makeAdminTabIcon(ICONS.Dashboard),
  Approvals: makeAdminTabIcon(ICONS.Approvals),
  Members: makeAdminTabIcon(ICONS.Members),
  Hub: makeAdminTabIcon(ICONS.Hub),
  Settings: makeAdminTabIcon(ICONS.Settings),
};

export interface TierIdentity {
  adminName: string;
  roleTitle: string;
  region: string;
  photo?: string | null;
}

interface Props {
  tier: AdminTier;
  /** BlockDashboard / DistrictDashboard / StateDashboard — this navigator's stack route. */
  stackRoute: string;
  /** The root stack navigation this navigator was given. */
  rootNavigation: any;
  identity: TierIdentity;
  screens: { name: TierTab; component: React.ComponentType<any> }[];
}

function Inner({ tier, stackRoute, rootNavigation, identity, screens }: Props) {
  const { palette } = useAppTheme();
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
        {screens.map((sc) => (
          <Tab.Screen key={sc.name} name={sc.name} component={sc.component} options={{ tabBarIcon: TAB_ICONS[sc.name] }} />
        ))}
      </Tab.Navigator>
      <TierMenuDrawer
        tier={tier}
        adminName={identity.adminName}
        roleTitle={identity.roleTitle}
        region={identity.region}
        photo={identity.photo}
        rootNavigation={rootNavigation}
        stackRoute={stackRoute}
      />
    </View>
  );
}

/** Must be rendered INSIDE the tier's data provider (identity comes from it). */
export default function TierTabs(props: Props) {
  return (
    <TierMenuProvider>
      <Inner {...props} />
    </TierMenuProvider>
  );
}
