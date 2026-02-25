import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './firebase';
import type { AuthUser } from '../types/auth';

const googleProvider = new GoogleAuthProvider();
const LOCAL_AUTH_KEY = 'kaientai_local_auth';
const PASSWORD_LOGIN_VALUE = 'ogura';

const localUser: AuthUser = {
  uid: 'local-ogura-user',
  displayName: 'Local User',
  email: null,
  provider: 'password',
};

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    provider: 'google',
  };
}

function hasLocalAuthSession(): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem(LOCAL_AUTH_KEY) === '1';
}

export async function signInWithGoogle(): Promise<AuthUser> {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LOCAL_AUTH_KEY);
  }
  const result = await signInWithPopup(auth, googleProvider);
  return toAuthUser(result.user);
}

export async function signInWithPassword(password: string): Promise<AuthUser> {
  if (password !== PASSWORD_LOGIN_VALUE) {
    throw new Error('INVALID_PASSWORD');
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_AUTH_KEY, '1');
  }
  return localUser;
}

export async function signOut(): Promise<void> {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LOCAL_AUTH_KEY);
  }
  if (auth.currentUser) {
    await firebaseSignOut(auth);
  }
}

export function onAuthChange(callback: (user: AuthUser | null) => void) {
  return onAuthStateChanged(auth, (firebaseUser) => {
    if (hasLocalAuthSession()) {
      callback(localUser);
      return;
    }
    callback(firebaseUser ? toAuthUser(firebaseUser) : null);
  });
}
