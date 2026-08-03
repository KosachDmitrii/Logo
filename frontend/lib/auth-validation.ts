import { t, type AppLocale } from "./i18n";

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
  fieldLabel: string,
  locale: AppLocale = "en",
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return t(locale, "val.required", { field: fieldLabel });
  if (trimmed.length < 2) return t(locale, "val.min2", { field: fieldLabel });
  if (trimmed.length > 80) return t(locale, "val.tooLong", { field: fieldLabel });
  if (!NAME_RE.test(trimmed)) {
    return t(locale, "val.nameChars", { field: fieldLabel });
  }
  return null;
}

export function validateEmail(
  value: string,
  locale: AppLocale = "en",
): string | null {
  const email = value.trim();
  if (!email) return t(locale, "val.emailRequired");
  if (email.length > 254) return t(locale, "val.emailLong");
  if (!EMAIL_RE.test(email)) return t(locale, "val.emailInvalid");
  return null;
}

export function validatePassword(
  value: string,
  options: {
    required?: boolean;
    minLength?: number;
    create?: boolean;
    locale?: AppLocale;
  } = {},
): string | null {
  const {
    required = true,
    minLength = AUTH_PASSWORD_MIN,
    create = false,
    locale = "en",
  } = options;
  if (!value) return required ? t(locale, "val.passwordRequired") : null;
  if (value.length < minLength) {
    return t(locale, "val.passwordMin", { n: minLength });
  }
  if (create) {
    if (!/[A-Za-z]/.test(value)) return t(locale, "val.passwordLetter");
    if (!/\d/.test(value)) return t(locale, "val.passwordNumber");
  }
  if (value.length > 128) return t(locale, "val.passwordLong");
  return null;
}

export function validatePasswordConfirm(
  password: string,
  confirm: string,
  locale: AppLocale = "en",
): string | null {
  if (!confirm) return t(locale, "val.passwordConfirm");
  if (confirm !== password) return t(locale, "val.passwordMatch");
  return null;
}

export function validateAuthField(
  field: AuthFieldKey,
  values: AuthFormValues,
  mode: AuthFormMode,
  locale: AppLocale = "en",
): string | null {
  switch (field) {
    case "firstName":
      return mode === "signup"
        ? validateName(values.firstName, t(locale, "field.firstName"), locale)
        : null;
    case "lastName":
      return mode === "signup"
        ? validateName(values.lastName, t(locale, "field.lastName"), locale)
        : null;
    case "email":
      if (mode === "reset") return null;
      return validateEmail(values.email, locale);
    case "password":
      if (mode === "forgot" || mode === "confirm") return null;
      return validatePassword(values.password, {
        create: mode === "signup" || mode === "reset",
        minLength: mode === "signin" ? 1 : AUTH_PASSWORD_MIN,
        locale,
      });
    case "passwordConfirm":
      if (mode !== "signup" && mode !== "reset") return null;
      return validatePasswordConfirm(
        values.password,
        values.passwordConfirm,
        locale,
      );
    default:
      return null;
  }
}

export function validateAuthForm(
  mode: AuthFormMode,
  values: AuthFormValues,
  locale: AppLocale = "en",
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
    const message = validateAuthField(field, values, mode, locale);
    if (message) errors[field] = message;
  }
  return errors;
}

export function hasAuthErrors(errors: AuthFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
