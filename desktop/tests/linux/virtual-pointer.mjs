import { once } from 'node:events';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const display = 1;
const registry = 2;
const discovery = 3;
const manager = 4;
const pointer = 5;
const interfaceName = 'zwlr_virtual_pointer_manager_v1';
const rightButton = 273;

function words(...values) {
  const bytes = Buffer.alloc(4 * values.length);
  values.forEach((value, index) => bytes.writeUInt32LE(value >>> 0, index * 4));
  return bytes;
}

function request(object, opcode, ...arguments_) {
  const size = 8 + arguments_.reduce((total, buffer) => total + buffer.length, 0);
  return Buffer.concat([words(object, (size << 16) | opcode), ...arguments_]);
}

async function findPointerManager(socket) {
  socket.write(Buffer.concat([request(display, 1, words(registry)), request(display, 0, words(discovery))]));
  let pending = Buffer.alloc(0);
  let name;
  for await (const chunk of socket.iterator({ destroyOnReturn: false })) {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= 8) {
      const id = pending.readUInt32LE(0);
      const opcode = pending.readUInt16LE(4);
      const size = pending.readUInt16LE(6);
      if (size < 8) throw new Error('Invalid Wayland event header');
      if (pending.length < size) break;
      const event = pending.subarray(0, size);
      pending = pending.subarray(size);
      if (id === display && opcode === 0) throw new Error('The compositor rejected the pointer fixture');
      if (id === registry && opcode === 0) {
        const nameLength = event.readUInt32LE(12);
        if (event.toString('utf8', 16, 16 + nameLength - 1) === interfaceName) name = event.readUInt32LE(8);
      }
      if (id === discovery && opcode === 0 && name !== undefined) return name;
    }
  }
  throw new Error('The compositor did not expose a virtual pointer');
}

export async function dragWaylandPointer(socketPath, start, end, output, confirmSize) {
  const socket = createConnection(socketPath);
  let socketError;
  socket.on('error', error => { socketError = error; });
  socket.setTimeout(5_000, () => socket.destroy(new Error('The virtual pointer fixture timed out')));
  try {
    await once(socket, 'connect');
    const name = await findPointerManager(socket);
    const interfaceLength = Buffer.byteLength(interfaceName) + 1;
    const encodedInterface = Buffer.alloc(Math.ceil(interfaceLength / 4) * 4);
    encodedInterface.write(interfaceName);
    socket.write(request(registry, 0, words(name, interfaceLength), encodedInterface, words(1, manager)));
    socket.write(request(manager, 0, words(0, pointer)));

    const send = (opcode, ...values) => {
      const milliseconds = Number(process.hrtime.bigint() / 1_000_000n) >>> 0;
      socket.write(Buffer.concat([request(pointer, opcode, words(milliseconds, ...values)), request(pointer, 4)]));
    };
    send(1, ...start, ...output);
    await delay(200);
    send(2, rightButton, 1);
    await delay(200);
    const steps = 10;
    const delta = end.map((value, index) => value - start[index]);
    for (let step = 1; step <= steps; step++) {
      // Relative motion uses Wayland's signed fixed-point coordinates.
      send(0, ...delta.map(value => 256 * (Math.trunc(value * step / steps) - Math.trunc(value * (step - 1) / steps))));
      await delay(50);
    }
    // Set the exact endpoint and wait for its configure before releasing the drag.
    send(1, ...end, ...output);
    await confirmSize?.();
    send(2, rightButton, 0);
    await delay(200);
    if (socketError) throw socketError;
  } finally {
    socket.destroy();
  }
}
