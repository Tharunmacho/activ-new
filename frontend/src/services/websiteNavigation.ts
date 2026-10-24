import { Alert, Linking, Platform } from 'react-native';
import { nativeContentRoute } from './nativeContentRoute';
import { publicActionFor } from '../utils/publicBrowse';
import { openPublicAction } from './publicNavigation';
import { downloadPublicFile, isPublicDownloadUrl, publicDownloadUrl } from './publicDownload';

export function openPublicAttachment(path: string, filename?: string) {
  if (Platform.OS === 'ios') {
    try { void Linking.openURL(publicDownloadUrl(path)).catch(() => Alert.alert('Could not open document', 'Please try again.')); }
    catch (error: any) { Alert.alert('Could not open document', error?.message || 'Please choose a public HTTPS file.'); }
    return;
  }
  void downloadPublicFile(path, filename).then(result => Alert.alert('Download started', `${result.filename}\nCheck Android Downloads for progress and completion.`))
    .catch(error => Alert.alert('Download could not start', error?.message || 'Please try again.'));
}
/** Shared link boundary for guests, members, CMS links and legacy saved routes. */
export function openWebsitePage(navigation: { navigate: (name: string, params: any) => void; push?: (name: string, params?: any) => void }, path: string, title = 'ACTIV') {
  if (isPublicDownloadUrl(path)) { openPublicAttachment(path); return; }
  const action = publicActionFor(path);
  if (action) { void openPublicAction(navigation, action).catch(() => Alert.alert('Could not open', 'Please try again.')); return; }
  const destination = nativeContentRoute(path, title);
  if (destination) {
    if (navigation.push && ['PublicContent', 'PublicInfo', 'PublicEventDetail'].includes(destination.name)) navigation.push(destination.name, destination.params);
    else navigation.navigate(destination.name, destination.params);
    return;
  }
  if (/^(https?:\/\/|mailto:|tel:)/i.test(path)) void Linking.openURL(path).catch(() => Alert.alert('Could not open link', 'Please try again.'));
}
