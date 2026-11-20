import { nativeImage, type NativeImage } from 'electron';

export function createTrayImages(icon: NativeImage): { idle: NativeImage; working: NativeImage } {
  const idle = icon.resize({ width: 24, height: 24, quality: 'best' });
  const pixels = Buffer.from(idle.toBitmap());
  for (let y = 14; y < 24; y++) for (let x = 14; x < 24; x++) {
    const distance = (x - 19) ** 2 + (y - 19) ** 2;
    if (distance <= 25) pixels.set(distance <= 9 ? [237, 185, 154, 255] : [245, 243, 242, 255], (y * 24 + x) * 4);
  }
  return { idle, working: nativeImage.createFromBitmap(pixels, { width: 24, height: 24 }) };
}
