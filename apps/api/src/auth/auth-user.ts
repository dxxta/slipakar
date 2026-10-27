export type AuthUser = {
  id: string;
  email: string;
  role: string;
  disabledAt?: Date | null;
  disabledReason?: string | null;
};

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}
