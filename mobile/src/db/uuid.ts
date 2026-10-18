// UUID v7 (RFC 9562): 48 bits de timestamp em ms + 74 bits aleatórios. Gerado no app para todas as
// tabelas sincronizáveis. Monotônico: dentro do mesmo ms (ou se o relógio voltar) os 12 bits de
// rand_a viram contador, então os ids saem em ordem de criação.

let lastMs = 0;
let counter = 0;

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    // Hermes sem crypto: ids só precisam ser únicos, não secretos.
    for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

const hex = (n: number, width: number) => n.toString(16).padStart(width, '0');

export function uuidv7(now: number = Date.now()): string {
  const rand = randomBytes(10);
  if (now > lastMs) {
    lastMs = now;
    // Começa na metade de baixo do contador para sobrar espaço no mesmo ms.
    counter = ((rand[0] << 8) | rand[1]) & 0x7ff;
  } else {
    counter++;
    if (counter > 0xfff) {
      lastMs++;
      counter = 0;
    }
  }

  const ms = lastMs;
  const timeHigh = Math.floor(ms / 0x10000); // 32 bits de cima
  const timeLow = ms % 0x10000; // 16 bits de baixo
  const variant = 0x80 | (rand[2] & 0x3f);

  return [
    hex(timeHigh, 8),
    hex(timeLow, 4),
    hex(0x7000 | counter, 4),
    hex(variant, 2) + hex(rand[3], 2),
    Array.from(rand.subarray(4, 10), (b) => hex(b, 2)).join(''),
  ].join('-');
}
