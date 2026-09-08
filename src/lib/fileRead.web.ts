/**
 * Web counterpart of fileRead.ts.
 *
 * On web the pickers return blob:/data: URLs rather than file:// paths, so we
 * fetch the URL and decode it with FileReader instead of expo-file-system
 * (which is a no-op in the browser).
 */

async function blobFrom(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Could not read the selected file.');
  }
  return response.blob();
}

export async function readFileAsBase64(uri: string): Promise<string> {
  const blob = await blobFrom(uri);

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      // Strip the "data:<mime>;base64," prefix that readAsDataURL adds.
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export async function readFileAsText(uri: string): Promise<string> {
  const blob = await blobFrom(uri);
  return blob.text();
}
