/**
 * Firebase initialization.
 *
 * Mirrors shieldgo-admin-web/src/firebaseInit.js behavior, but with
 * configuration sourced entirely from environment variables (no hard-coded
 * credentials in source). HML vs PRD is driven by NEXT_PUBLIC_IS_PRODUCTION
 * - but the actual config values come from .env.local / .env.production.
 *
 * Safe on the server: only initializes inside the browser.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { env, isFirebaseConfigured } from '@/config/env';

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (!isFirebaseConfigured()) return null;

  if (_app) return _app;
  const existing = getApps();
  if (existing.length > 0) {
    _app = existing[0]!;
    return _app;
  }

  _app = initializeApp({
    apiKey: env.firebase.apiKey,
    authDomain: env.firebase.authDomain,
    projectId: env.firebase.projectId,
    storageBucket: env.firebase.storageBucket,
    messagingSenderId: env.firebase.messagingSenderId,
    appId: env.firebase.appId,
    measurementId: env.firebase.measurementId,
  });

  return _app;
}

export function getDb(): Firestore | null {
  if (typeof window === 'undefined') return null;
  if (_db) return _db;
  const app = getFirebaseApp();
  if (!app) return null;
  _db = getFirestore(app);
  return _db;
}
