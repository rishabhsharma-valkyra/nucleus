'use client';
// Patient data must not outlive the sign-in on a shared hospital computer.
// The assistant's chat history (which quotes patient details) is kept in
// localStorage per user; it is wiped on sign-out, and any other account's
// history is wiped when someone else signs in on the same browser.
import { signOut } from 'next-auth/react';

export const CHAT_THREADS_PREFIX = 'valkyra-chat-threads:';

function removeKeys(match: (key: string) => boolean) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && match(k)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // storage unavailable (private mode): nothing stored to clear
  }
}

export function clearPatientDataFromBrowser() {
  removeKeys((k) => k.startsWith(CHAT_THREADS_PREFIX));
  try { sessionStorage.clear(); } catch { /* unavailable */ }
}

// Chat history of every account other than the one signed in now
export function clearOtherUsersChatHistory(currentEmail: string) {
  removeKeys((k) => k.startsWith(CHAT_THREADS_PREFIX) && k !== `${CHAT_THREADS_PREFIX}${currentEmail}`);
}

export function signOutAndClear(callbackUrl = '/auth/signin') {
  clearPatientDataFromBrowser();
  return signOut({ callbackUrl });
}
