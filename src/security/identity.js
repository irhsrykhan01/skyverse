export function normalizePhoneNumber(value) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits || null;
}

export function createIdentity({ config }) {
  const ownerNumber = normalizePhoneNumber(config.ownerNumber);

  function isOwner(jidOrNumber) {
    if (!ownerNumber || !jidOrNumber) return false;
    const number = normalizePhoneNumber(String(jidOrNumber).split('@')[0]);
    return number === ownerNumber;
  }

  return Object.freeze({
    ownerNumber,
    isOwner,
  });
}
