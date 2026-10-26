import { AppThemeProvider, useAppTheme } from './src/ui/AppTheme';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
/**
 * Activ App
 * React Native App with Navigation
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { initAnalytics, trackScreen } from './src/services/analytics';
import { usePushNotifications, flushPushNavigation } from './src/services/pushNotifications';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LogBox, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

LogBox.ignoreAllLogs();

// Auth Screens
import OnboardingScreen from './src/screens/auth/OnboardingScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import AdminLoginScreen from './src/screens/auth/AdminLoginScreen';
import { navigationRef } from './src/navigation/navigationRef';
// Each area registers its NEW screens in its own file (no shared edits).
import { memberScreens } from './src/navigation/routes/memberRoutes';
import { paymentScreens } from './src/navigation/routes/paymentRoutes';
import { businessScreens } from './src/navigation/routes/businessRoutes';
import { adminScreens } from './src/navigation/routes/adminRoutes';
import { superScreens } from './src/navigation/routes/superRoutes';
import { eventsAdminScreens } from './src/navigation/routes/eventsAdminRoutes';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/auth/ResetPasswordScreen';
import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import PublicExploreScreen from './src/screens/public/PublicExploreScreen';
import PublicNotificationsScreen from './src/screens/public/PublicNotificationsScreen';
import PublicEventDetailScreen from './src/screens/public/PublicEventDetailScreen';
import SocialSignInScreen from './src/screens/auth/SocialSignInScreen';
import { useDeepLinks, flushPendingDeepLink } from './src/navigation/deepLinks';

// Registration Screens
import RegistrationStep1Screen from './src/screens/registration/RegistrationStep1Screen';
import RegistrationStep2Screen from './src/screens/registration/RegistrationStep2Screen';

// Member Screens
import MemberBottomTabs from './src/navigation/MemberBottomTabs';
import BlockAdminBottomTabs from './src/navigation/BlockAdminBottomTabs';
import DistrictAdminBottomTabs from './src/navigation/DistrictAdminBottomTabs';
import StateAdminBottomTabs from './src/navigation/StateAdminBottomTabs';
import SuperAdminBottomTabs from './src/navigation/SuperAdminBottomTabs';
import EditProfileScreen from './src/screens/member/profile/EditProfileScreen';
import PaidDashboardScreen from './src/screens/member/paidDashboard/PaidDashboardScreen';
import PaidProfileScreen from './src/screens/member/paidDashboard/PaidProfileScreen';
import PaidSettingsScreen from './src/screens/member/paidDashboard/PaidSettingsScreen';
import EditBusinessScreen from './src/screens/member/profile/EditBusinessScreen';
import EditFinancialScreen from './src/screens/member/profile/EditFinancialScreen';
import EditDeclarationScreen from './src/screens/member/profile/EditDeclarationScreen';

// Profile Completion Forms
import PersonalDetailsFormScreen from './src/screens/profile/PersonalDetailsFormScreen';
import BusinessInformationFormScreen from './src/screens/profile/BusinessInformationFormScreen';
import FinancialComplianceFormScreen from './src/screens/profile/FinancialComplianceFormScreen';
import DeclarationFormScreen from './src/screens/profile/DeclarationFormScreen';

// Application Screens
import ApplicationStatusScreen from './src/screens/application/ApplicationStatusScreen';
import ApplicationSubmittedScreen from './src/screens/application/ApplicationSubmittedScreen';

// Business Screens
import BusinessProfileScreen from './src/screens/business/BusinessProfileScreen';
import BusinessDashboardScreen from './src/screens/business/BusinessDashboardScreen';
import ManageCompaniesScreen from './src/screens/business/ManageCompaniesScreen';
import AddCompanyScreen from './src/screens/business/AddCompanyScreen';
import ProductsServicesScreen from './src/screens/business/ProductsServicesScreen';
import AddProductScreen from './src/screens/business/AddProductScreen';
import DiscoverScreen from './src/screens/business/DiscoverScreen';
import AnalyticsScreen from './src/screens/business/AnalyticsScreen';
import SettingsScreen from './src/screens/business/SettingsScreen';
import EditCompanyScreen from './src/screens/business/EditCompanyScreen';
import ViewCompanyScreen from './src/screens/business/ViewCompanyScreen';
import BusinessProfileViewScreen from './src/screens/business/BusinessProfileViewScreen';

// Admin Screens
import {
  ApplicantDetailScreen,
} from './src/screens/admin';

// Payment Screens
import {
  CompleteMembershipScreen,
  PaymentGatewayScreen,
  MockPaymentScreen,
  PaymentSuccessScreen,
} from './src/screens/payment';

import ErrorBoundary from './src/components/ErrorBoundary';
import AppUpdateGate from './src/components/AppUpdateGate';
import NotificationPermissionPrompt from './src/components/NotificationPermissionPrompt';
import { RootStackParamList } from './src/types';

// Global JavaScript Error Handler to prevent app crashes on uncaught errors
if (typeof (globalThis as any).ErrorUtils !== 'undefined') {
  const defaultHandler = (globalThis as any).ErrorUtils.getGlobalHandler();
  (globalThis as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    console.error('Caught global JS error:', error, 'isFatal:', isFatal);
    // Suppress fatal crash and prevent app exit
    if (__DEV__) {
      defaultHandler(error, false);
    }
  });
}

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppContent() {
  const { palette, isDark } = useAppTheme();
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: { ...(isDark ? DarkTheme.colors : DefaultTheme.colors), primary: palette.primaryDark,
      background: palette.canvas, card: palette.card, text: palette.text, border: palette.border, notification: palette.red },
  };
  const [notificationEntryReady, setNotificationEntryReady] = useState(false);
  const updateNotificationEntry = () => {
    const state = navigationRef.getRootState();
    const home = state?.routes[state.index || 0]?.name;
    setNotificationEntryReady(!!home && ['PublicExplore', 'MemberMain', 'PaidDashboard', 'BlockDashboard', 'DistrictDashboard', 'StateDashboard', 'SuperAdminDashboard', 'EventsAdminHome'].includes(home));
  };
  // activ:// links: social sign-in hand-off and password-reset tokens.
  useDeepLinks();
  usePushNotifications();
  useEffect(() => { void initAnalytics(); }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppUpdateGate>
        <NavigationContainer theme={navigationTheme} ref={navigationRef} onReady={() => { flushPendingDeepLink(); void flushPushNavigation(); updateNotificationEntry(); }} onStateChange={() => { void flushPushNavigation(); void trackScreen(navigationRef.getCurrentRoute()?.name); updateNotificationEntry(); }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Stack.Navigator initialRouteName="Onboarding">
          <Stack.Screen name="PublicExplore" component={PublicExploreScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PublicNotifications" component={PublicNotificationsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PublicEventDetail" component={PublicEventDetailScreen} options={{ headerShown: false }} />
          {/* Auth Stack */}
          <Stack.Screen 
            name="Onboarding" 
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Welcome" 
            component={WelcomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          {/* The admin sign-in: same design, no social, no register. */}
          <Stack.Screen
            name="AdminLogin"
            component={AdminLoginScreen}
            options={{ headerShown: false }}
          />
        {/* Reachable from the "Forget password?" link on the login
            screen, which used to open an Alert with nowhere to go. */}
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        {/* Where activ://auth/social lands after Google / Facebook / LinkedIn. */}
        <Stack.Screen name="SocialSignIn" component={SocialSignInScreen} options={{ headerShown: false }} />
          
          {/* Registration Stack */}
          <Stack.Screen 
            name="RegistrationStep1" 
            component={RegistrationStep1Screen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="RegistrationStep2" 
            component={RegistrationStep2Screen}
            options={{ headerShown: false }}
          />
          
          {/* Member Stack */}
          <Stack.Screen 
            name="MemberMain" 
            component={MemberBottomTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="EditProfile" 
            component={EditProfileScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="EditBusiness" 
            component={EditBusinessScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="EditFinancial" 
            component={EditFinancialScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="EditDeclaration" 
            component={EditDeclarationScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="PaidDashboard" 
            component={PaidDashboardScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="PaidProfile" 
            component={PaidProfileScreen}
            options={{ headerShown: false }}
          />
          
          {/* Profile Completion Forms */}
          <Stack.Screen 
            name="PersonalDetailsForm" 
            component={PersonalDetailsFormScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="BusinessInformationForm" 
            component={BusinessInformationFormScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="FinancialComplianceForm" 
            component={FinancialComplianceFormScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="DeclarationForm" 
            component={DeclarationFormScreen}
            options={{ headerShown: false }}
          />
          
          {/* Application Screens */}
          <Stack.Screen 
            name="ApplicationStatus" 
            component={ApplicationStatusScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ApplicationSubmitted" 
            component={ApplicationSubmittedScreen}
            options={{ headerShown: false }}
          />
          
          {/* Business Screens */}
          <Stack.Screen 
            name="BusinessProfile" 
            component={BusinessProfileScreen}
            options={{ title: 'Business Profile' }}
          />
          <Stack.Screen 
            name="BusinessDashboard" 
            component={BusinessDashboardScreen}
            options={{ title: 'Business Dashboard' }}
          />
          <Stack.Screen 
            name="ManageCompanies" 
            component={ManageCompaniesScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="AddCompany" 
            component={AddCompanyScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ProductsServices" 
            component={ProductsServicesScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="AddProduct" 
            component={AddProductScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Discover" 
            component={DiscoverScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Analytics" 
            component={AnalyticsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="PaidSettings" 
            component={PaidSettingsScreen}
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen}
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="EditCompany" 
            component={EditCompanyScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ViewCompany" 
            component={ViewCompanyScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="BusinessProfileView" 
            component={BusinessProfileViewScreen}
            options={{ headerShown: false }}
          />
          
          {/* Admin Screens */}
          <Stack.Screen
            name="ApplicantDetail"
            component={ApplicantDetailScreen}
            options={{ headerShown: false }}
          />

          {/* Block Admin Screens */}
          <Stack.Screen name="BlockDashboard" component={BlockAdminBottomTabs} options={{ headerShown: false }} />

          {/* District Admin Screens */}
          <Stack.Screen name="DistrictDashboard" component={DistrictAdminBottomTabs} options={{ headerShown: false }} />

          {/* State Admin Screens */}
          <Stack.Screen name="StateDashboard" component={StateAdminBottomTabs} options={{ headerShown: false }} />

          {/* Super Admin Screens */}
          <Stack.Screen name="SuperAdminDashboard" component={SuperAdminBottomTabs} options={{ headerShown: false }} />
          {memberScreens(Stack)}
          {paymentScreens(Stack)}
          {businessScreens(Stack)}
          {adminScreens(Stack)}
          {superScreens(Stack)}
          {/* Events Admin: QR check-in at the event door. */}
          {eventsAdminScreens(Stack)}

          {/* Payment Screens */}
          <Stack.Screen 
            name="CompleteMembership" 
            component={CompleteMembershipScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="PaymentGateway" 
            component={PaymentGatewayScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="MockPayment" 
            component={MockPaymentScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="PaymentSuccess" 
            component={PaymentSuccessScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <NotificationPermissionPrompt ready={notificationEntryReady} />
        </AppUpdateGate>
    </SafeAreaProvider>
  </ErrorBoundary>
  );
}

function App() {
  return <AppThemeProvider><AppContent /></AppThemeProvider>;
}

export default App;
