// Signup / activation contracts - mirrors ms-user's crt-signup.js shapes.

export interface SignupCompanyPayload {
  name: string;
  fantasyName?: string;
  socialName?: string;
  document: string;
  email: string;
  primaryPhone: string;
  timezone?: string;
}

export interface SignupUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  primaryPhone?: string;
  language?: string;
}

export interface SignupRequest {
  company: SignupCompanyPayload;
  user: SignupUserPayload;
}

export interface SignupSuccess {
  accountId: string;
  email: string;
  emailVerified: false;
  expiresAt: string;
}

export interface ActivationConfirmRequest {
  email: string;
  /**
   * Link-based activation carries a long base64url `token`. The backend
   * upper-cases the legacy `code` field for the 6-char-code flow, which would
   * corrupt a base64url token - so always send `token` (not `code`) for the
   * email-link path.
   */
  token?: string;
  code?: string;
}

export interface ActivationConfirmSuccess {
  email: string;
  emailVerified: true;
}

/**
 * Backend error codes that the signup/activation flow may return (on `.code`).
 * Keep in sync with ms-user/controllers/crt-signup.js + crt-user.js login handler.
 */
export type SignupErrorCode =
  | 'EMAIL_ALREADY_EXISTS'
  | 'COMPANY_CREATE_FAILED'
  | 'COMPANY_USER_CREATE_FAILED'
  | 'USER_CREATE_FAILED'
  | 'USER_NOT_FOUND'
  | 'ACTIVATION_CODE_MISSING'
  | 'ACTIVATION_CODE_EXPIRED'
  | 'ACTIVATION_CODE_INVALID'
  | 'EMAIL_NOT_VERIFIED';
