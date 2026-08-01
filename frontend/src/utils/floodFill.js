function hexToRgba(hex) {
  let c;
  if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
      c= hex.substring(1).split('');
      if(c.length== 3){
          c= [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      c= '0x'+c.join('');
      return [(c>>16)&255, (c>>8)&255, c&255, 255];
  }
  return [0,0,0,255];
}

export function floodFill(ctx, startX, startY, fillColorHex) {
  const canvas = ctx.canvas;
  const cw = canvas.width;
  const ch = canvas.height;
  startX = Math.floor(startX);
  startY = Math.floor(startY);
  
  const imgData = ctx.getImageData(0, 0, cw, ch);
  const data = imgData.data;
  const fillRgba = hexToRgba(fillColorHex);
  
  const startPos = (startY * cw + startX) * 4;
  const startR = data[startPos];
  const startG = data[startPos+1];
  const startB = data[startPos+2];
  const startA = data[startPos+3];

  if (startR === fillRgba[0] && startG === fillRgba[1] && startB === fillRgba[2] && startA === fillRgba[3]) {
    return; // Already the same color
  }

  const matchStartColor = (pos) => {
    return data[pos] === startR && data[pos+1] === startG && data[pos+2] === startB && data[pos+3] === startA;
  };

  const colorPixel = (pos) => {
    data[pos] = fillRgba[0];
    data[pos+1] = fillRgba[1];
    data[pos+2] = fillRgba[2];
    data[pos+3] = fillRgba[3];
  };

  const pixelStack = [[startX, startY]];
  
  while (pixelStack.length) {
    const newPos = pixelStack.pop();
    let x = newPos[0];
    let y = newPos[1];
    let pos = (y * cw + x) * 4;

    while (y >= 0 && matchStartColor(pos)) {
      y--;
      pos -= cw * 4;
    }
    pos += cw * 4;
    y++;

    let reachLeft = false;
    let reachRight = false;

    while (y < ch && matchStartColor(pos)) {
      colorPixel(pos);

      if (x > 0) {
        if (matchStartColor(pos - 4)) {
          if (!reachLeft) {
            pixelStack.push([x - 1, y]);
            reachLeft = true;
          }
        } else if (reachLeft) {
          reachLeft = false;
        }
      }

      if (x < cw - 1) {
        if (matchStartColor(pos + 4)) {
          if (!reachRight) {
            pixelStack.push([x + 1, y]);
            reachRight = true;
          }
        } else if (reachRight) {
          reachRight = false;
        }
      }

      y++;
      pos += cw * 4;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}
