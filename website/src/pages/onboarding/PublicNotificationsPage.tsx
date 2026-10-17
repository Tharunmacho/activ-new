import { Navigate, useLocation } from 'react-router-dom';

// Keep existing bookmarks and delivered push links working with the header card.
export default function PublicNotificationsPage() {
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  query.set('notifications', 'open');
  return <Navigate to={'/?' + query.toString()} replace />;
}
