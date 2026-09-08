/**
 * Reads a picked file on native. Pickers hand back a file:// URI that
 * expo-file-system can read directly.
 *
 * The web build uses fileRead.web.ts instead, where picked URIs are
 * blob:/data: URLs that expo-file-system cannot read.
 */
import * as FileSystem from 'expo-file-system/legacy';

export async function readFileAsBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function readFileAsText(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}
