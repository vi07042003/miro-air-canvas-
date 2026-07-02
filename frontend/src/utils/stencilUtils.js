export const processImageToStencil = (img, threshold, invert, isSketch = false) => {
  // Increase resolution to 1200 to capture high-quality details and legible text
  const maxDim = 1200;
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

  // 1. Grayscale conversion
  const grayscale = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    grayscale[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // 2. 3x3 Gaussian Blur to reduce high-frequency text/image noise (skip for sketches to keep thin lines sharp)
  const blurred = new Uint8Array(w * h);
  if (isSketch) {
    for (let i = 0; i < w * h; i++) {
      blurred[i] = grayscale[i];
    }
  } else {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const val = 
          1 * grayscale[(y - 1) * w + (x - 1)] + 2 * grayscale[(y - 1) * w + x] + 1 * grayscale[(y - 1) * w + (x + 1)] +
          2 * grayscale[y * w + (x - 1)]       + 4 * grayscale[y * w + x]       + 2 * grayscale[y * w + (x + 1)] +
          1 * grayscale[(y + 1) * w + (x - 1)] + 2 * grayscale[(y + 1) * w + x] + 1 * grayscale[(y + 1) * w + (x + 1)];
        blurred[idx] = val >> 4;
      }
    }
    // Copy boundaries for blurred image
    for (let x = 0; x < w; x++) {
      blurred[x] = grayscale[x];
      blurred[(h - 1) * w + x] = grayscale[(h - 1) * w + x];
    }
    for (let y = 0; y < h; y++) {
      blurred[y * w] = grayscale[y * w];
      blurred[y * w + (w - 1)] = grayscale[y * w + (w - 1)];
    }
  }

  // 3. Sobel Edge Detection (using blurred/original image)
  const gxData = new Float32Array(w * h);
  const gyData = new Float32Array(w * h);
  const magData = new Float32Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      
      const px00 = blurred[(y - 1) * w + (x - 1)];
      const px01 = blurred[(y - 1) * w + x];
      const px02 = blurred[(y - 1) * w + (x + 1)];
      
      const px10 = blurred[y * w + (x - 1)];
      const px12 = blurred[y * w + (x + 1)];
      
      const px20 = blurred[(y + 1) * w + (x - 1)];
      const px21 = blurred[(y + 1) * w + x];
      const px22 = blurred[(y + 1) * w + (x + 1)];

      const gx = -px00 + px02 - 2 * px10 + 2 * px12 - px20 + px22;
      const gy = -px00 - 2 * px01 - px02 + px20 + 2 * px21 + px22;

      gxData[idx] = gx;
      gyData[idx] = gy;
      magData[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // 4. Non-Maximum Suppression (NMS) pass to thin edges down to 1-pixel width
  const sobelData = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const mag = magData[idx];
      if (mag === 0) continue;

      const gx = gxData[idx];
      const gy = gyData[idx];

      const angle = Math.atan2(gy, gx) * (180 / Math.PI);
      
      let mag1 = 0;
      let mag2 = 0;

      // Group angles into 4 sectors (0, 45, 90, 135 degrees)
      if ((angle >= -22.5 && angle < 22.5) || (angle >= 157.5) || (angle < -157.5)) {
        mag1 = magData[idx - 1];
        mag2 = magData[idx + 1];
      } else if ((angle >= 22.5 && angle < 67.5) || (angle >= -157.5 && angle < -112.5)) {
        mag1 = magData[(y - 1) * w + (x + 1)];
        mag2 = magData[(y + 1) * w + (x - 1)];
      } else if ((angle >= 67.5 && angle < 112.5) || (angle >= -112.5 && angle < -67.5)) {
        mag1 = magData[(y - 1) * w + x];
        mag2 = magData[(y + 1) * w + x];
      } else {
        mag1 = magData[(y - 1) * w + (x - 1)];
        mag2 = magData[(y + 1) * w + (x + 1)];
      }

      if (mag >= mag1 && mag >= mag2) {
        sobelData[idx] = Math.min(255, mag);
      } else {
        sobelData[idx] = 0;
      }
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

  // 5. Hysteresis Thresholding (Connects weak edge pixels to strong ones, avoiding dashed lines)
  const lowThresh = threshold * 0.4;
  const highThresh = threshold;
  const binaryPixels = new Uint8Array(w * h);
  const visitedEdge = new Uint8Array(w * h);
  const stack = [];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (sobelData[idx] >= highThresh && !visitedEdge[idx]) {
        stack.push(idx);
        visitedEdge[idx] = 1;

        while (stack.length > 0) {
          const currIdx = stack.pop();
          binaryPixels[currIdx] = 255;

          const cx = currIdx % w;
          const cy = Math.floor(currIdx / w);

          // Trace connected 8-neighbors above the low threshold
          for (let ny = cy - 1; ny <= cy + 1; ny++) {
            for (let nx = cx - 1; nx <= cx + 1; nx++) {
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                const nidx = ny * w + nx;
                if (!visitedEdge[nidx] && sobelData[nidx] >= lowThresh) {
                  visitedEdge[nidx] = 1;
                  stack.push(nidx);
                }
              }
            }
          }
        }
      }
    }
  }

  // Create preview image using the clean binary edge map
  const previewData = ctx.createImageData(w, h);
  const previewPixels = previewData.data;

  for (let i = 0; i < w * h; i++) {
    const isEdge = binaryPixels[i] === 255;

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

  // 6. Contour Tracing
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
