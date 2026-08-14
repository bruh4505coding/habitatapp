import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

export type PickedMedia = {
  uri: string;
  mimeType: string | null;
};

export type PickImageResult =
  | { ok: true; media: PickedMedia }
  | { ok: false; reason: 'denied' | 'cancelled' };

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function extensionFromMime(mimeType: string | null | undefined): string {
  if (mimeType?.includes('pdf')) return 'pdf';
  if (mimeType?.includes('png')) return 'png';
  if (mimeType?.includes('webp')) return 'webp';
  if (mimeType?.includes('heic') || mimeType?.includes('heif')) return 'jpg';
  return 'jpg';
}

function contentTypeFromExt(ext: string, mimeType: string | null | undefined): string {
  if (mimeType) return mimeType;
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export async function pickOverviewImage(): Promise<PickImageResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { ok: false, reason: 'denied' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets[0]) {
    return { ok: false, reason: 'cancelled' };
  }

  const asset = result.assets[0];
  return {
    ok: true,
    media: {
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
    },
  };
}

export async function pickOverviewDocument(): Promise<PickedMedia | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets[0]) return null;
  return {
    uri: result.assets[0].uri,
    mimeType: result.assets[0].mimeType ?? null,
  };
}

export async function uploadOverviewFile(
  localUri: string,
  habitatId: string,
  groupId: string,
  mimeType?: string | null,
  kind: 'feature' | 'banner' = 'feature',
): Promise<{ url: string | null; error: string | null }> {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const arrayBuffer = base64ToArrayBuffer(base64);
    const ext = extensionFromMime(mimeType);
    const path = `${groupId}/${habitatId}/${kind}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('habitat-overview')
      .upload(path, arrayBuffer, {
        contentType: contentTypeFromExt(ext, mimeType),
        upsert: true,
      });

    if (error) {
      const hint = error.message.includes('Bucket not found')
        ? ' Run the habitat_overviews migration in Supabase to create the storage bucket.'
        : '';
      return { url: null, error: `${error.message}${hint}` };
    }

    const { data } = supabase.storage.from('habitat-overview').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read the selected file.';
    return { url: null, error: message };
  }
}
