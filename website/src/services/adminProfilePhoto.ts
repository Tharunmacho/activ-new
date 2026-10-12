import api from './api';

/** The authenticated account is selected by the server, never by an upload field. */
export async function uploadAdminProfilePhoto(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Choose a photo smaller than 5 MB.');
    const body = new FormData();
    body.append('photo', file);
    const response = await api.post('/admin/profile/photo', body);
    const photo = String((response.data?.data ?? response.data)?.profilePhoto || '').trim();
    if (!photo) throw new Error('The server did not confirm the photo upload. Please try again.');
    return photo;
}
