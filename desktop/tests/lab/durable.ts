import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import type { BigIntStats } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';

/** Bounded metadata only: neither source images nor requests or responses enter this snapshot. */
export class DurableFile {
  private expected: Buffer = Buffer.alloc(0);
  private constructor(private readonly path: string, readonly file: FileHandle, private readonly maxBytes: number,
    private readonly identity: { dev: bigint; ino: bigint }) {}

  private static regular(stat: BigIntStats, maxBytes: number): boolean {
    return stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1n && stat.size <= BigInt(maxBytes);
  }
  static async openExisting(path: string, maxBytes: number): Promise<DurableFile> {
    const entry = await fs.lstat(path, { bigint: true });
    if (!DurableFile.regular(entry, maxBytes)) throw new Error('Invalid durable file.');
    // No O_CREAT or O_TRUNC: even deletion between lstat and open cannot initialize a file.
    const file = await fs.open(path, constants.O_RDWR | constants.O_APPEND);
    try {
      const durable = new DurableFile(path, file, maxBytes, { dev: entry.dev, ino: entry.ino });
      durable.expected = await durable.readCurrent();
      return durable;
    } catch (error) { await file.close().catch(() => {}); throw error; }
  }
  private async stat(): Promise<BigIntStats> {
    const [entry, opened] = await Promise.all([fs.lstat(this.path, { bigint: true }), this.file.stat({ bigint: true })]);
    if (!DurableFile.regular(entry, this.maxBytes) || !DurableFile.regular(opened, this.maxBytes) ||
        entry.dev !== this.identity.dev || entry.ino !== this.identity.ino ||
        opened.dev !== this.identity.dev || opened.ino !== this.identity.ino || entry.size !== opened.size)
      throw new Error('Invalid durable file.');
    return opened;
  }
  private async readCurrent(): Promise<Buffer> {
    const before = await this.stat();
    const bytes = Buffer.alloc(Number(before.size));
    for (let offset = 0; offset < bytes.length;) {
      const read = await this.file.read(bytes, offset, bytes.length - offset, offset);
      if (read.bytesRead === 0) throw new Error('Invalid durable file.');
      offset += read.bytesRead;
    }
    const after = await this.stat();
    if (after.size !== before.size) throw new Error('Invalid durable file.');
    return bytes;
  }
  get snapshot(): Buffer { return Buffer.from(this.expected); }
  async verify(): Promise<void> {
    if (!(await this.readCurrent()).equals(this.expected)) throw new Error('Invalid durable file.');
  }
  async append(bytes: Buffer): Promise<void> {
    await this.verify();
    if (this.expected.length + bytes.length > this.maxBytes) throw new Error('Invalid durable file.');
    const next = Buffer.concat([this.expected, bytes]);
    await this.file.writeFile(bytes);
    await this.file.sync();
    if (!(await this.readCurrent()).equals(next)) throw new Error('Invalid durable file.');
    this.expected = next;
  }
  async close(): Promise<void> { await this.file.close(); }
}
