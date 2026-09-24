function stripJidDevice(value) {
  return String(value ?? '').trim().split('@')[0].split(':')[0];
}

export function normalizePhoneNumber(value) {
  if (!value) return null;
  const digits = stripJidDevice(value).replace(/\D/g, '');
  return digits || null;
}

export function createIdentity({ config }) {
  const ownerNumber = normalizePhoneNumber(config.ownerNumber);

  function isOwner(jidOrNumber) {
    if (!ownerNumber || !jidOrNumber) return false;
    return normalizePhoneNumber(jidOrNumber) === ownerNumber;
  }

  return Object.freeze({
    ownerNumber,
    isOwner,
  });
}
