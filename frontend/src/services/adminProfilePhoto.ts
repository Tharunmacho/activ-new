import type { Asset } from 'react-native-image-picker';
import api from './api';

/** Saves the signed-in administrator's own photo; the server chooses the account. */
export async function uploadAdminProfilePhoto(asset: Pick<Asset, 'uri' | 'type' | 'fileName' | 'fileSize'>): Promise<string> {
  if (!asset.uri) throw new Error('Choose a photo to upload.');
  if (asset.type && !asset.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (Number(asset.fileSize || 0) > 5 * 1024 * 1024) throw new Error('Choose a photo smaller than 5 MB.');
  const form = new FormData();
  form.append('photo', { uri: asset.uri, type: asset.type || 'image/jpeg', name: asset.fileName || 'profile.jpg' } as any);
  const response = await api.post('/admin/profile/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  const photo = String((response.data?.data ?? response.data)?.profilePhoto || '').trim();
  if (!photo) throw new Error('The server did not confirm the photo upload. Please try again.');
  return photo;
}
