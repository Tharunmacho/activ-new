import React from 'react';
import MemberEventDetailScreen from '../member/events/MemberEventDetailScreen';

/** The native programme, with anonymous reads and guest/member booking choices. */
export default function PublicEventDetailScreen(props: any) {
  return <MemberEventDetailScreen {...props} publicAccess />;
}
