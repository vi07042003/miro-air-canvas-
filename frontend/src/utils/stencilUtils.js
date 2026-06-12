export const processImageToStencil = (img, threshold, invert) => {
  const maxDim = 250;
  let w = img.width;
  let h = img.height;
  if (!w || !h) return { previewUrl: '', contours: [], w: 0, h: 0 };
  
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  let imgData;
  try {
    imgData = ctx.getImageData(0, 0, w, h);
  } catch (e) {
    console.error("Failed to getImageData: Cross-origin image?", e);
    return { previewUrl: '', contours: [], w, h };
  }
  const data = imgData.data;

  // Grayscale
  const grayscale = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    grayscale[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // Sobel Edge Detection
  const sobelData = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      
      const px00 = grayscale[(y - 1) * w + (x - 1)];
      const px01 = grayscale[(y - 1) * w + x];
      const px02 = grayscale[(y - 1) * w + (x + 1)];
      
      const px10 = grayscale[y * w + (x - 1)];
      const px12 = grayscale[y * w + (x + 1)];
      
      const px20 = grayscale[(y + 1) * w + (x - 1)];
      const px21 = grayscale[(y + 1) * w + x];
      const px22 = grayscale[(y + 1) * w + (x + 1)];

      const gx = -px00 + px02 - 2 * px10 + 2 * px12 - px20 + px22;
      const gy = -px00 - 2 * px01 - px02 + px20 + 2 * px21 + px22;

      const gMagnitude = Math.sqrt(gx * gx + gy * gy);
      sobelData[idx] = Math.min(255, gMagnitude);
    }
  }

  // Clear outer border margin to prevent image boundaries from showing up
  const borderMargin = 6;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < borderMargin || x >= w - borderMargin || y < borderMargin || y >= h - borderMargin) {
        sobelData[y * w + x] = 0;
      }
    }
  }

  // Create binary stencil image for preview
  const binaryPixels = new Uint8Array(w * h);
  const previewData = ctx.createImageData(w, h);
  const previewPixels = previewData.data;

  for (let i = 0; i < w * h; i++) {
    const isEdge = sobelData[i] > threshold;
    binaryPixels[i] = isEdge ? 255 : 0;

    // Draw preview
    if (invert) {
      if (isEdge) {
        previewPixels[i * 4] = 255;
        previewPixels[i * 4 + 1] = 255;
        previewPixels[i * 4 + 2] = 255;
        previewPixels[i * 4 + 3] = 255;
      } else {
        previewPixels[i * 4] = 0;
        previewPixels[i * 4 + 1] = 0;
        previewPixels[i * 4 + 2] = 0;
        previewPixels[i * 4 + 3] = 0;
      }
    } else {
      if (isEdge) {
        previewPixels[i * 4] = 0;
        previewPixels[i * 4 + 1] = 0;
        previewPixels[i * 4 + 2] = 0;
        previewPixels[i * 4 + 3] = 255;
      } else {
        previewPixels[i * 4] = 255;
        previewPixels[i * 4 + 1] = 255;
        previewPixels[i * 4 + 2] = 255;
        previewPixels[i * 4 + 3] = 0;
      }
    }
  }
  ctx.putImageData(previewData, 0, 0);
  const previewUrl = canvas.toDataURL('image/png');

  // Contour Tracing
  const visited = new Uint8Array(w * h);
  const contours = [];
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (binaryPixels[idx] === 255 && !visited[idx]) {
        const path = [];
        let curX = x;
        let curY = y;
        path.push({ x: curX, y: curY });
        visited[idx] = 1;

        let found = true;
        while (found) {
          found = false;
          for (let n = 0; n < 8; n++) {
            const nx = curX + dx[n];
            const ny = curY + dy[n];
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const nidx = ny * w + nx;
              if (binaryPixels[nidx] === 255 && !visited[nidx]) {
                curX = nx;
                curY = ny;
                path.push({ x: curX, y: curY });
                visited[nidx] = 1;
                found = true;
                break;
              }
            }
          }
        }
        if (path.length > 2) {
          contours.push(path);
        }
      }
    }
  }

  return { previewUrl, contours, w, h, grayscale };
};
