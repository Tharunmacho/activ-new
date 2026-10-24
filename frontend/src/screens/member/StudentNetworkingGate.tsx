import React from 'react';
import { PremiumPage, PremiumPageHeader, StateView } from '../../ui';
import { STUDENT_UPGRADE_MESSAGE } from '../../utils/memberAudience';
export default function StudentNetworkingGate({ navigation }: { navigation: any }) {
  return <PremiumPage header={<PremiumPageHeader title="Grow your network" subtitle="Your next membership level" onBack={() => navigation.goBack()} />}>
    <StateView title="Upgrade to connect" message={STUDENT_UPGRADE_MESSAGE} action="Explore membership upgrades" onAction={() => navigation.navigate('MembershipPlans', { upgrade: true })} />
  </PremiumPage>;
}
