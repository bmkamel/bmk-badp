// Pure preflight calculation; durable atomic reservations required before paid use.
export function canReserve({spent, reserved, estimate, limit = 1000}) {
  const values = [spent, reserved, estimate, limit];
  if (!values.every(v => Number.isSafeInteger(v) && v >= 0) || limit > 1000) return false;
  return spent <= limit && reserved <= limit - spent && estimate <= limit - spent - reserved;
}
