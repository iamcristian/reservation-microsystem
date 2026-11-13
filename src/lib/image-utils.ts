// src/lib/image-utils.ts

/**
 * Resizes and compresses a selected browser image File to a lightweight base64 JPEG Data URL
 * suitable for storing the clinic logo or staff avatar cleanly in SQLite without external S3.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxDimension = 256,
  quality = 0.88
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Por favor selecciona un archivo de imagen válido (PNG, JPG o WebP)."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo de imagen."));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagen dañado o no soportado."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }

        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo procesar la imagen en el navegador."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
