import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { uploadAdminProfilePhoto } from '../../../services/adminProfilePhoto';

export function useAdminPhotoUpload(onSaved: (photo: string) => void) {
  const [photoBusy, setPhotoBusy] = useState(false);
  const busy = useRef(false);
  const handlePickImage = async () => {
    if (busy.current) return;
    busy.current = true;
    setPhotoBusy(true);
    try {
      const response = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
      if (response.didCancel) return;
      if (response.errorCode) throw new Error(response.errorMessage || 'Could not select a photo.');
      const asset = response.assets?.[0];
      if (!asset?.uri) return;
      onSaved(await uploadAdminProfilePhoto(asset));
    } catch (error: any) {
      Alert.alert('Photo not saved', error?.response?.data?.message || error?.message || 'Please try again.');
    } finally {
      busy.current = false;
      setPhotoBusy(false);
    }
  };
  return { photoBusy, handlePickImage };
}
