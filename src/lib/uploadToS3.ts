export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/**
 * Upload a file directly to S3 using a presigned URL.
 * Uses XMLHttpRequest for upload progress tracking (fetch doesn't support it).
 */
export function uploadFileToS3(
  uploadUrl: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Error al subir archivo: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Error de red durante la subida")));
    xhr.addEventListener("abort", () => reject(new Error("Subida cancelada")));

    xhr.send(file);
  });
}
