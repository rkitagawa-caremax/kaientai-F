export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  provider: 'google' | 'password';
}
