import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerWithEmail } from '../services/authService';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification
} from 'firebase/auth';

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  GithubAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: vi.fn().mockResolvedValue(),
  updateProfile: vi.fn().mockResolvedValue()
}));

vi.mock('../firebase', () => ({
  auth: { currentUser: null }
}));

describe('authService.registerWithEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('calls sendEmailVerification and stores { uid, name } in sessionStorage without calling PUT /auth/me', async () => {
    const mockUser = {
      uid: 'u-123',
      email: 'test@example.com',
      getIdToken: vi.fn().mockResolvedValue('token-123')
    };
    createUserWithEmailAndPassword.mockResolvedValueOnce({ user: mockUser });

    const user = await registerWithEmail('Alice Smith', 'test@example.com', 'password123');

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'test@example.com', 'password123');
    expect(updateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'Alice Smith' });
    expect(sendEmailVerification).toHaveBeenCalledWith(mockUser);
    expect(JSON.parse(sessionStorage.getItem('pendingUserName'))).toEqual({ uid: 'u-123', name: 'Alice Smith' });
    expect(localStorage.getItem('pendingUserName')).toBeNull();
    expect(user).toBe(mockUser);
  });

  it('handles sendEmailVerification failure gracefully, stores pendingUserName and returns user', async () => {
    const mockUser = {
      uid: 'u-456',
      email: 'bob@example.com',
      getIdToken: vi.fn().mockResolvedValue('token-456')
    };
    createUserWithEmailAndPassword.mockResolvedValueOnce({ user: mockUser });
    sendEmailVerification.mockRejectedValueOnce(new Error('Network failure'));

    const user = await registerWithEmail('Bob Jones', 'bob@example.com', 'password456');

    expect(user).toBe(mockUser);
    expect(JSON.parse(sessionStorage.getItem('pendingUserName'))).toEqual({ uid: 'u-456', name: 'Bob Jones' });
  });
});
