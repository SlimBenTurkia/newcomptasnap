
/**
 * Utility to process and optimize images for OCR analysis.
 * Resizes images to reasonable dimensions and applies basic filters to improve legibility.
 */

export interface ProcessedImage {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
}

export async function processImageForOCR(
  file: File | string, 
  maxWidth = 1024, 
  maxHeight = 1024,
  quality = 0.75
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Draw image to canvas
      ctx.drawImage(img, 0, 0, width, height);

      // --- Enhancement Filters (Scan-like effect) ---
      // 1. Convert to grayscale (optional, but often helps OCR)
      // 2. Increase contrast and brightness slightly
      
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Apply basic contrast enhancement
      // Simple linear contrast adjustment: factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
      const contrast = 30; // Contrast value (-255 to 255)
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      
      for (let i = 0; i < data.length; i += 4) {
        // Red, Green, Blue
        data[i] = factor * (data[i] - 128) + 128;
        data[i+1] = factor * (data[i+1] - 128) + 128;
        data[i+2] = factor * (data[i+2] - 128) + 128;
        
        // Clamping values
        data[i] = Math.min(255, Math.max(0, data[i]));
        data[i+1] = Math.min(255, Math.max(0, data[i+1]));
        data[i+2] = Math.min(255, Math.max(0, data[i+2]));
      }
      
      ctx.putImageData(imageData, 0, 0);

      // Export as optimized JPEG
      const optimizedDataUrl = canvas.toDataURL("image/jpeg", quality);
      
      // Calculate optimized size
      const head = 'data:image/jpeg;base64,';
      const optimizedSize = Math.round((optimizedDataUrl.length - head.length) * 3 / 4);

      // Convert back to Blob for potential other uses
      canvas.toBlob((blob) => {
        if (blob) {
          resolve({
            dataUrl: optimizedDataUrl,
            blob: blob,
            width,
            height,
            originalSize: typeof file === 'string' ? 0 : file.size,
            optimizedSize
          });
        } else {
          reject(new Error("Canvas toBlob failed"));
        }
      }, "image/jpeg", quality);
    };

    img.onerror = (err) => reject(err);

    if (typeof file === "string") {
      img.src = file;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    }
  });
}
