import { apiUpload } from './apiClient';

/** Upload a file privately and get back its storage key (for inspections). */
export async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiUpload<{ storageKey: string }>('/uploads', form);
  return res.data.storageKey;
}
