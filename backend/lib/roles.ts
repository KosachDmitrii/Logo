/** Product roles for Loopen studio access. */
export type StudioRole = "guest" | "user" | "admin";

export function roleFromAppMetadata(
  appMetadata: Record<string, unknown> | null | undefined,
): Exclude<StudioRole, "guest"> {
  const role = appMetadata?.role;
  if (role === "admin") return "admin";
  if (Array.isArray(appMetadata?.roles) && appMetadata.roles.includes("admin")) {
    return "admin";
  }
  return "user";
}

export function isAdminRole(role: StudioRole | null | undefined): boolean {
  return role === "admin";
}

export function isGuestRole(role: StudioRole | null | undefined): boolean {
  return !role || role === "guest";
}

export function isAuthenticatedRole(
  role: StudioRole | null | undefined,
): boolean {
  return role === "user" || role === "admin";
}
