// Firebase Authentication service — wraps Firebase Web SDK methods
// Used by the auth store and UI components
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';

// ── Email / Password ──────────────────────────────────────────────────────────

/**
 * Register a new user with email and password.
 * Also sets the Firebase displayName so /api/auth/me has a name to sync.
 */
export async function registerWithEmail(name, email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  // Persist the display name in Firebase immediately
  await updateProfile(credential.user, { displayName: name });
  return credential.user;
}

/**
 * Sign in an existing user with email and password.
 */
export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

// ── Social Providers ──────────────────────────────────────────────────────────

/**
 * Sign in / register with Google (popup).
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

/**
 * Sign in / register with GitHub (popup).
 */
export async function loginWithGitHub() {
  const provider = new GithubAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

// ── Session ───────────────────────────────────────────────────────────────────

/**
 * Sign out the current Firebase user.
 */
export async function logout() {
  await signOut(auth);
}

/**
 * Get the currently signed-in Firebase user (or null).
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Get a fresh Firebase ID token for the current user.
 * Pass forceRefresh=true to always get a new token.
 */
export async function getIdToken(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  return user.getIdToken(forceRefresh);
}

// ── Password Reset ────────────────────────────────────────────────────────────

/**
 * Send a password-reset email via Firebase.
 */
export async function sendResetEmail(email) {
  await sendPasswordResetEmail(auth, email);
}

// ── Human-readable error messages ─────────────────────────────────────────────

/**
 * Convert a Firebase Auth error code into a user-friendly message.
 */
export function getFirebaseErrorMessage(error) {
  const code = error?.code || '';
  const messages = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
    'auth/cancelled-popup-request': 'Sign-in popup was cancelled.',
    'auth/popup-blocked': 'Popup was blocked by your browser. Please allow popups and try again.',
    'auth/account-exists-with-different-credential':
      'An account already exists with the same email but a different sign-in method.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/requires-recent-login': 'Please sign in again to complete this action.',
  };
  return messages[code] || error?.message || 'An authentication error occurred.';
}
