import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getInitials } from '../screens/admin/applicantStyles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 310);

const GUTTER = 16;
const ROW_PAD = 12;
const ICON_BOX_SIZE = 40;

type NavKey = 'dashboard' | 'approvals' | 'members' | 'settings';

interface AdminSidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  navigation: any;
  activeNav: NavKey;
  onNavSelect: (nav: NavKey) => void;
  adminName?: string;
  blockName?: string;
  onLogout?: () => void;
}

const MENU_ITEMS: { key: NavKey; label: string; icon: string; iconBg: string; iconColor: string }[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'grid-view',
    iconBg: '#DBEAFE',
    iconColor: '#2563EB',
  },
  {
    key: 'approvals',
    label: 'Approvals',
    icon: 'assignment-turned-in',
    iconBg: '#FFF3E0',
    iconColor: '#EA580C',
  },
  {
    key: 'members',
    label: 'Members',
    icon: 'people',
    iconBg: '#E8F5E9',
    iconColor: '#16A34A',
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'settings',
    iconBg: '#E0F2FE',
    iconColor: '#0284C7',
  },
];

const AdminSidebarDrawer: React.FC<AdminSidebarDrawerProps> = ({
  isOpen,
  onClose,
  navigation,
  activeNav,
  onNavSelect,
  adminName = '',
  blockName = '',
  onLogout,
}) => {
  const insets = useSafeAreaInsets();

  if (!isOpen) return null;

  // The region comes from the signed-in admin's own record. Naming one here as
  // a default would put a real region's name above somebody else's queue.
  const displayedBlockName = blockName || '';
  const displayedTitle = adminName && adminName !== 'Block Admin'
    ? adminName
    : (displayedBlockName ? `${displayedBlockName} Admin` : 'Block Admin');
  const initials = getInitials(displayedTitle) || 'AA';

  const handleSupportPress = () => {
    Alert.alert(
      'ACTIV Support',
      'Membership queries: member@activ.org.in\nEvent queries: events@activ.org.in\nPhone: +91 82201 12188',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.absoluteContainer}>
      <View style={styles.overlay}>
        {/* Backdrop Tap Area */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Sidebar Drawer Container */}
        <View style={styles.drawerContainer}>
          {/* Top Soft Banner (Fixed Header with Safe Area Insets) */}
          <View style={[styles.headerBanner, { paddingTop: Math.max(insets.top + 8, 36) }]}>
            <View style={styles.headerTopRow}>
              {/* Brand Shield Logo & Title */}
              <View style={styles.brandRow}>
                <View style={styles.logoBadgeContainer}>
                  <Image
                    source={require('../assets/images/activlogo.png')}
                    style={styles.brandLogoImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.brandTextWrap}>
                  <Text style={styles.brandTitle} numberOfLines={1}>
                    ACTIV
                  </Text>
                  <Text style={styles.brandSubtitle} numberOfLines={1}>
                    Block Admin Panel
                  </Text>
                </View>
              </View>

              {/* Close Drawer Button << */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="keyboard-double-arrow-left" size={20} color="#2563EB" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrollable Main Content */}
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {/* Admin Profile Card */}
            <View style={styles.profileCard}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
                <View style={styles.onlineBadgeDot} />
              </View>
              <View style={styles.profileTextWrap}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {displayedTitle}
                </Text>
                <Text style={styles.profileRole} numberOfLines={1}>
                  Block Admin
                </Text>
              </View>
            </View>

            {/* Menu Section */}
            <Text style={styles.menuHeaderLabel}>MENU</Text>
            <View style={styles.menuList}>
              {MENU_ITEMS.map(item => {
                const isActive = activeNav === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.menuItem,
                      isActive && styles.menuItemActive,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => {
                      onNavSelect(item.key);
                      onClose();
                    }}
                  >
                    {/* Active Left Vertical Accent Bar */}
                    {isActive && <View style={styles.activeLeftBar} />}

                    <View
                      style={[
                        styles.menuIconBox,
                        { backgroundColor: isActive ? '#DBEAFE' : item.iconBg },
                      ]}
                    >
                      <Icon
                        name={item.icon}
                        size={20}
                        color={isActive ? '#2563EB' : item.iconColor}
                      />
                    </View>

                    <Text
                      style={[
                        styles.menuItemLabel,
                        isActive && styles.menuItemLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>

                    <Icon
                      name="chevron-right"
                      size={20}
                      color={isActive ? '#2563EB' : '#CBD5E1'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tappable Support Box */}
            <TouchableOpacity
              style={styles.supportCard}
              onPress={handleSupportPress}
              activeOpacity={0.85}
            >
              <View style={styles.supportIconCircle}>
                <Icon name="headset-mic" size={20} color="#2563EB" />
              </View>
              <View style={styles.supportTextWrap}>
                <Text style={styles.supportTitle} numberOfLines={1}>
                  Support
                </Text>
                <Text style={styles.supportSubtitle} numberOfLines={2}>
                  Need help? Contact our support team
                </Text>
              </View>
              <View style={styles.supportArrowBtn}>
                <Icon name="north-east" size={16} color="#2563EB" />
              </View>
            </TouchableOpacity>
          </ScrollView>

          {/* Fixed Pinned Footer (Logout Button with Safe Area Insets) */}
          <View style={[styles.footerWrap, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => {
                onClose();
                if (onLogout) onLogout();
              }}
              activeOpacity={0.8}
            >
              <View style={styles.logoutIconBox}>
                <Icon name="logout" size={20} color="#EF4444" />
              </View>
              <Text style={styles.logoutText} numberOfLines={1}>
                Logout
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  absoluteContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  drawerContainer: {
    width: DRAWER_WIDTH,
    backgroundColor: '#FFFFFF',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    flexDirection: 'column',
  },
  headerBanner: {
    paddingBottom: 6,
    paddingHorizontal: GUTTER + ROW_PAD,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    gap: 12,
  },
  logoBadgeContainer: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  brandLogoImage: {
    width: 24,
    height: 24,
    tintColor: '#FFFFFF',
  },
  brandTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 16,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingBottom: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: ROW_PAD,
    marginHorizontal: GUTTER,
    marginTop: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatarCircle: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: ICON_BOX_SIZE / 2,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  onlineBadgeDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileTextWrap: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
  },
  profileRole: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  menuHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    paddingHorizontal: GUTTER + ROW_PAD,
    marginBottom: 8,
  },
  menuList: {
    paddingHorizontal: GUTTER,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: ROW_PAD,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  menuItemActive: {
    backgroundColor: '#EFF6FF',
  },
  activeLeftBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#2563EB',
  },
  menuIconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  menuItemLabelActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 16,
    padding: ROW_PAD,
    marginHorizontal: GUTTER,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  supportIconCircle: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: ICON_BOX_SIZE / 2,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  supportTextWrap: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
  },
  supportSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  supportArrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  footerWrap: {
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: ROW_PAD,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutIconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoutText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
});

export default AdminSidebarDrawer;
