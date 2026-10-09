export function minorAmount(value: string) {
  const [integer = '0', fraction = ''] = value.split('.')
  return BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0'))
}

export function decimalAmount(minor: bigint) {
  return `${minor / 100n}.${(minor % 100n).toString().padStart(2, '0')}`
}
