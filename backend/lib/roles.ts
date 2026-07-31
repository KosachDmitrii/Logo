export type StudioRole = "admin" | "user";

export function roleFromAppMetadata(
  appMetadata: Record<string, unknown> | null | undefined,
): StudioRole {
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
