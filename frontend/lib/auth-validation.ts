export type AuthFieldKey =
  | "firstName"
  | "lastName"
  | "email"
  | "password"
  | "passwordConfirm";

export type AuthFieldErrors = Partial<Record<AuthFieldKey, string>>;

export type AuthFormMode =
  | "signin"
  | "signup"
  | "forgot"
  | "reset"
  | "confirm";

export type AuthFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[\p{L}](?:[\p{L}\s'’.-]{0,78}[\p{L}])?$/u;

export const AUTH_PASSWORD_MIN = 8;

export function validateName(
  value: string,
  label: "First name" | "Last name",
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  if (trimmed.length < 2) return `${label} needs at least 2 characters.`;
  if (trimmed.length > 80) return `${label} is too long.`;
  if (!NAME_RE.test(trimmed)) {
    return `${label} can only use letters, spaces, hyphens and apostrophes.`;
  }
  return null;
}

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Email is required.";
  if (email.length > 254) return "Email is too long.";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(
  value: string,
  options: { required?: boolean; minLength?: number; create?: boolean } = {},
): string | null {
  const {
    required = true,
    minLength = AUTH_PASSWORD_MIN,
    create = false,
  } = options;
  if (!value) return required ? "Password is required." : null;
  if (value.length < minLength) {
    return `Password must be at least ${minLength} characters.`;
  }
  if (create) {
    if (!/[A-Za-z]/.test(value)) {
      return "Password needs at least one letter.";
    }
    if (!/\d/.test(value)) {
      return "Password needs at least one number.";
    }
  }
  if (value.length > 128) return "Password is too long.";
  return null;
}

export function validatePasswordConfirm(
  password: string,
  confirm: string,
): string | null {
  if (!confirm) return "Confirm your password.";
  if (confirm !== password) return "Passwords do not match.";
  return null;
}

export function validateAuthField(
  field: AuthFieldKey,
  values: AuthFormValues,
  mode: AuthFormMode,
): string | null {
  switch (field) {
    case "firstName":
      return mode === "signup"
        ? validateName(values.firstName, "First name")
        : null;
    case "lastName":
      return mode === "signup"
        ? validateName(values.lastName, "Last name")
        : null;
    case "email":
      if (mode === "reset") return null;
      return validateEmail(values.email);
    case "password":
      if (mode === "forgot" || mode === "confirm") return null;
      return validatePassword(values.password, {
        create: mode === "signup" || mode === "reset",
        minLength: mode === "signin" ? 1 : AUTH_PASSWORD_MIN,
      });
    case "passwordConfirm":
      if (mode !== "signup" && mode !== "reset") return null;
      return validatePasswordConfirm(values.password, values.passwordConfirm);
    default:
      return null;
  }
}

export function validateAuthForm(
  mode: AuthFormMode,
  values: AuthFormValues,
): AuthFieldErrors {
  const fields: AuthFieldKey[] =
    mode === "signup"
      ? ["firstName", "lastName", "email", "password", "passwordConfirm"]
      : mode === "signin"
        ? ["email", "password"]
        : mode === "forgot" || mode === "confirm"
          ? ["email"]
          : mode === "reset"
            ? ["password", "passwordConfirm"]
            : [];

  const errors: AuthFieldErrors = {};
  for (const field of fields) {
    const message = validateAuthField(field, values, mode);
    if (message) errors[field] = message;
  }
  return errors;
}

export function hasAuthErrors(errors: AuthFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
