export const PermissionLevel = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
  OWNER: 'owner',
});

export function getPermissionLevel({ isOwner = false, isGroupAdmin = false } = {}) {
  if (isOwner) return PermissionLevel.OWNER;
  if (isGroupAdmin) return PermissionLevel.ADMIN;
  return PermissionLevel.USER;
}
