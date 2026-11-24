/**
 * Lightweight, zero-dependency QR Code SVG generator (Byte mode, ECC Level M, Versions 1-10).
 * Implements standard ISO/IEC 18004 finder, timing, alignment, format/version info,
 * GF(256) Reed-Solomon error correction, and mask penalty evaluation.
 */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const res = new Uint8Array(data.length + ecLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

// Level M specifications for Versions 1..10: [totalCodewords, ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data]
const VERSION_M = [
  null,
  [26, 10, 1, 16, 0, 0],
  [44, 16, 1, 28, 0, 0],
  [70, 26, 1, 44, 0, 0],
  [100, 18, 2, 32, 0, 0],
  [134, 24, 2, 43, 0, 0],
  [172, 16, 4, 27, 0, 0],
  [196, 18, 4, 31, 0, 0],
  [242, 22, 2, 38, 2, 39],
  [292, 22, 3, 36, 2, 37],
  [346, 26, 4, 43, 1, 44],
];

const ALIGNMENT_CENTERS = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

function chooseVersion(byteLen) {
  for (let v = 1; v <= 10; v++) {
    const [, , b1, d1, b2, d2] = VERSION_M[v];
    const capacityBytes = b1 * d1 + b2 * d2;
    const headerBits = 4 + (v >= 10 ? 16 : 8);
    const totalBitsNeeded = headerBits + byteLen * 8;
    if (Math.ceil(totalBitsNeeded / 8) <= capacityBytes) return v;
  }
  throw new Error("QR payload too long for versions 1-10");
}

function encodeDataCodewords(bytes, version) {
  const [, , b1, d1, b2, d2] = VERSION_M[version];
  const dataCapacity = b1 * d1 + b2 * d2;
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };

  // Mode: Byte (0100)
  pushBits(0b0100, 4);
  pushBits(bytes.length, version >= 10 ? 16 : 8);
  for (const b of bytes) pushBits(b, 8);

  const maxBits = dataCapacity * 8;
  const terminator = Math.min(4, maxBits - bits.length);
  pushBits(0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (codewords.length < dataCapacity) {
    codewords.push(padBytes[padIdx % 2]);
    padIdx++;
  }
  return codewords;
}

function buildFinalBytes(dataCodewords, version) {
  const [, ecPerBlock, b1, d1, b2, d2] = VERSION_M[version];
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (let i = 0; i < b1; i++) {
    const block = dataCodewords.slice(offset, offset + d1);
    offset += d1;
    dataBlocks.push(block);
    ecBlocks.push(Array.from(rsRemainder(block, ecPerBlock)));
  }
  for (let i = 0; i < b2; i++) {
    const block = dataCodewords.slice(offset, offset + d2);
    offset += d2;
    dataBlocks.push(block);
    ecBlocks.push(Array.from(rsRemainder(block, ecPerBlock)));
  }

  const result = [];
  const maxDataLen = Math.max(d1, d2);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) {
      result.push(block[i]);
    }
  }
  return result;
}

function makeMatrix(version) {
  const size = version * 4 + 17;
  const grid = Array.from({ length: size }, () => new Int8Array(size)); // 0/1 module
  const isFunc = Array.from({ length: size }, () => new Uint8Array(size)); // 1 if reserved

  const setFunc = (r, c, val) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      grid[r][c] = val ? 1 : 0;
      isFunc[r][c] = 1;
    }
  };

  const drawFinder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inBorder = dr === -1 || dr === 7 || dc === -1 || dc === 7;
        const dark =
          !inBorder &&
          (dr === 0 ||
            dr === 6 ||
            dc === 0 ||
            dc === 6 ||
            (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        setFunc(r, c, dark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const centers = ALIGNMENT_CENTERS[version];
  for (const r of centers) {
    for (const c of centers) {
      if (isFunc[r][c]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunc(r + dr, c + dc, dark);
        }
      }
    }
  }

  // Dark module + reserve format info
  setFunc(size - 8, 8, 1);
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      isFunc[8][i] = 1;
      isFunc[i][8] = 1;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunc[8][size - 1 - i] = 1;
    isFunc[size - 1 - i][8] = 1;
  }

  // Reserve version info for v >= 7
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vBits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = (vBits >>> i) & 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunc(a, b, bit);
      setFunc(b, a, bit);
    }
  }

  return { size, grid, isFunc };
}

function placeData(matrix, finalBytes) {
  const { size, grid, isFunc } = matrix;
  let bitIdx = 0;
  const totalBits = finalBytes.length * 8;
  let up = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = up ? size - 1 - step : step;
      for (let dx = 0; dx < 2; dx++) {
        const c = right - dx;
        if (!isFunc[r][c]) {
          let bit = 0;
          if (bitIdx < totalBits) {
            bit = (finalBytes[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
          }
          grid[r][c] = bit;
        }
      }
    }
    up = !up;
  }
}

function applyFormatAndMask(grid, isFunc, size, mask) {
  const copy = grid.map((row) => Int8Array.from(row));
  const maskFn = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ][mask];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunc[r][c] && maskFn(r, c)) copy[r][c] ^= 1;
    }
  }

  // Format bits for ECC Level M (00) + 3-bit mask
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const format = ((data << 10) | rem) ^ 0x5412;

  for (let i = 0; i <= 5; i++) copy[8][i] = (format >>> i) & 1;
  copy[8][7] = (format >>> 6) & 1;
  copy[8][8] = (format >>> 7) & 1;
  copy[7][8] = (format >>> 8) & 1;
  for (let i = 9; i < 15; i++) copy[14 - i][8] = (format >>> i) & 1;

  for (let i = 0; i < 8; i++) copy[8][size - 1 - i] = (format >>> i) & 1;
  for (let i = 8; i < 15; i++) copy[size - 15 + i][8] = (format >>> i) & 1;

  return copy;
}

function penaltyScore(grid, size) {
  let score = 0;
  // Rule 1: 5+ consecutive same color
  for (let r = 0; r < size; r++) {
    let runColor = grid[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (grid[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) score += 3 + (runLen - 5);
        runColor = grid[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5);
  }
  for (let c = 0; c < size; c++) {
    let runColor = grid[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (grid[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) score += 3 + (runLen - 5);
        runColor = grid[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5);
  }
  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = grid[r][c];
      if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) {
        score += 3;
      }
    }
  }
  return score;
}

export function generateQrMatrix(text) {
  const bytes = new TextEncoder().encode(text);
  const version = chooseVersion(bytes.length);
  const dataCodewords = encodeDataCodewords(bytes, version);
  const finalBytes = buildFinalBytes(dataCodewords, version);
  const matrix = makeMatrix(version);
  placeData(matrix, finalBytes);

  let bestGrid = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const masked = applyFormatAndMask(matrix.grid, matrix.isFunc, matrix.size, mask);
    const score = penaltyScore(masked, matrix.size);
    if (score < bestScore) {
      bestScore = score;
      bestGrid = masked;
    }
  }
  return { size: matrix.size, grid: bestGrid };
}

export function renderQrSvg(text, label = "UPI Payment QR Code") {
  const { size, grid } = generateQrMatrix(text);
  const quiet = 4;
  const total = size + quiet * 2;
  const paths = [];

  for (let r = 0; r < size; r++) {
    let runStart = -1;
    for (let c = 0; c <= size; c++) {
      const dark = c < size && grid[r][c] === 1;
      if (dark && runStart === -1) {
        runStart = c;
      } else if (!dark && runStart !== -1) {
        paths.push(`M${runStart + quiet},${r + quiet}h${c - runStart}v1h-${c - runStart}z`);
        runStart = -1;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="${label}" shape-rendering="crispEdges">
    <rect width="${total}" height="${total}" fill="#ffffff" rx="2"/>
    <path d="${paths.join("")}" fill="#0f172a"/>
  </svg>`;
}
