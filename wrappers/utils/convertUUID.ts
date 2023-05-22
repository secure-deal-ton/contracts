export function convertUUID(uuid: string): bigint {
    return BigInt(`0x${uuid.replace(/-/g, '')}`);
}

export function parseUUID(number: bigint): string {
    const hex = number.toString(16).padStart(32, '0');
    return [0, 8, 12, 16, 20].map((p, i, a) => hex.substring(p, a[i + 1])).join('-');
}
