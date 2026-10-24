import api from './api';

export type UpdateVariable = { key: string; defaultValue: string; overrides: { memberId: string; value: string }[] };
export type UpdateMember = { id: string; fullName: string; email?: string; membershipNumber?: string; region?: string };
export type UpdateVariableOption = { key: string; label: string; detail: string };
export type UpdatePreview = { announcement: { title?: string; summary?: string; body?: string; bannerAlt?: string; attachmentLabel?: string }; eligible: boolean; missing: string[]; values: Record<string, string>; recipient: { id: string; fullName: string } | null };
const unwrap = (response: any) => response?.data?.data ?? response?.data;

export async function findUpdateMembers(params: { search?: string; ids?: string } = {}): Promise<{ members: UpdateMember[]; variables: UpdateVariableOption[] }> {
  const data = unwrap(await api.get('/announcements/admin/recipients', { params }));
  return { members: Array.isArray(data?.members) ? data.members : [], variables: Array.isArray(data?.variables) ? data.variables : [] };
}

export async function previewAssociationUpdate(payload: Record<string, unknown>): Promise<UpdatePreview> {
  const data = unwrap(await api.post('/announcements/admin/preview', payload));
  if (!data?.announcement || !Array.isArray(data?.missing)) throw new Error('The preview could not be loaded. Please try again.');
  return data;
}
