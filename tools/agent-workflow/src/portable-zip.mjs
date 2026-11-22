// @ts-check
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { crc32, createInflateRaw } from 'node:zlib';

export const MAX_ARTIFACT = 1_000_000_000;

/** @param {import('node:fs/promises').FileHandle} handle @param {number} position @param {number} length */
async function readAt(handle, position, length) {
  const buffer = Buffer.alloc(length);
  for (let offset = 0; offset < length;) {
    const { bytesRead } = await handle.read(buffer, offset, length - offset, position + offset);
    if (!bytesRead) throw new Error('Truncated ZIP record.');
    offset += bytesRead;
  }
  return buffer;
}

/** @param {number} attributes */
function regularFileAttributes(attributes) {
  // Compress-Archive can set Unix file permissions or ordinary DOS file attributes.
  const unixType = (attributes >>> 16) & 0o170000;
  const dosAttributes = attributes & 0xffff;
  return (unixType === 0 || unixType === 0o100000) && (dosAttributes & ~(1 | 32 | 128)) === 0;
}

/** Verify the two root entries, their ZIP32 records and their uncompressed SHA-256 digests.
 * @param {string} path
 * @param {Record<string, string>} expected
 * @param {{allowFileAttributes?: boolean}} [options] The Windows handoff requires zero external attributes.
 */
export async function exactArchive(path, expected, { allowFileAttributes = false } = {}) {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const tailLength = Math.min(size, 22 + 65535);
    const tail = await readAt(handle, size - tailLength, tailLength);
    let end = tail.length - 22;
    while (end >= 0 && !(tail.readUInt32LE(end) === 0x06054b50 && end + 22 + tail.readUInt16LE(end + 20) === tail.length)) end--;
    if (end < 0 || tail.readUInt16LE(end + 4) || tail.readUInt16LE(end + 6)) throw new Error('Invalid ZIP directory.');
    if (tail.readUInt16LE(end + 8) !== 2 || tail.readUInt16LE(end + 10) !== 2 || Object.keys(expected).length !== 2)
      throw new Error('Expected exactly two ZIP entries.');
    const length = tail.readUInt32LE(end + 12), start = tail.readUInt32LE(end + 16);
    if (length > 65536 || start + length !== size - tailLength + end) throw new Error('Invalid ZIP directory bounds.');
    const central = await readAt(handle, start, length);
    let cursor = 0;
    const found = new Set();
    /** @type {[number, number][]} */
    const spans = [];
    for (let index = 0; index < 2; index++) {
      if (cursor + 46 > length || central.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP entry.');
      const flags = central.readUInt16LE(cursor + 8), method = central.readUInt16LE(cursor + 10);
      const crc = central.readUInt32LE(cursor + 16), compressed = central.readUInt32LE(cursor + 20), plain = central.readUInt32LE(cursor + 24);
      const nameLength = central.readUInt16LE(cursor + 28), extra = central.readUInt16LE(cursor + 30), comment = central.readUInt16LE(cursor + 32);
      const attributes = central.readUInt32LE(cursor + 38), localOffset = central.readUInt32LE(cursor + 42);
      if (cursor + 46 + nameLength > length || flags & ~0x808 || ![0, 8].includes(method) ||
          !compressed || compressed > MAX_ARTIFACT || !plain || plain > MAX_ARTIFACT || extra || comment ||
          central.readUInt16LE(cursor + 34) || (attributes && !(allowFileAttributes && regularFileAttributes(attributes))))
        throw new Error('Unsupported ZIP entry.');
      const nameBytes = central.subarray(cursor + 46, cursor + 46 + nameLength);
      const name = nameBytes.toString('utf8');
      if (!Object.hasOwn(expected, name) || found.has(name) || basename(name) !== name || name.includes('\\'))
        throw new Error('Unexpected or duplicate ZIP entry.');
      found.add(name);
      cursor += 46 + nameLength;

      const local = await readAt(handle, localOffset, 30);
      const localName = await readAt(handle, localOffset + 30, nameLength);
      if (local.readUInt32LE(0) !== 0x04034b50 || local.readUInt16LE(6) !== flags || local.readUInt16LE(8) !== method ||
          local.readUInt16LE(26) !== nameLength || local.readUInt16LE(28) || !localName.equals(nameBytes))
        throw new Error(`ZIP local header disagrees for ${name}.`);
      if (!(flags & 8) && (local.readUInt32LE(14) !== crc || local.readUInt32LE(18) !== compressed || local.readUInt32LE(22) !== plain))
        throw new Error(`ZIP local header disagrees for ${name}.`);
      const dataStart = localOffset + 30 + nameLength, dataEnd = dataStart + compressed;
      if (dataEnd > start) throw new Error('ZIP entry overlaps directory.');
      let entryEnd = dataEnd;
      if (flags & 8) {
        // A ZIP32 data descriptor can have an optional four-byte signature.
        const descriptor = await readAt(handle, dataEnd, 16);
        /** @param {number} offset */
        const matches = offset => descriptor.readUInt32LE(offset) === crc && descriptor.readUInt32LE(offset + 4) === compressed &&
          descriptor.readUInt32LE(offset + 8) === plain;
        if (descriptor.readUInt32LE(0) === 0x08074b50 && matches(4)) entryEnd += 16;
        else if (matches(0)) entryEnd += 12;
        else throw new Error(`ZIP data descriptor disagrees for ${name}.`);
      }
      spans.push([localOffset, entryEnd]);

      const source = handle.createReadStream({ start: dataStart, end: dataEnd - 1, autoClose: false });
      const inflate = method === 8 ? createInflateRaw() : undefined;
      const hash = createHash('sha256');
      let actualCrc = 0, count = 0;
      /** @param {AsyncIterable<Buffer>} decoded */
      async function hashBytes(decoded) {
        for await (const bytes of decoded) {
          count += bytes.length;
          if (count > plain) throw new Error('ZIP entry grew beyond declared length.');
          hash.update(bytes);
          actualCrc = crc32(bytes, actualCrc);
        }
      }
      if (inflate) await pipeline(source, inflate, hashBytes);
      else await pipeline(source, hashBytes);
      if (count !== plain || (inflate && inflate.bytesWritten !== compressed) || actualCrc !== crc)
        throw new Error(`ZIP length or CRC disagrees for ${name}.`);
      if (hash.digest('hex') !== expected[name]) throw new Error(`ZIP bytes differ for ${name}.`);
    }
    spans.sort((a, b) => a[0] - b[0]);
    if (cursor !== length || spans[0]?.[0] !== 0 || spans[1]?.[0] !== spans[0][1] || spans[1]?.[1] !== start)
      throw new Error('ZIP directory has extra content.');
  } finally {
    await handle.close();
  }
}
