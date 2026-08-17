import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  getDatabase, ref, get, set, update, onValue, onDisconnect,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';
import { firebaseConfig } from './config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

function safeId(value) {
  return String(value || 'DEMO')
    .trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '-').slice(0, 40) || 'DEMO';
}

function sanitizeSponsors(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean).map((sponsor) => ({
    id: String(sponsor.id || `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    name: String(sponsor.name || ''),
    text: String(sponsor.text || ''),
    logo: String(sponsor.logo || ''),
    weight: Number(sponsor.weight) || 1
  })).filter((sponsor) => sponsor.name);
}

async function ensureAnonymousUser() {
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve, reject) => {
    let settled = false;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (settled) return;
      if (user) {
        settled = true;
        unsubscribe();
        resolve(user);
        return;
      }
      try {
        const credential = await signInAnonymously(auth);
        settled = true;
        unsubscribe();
        resolve(credential.user);
      } catch (error) {
        settled = true;
        unsubscribe();
        reject(error);
      }
    }, reject);
  });
}

export function createRealtime(matchCode, role) {
  const match = safeId(matchCode);
  const listeners = [];
  const statusListeners = [];
  const sessionRef = ref(db, `sessions/${match}`);
  const stateRef = ref(db, `sessions/${match}/state`);
  const sponsorsRef = ref(db, `sessions/${match}/sponsors`);
  const metaRef = ref(db, `sessions/${match}/metadata`);
  let currentState = {};
  let currentSponsors = [];
  let connected = false;
  let ready = false;
  let uid = '';
  let stateUnsubscribe = null;
  let sponsorUnsubscribe = null;
  let metaUnsubscribe = null;

  const emitStatus = (text, isConnected = connected) => {
    statusListeners.forEach((fn) => fn({ text, connected: isConnected }));
  };

  const combined = () => {
    const activeSponsor = currentState.activeSponsorId
      ? currentSponsors.find((item) => item.id === currentState.activeSponsorId) || null
      : (currentState.activeSponsor || null);
    return {
      ...currentState,
      sponsors: currentSponsors,
      activeSponsor
    };
  };

  const emit = () => {
    const data = combined();
    listeners.forEach((fn) => fn(data));
  };

  async function initialize() {
    emitStatus('Conectando con Firebase…', false);
    try {
      const user = await ensureAnonymousUser();
      uid = user.uid;
      const presenceRef = ref(db, `sessions/${match}/presence/${uid}`);
      await set(presenceRef, {
        role,
        online: true,
        connectedAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      });
      onDisconnect(presenceRef).set({
        role,
        online: false,
        lastSeen: serverTimestamp()
      });

      const snapshot = await get(sessionRef);
      if (!snapshot.exists() && role === 'camera') {
        await set(metaRef, {
          createdAt: serverTimestamp(),
          cameraUid: uid,
          status: 'ready',
          streamStatus: 'idle',
          version: 'V16.4 Firebase'
        });
      }

      stateUnsubscribe = onValue(stateRef, (snapshotState) => {
        currentState = snapshotState.val() || {};
        emit();
      }, (error) => emitStatus(`Error de datos: ${error.code || error.message}`, false));

      sponsorUnsubscribe = onValue(sponsorsRef, (snapshotSponsors) => {
        const value = snapshotSponsors.val();
        currentSponsors = Array.isArray(value)
          ? sanitizeSponsors(value)
          : sanitizeSponsors(value ? Object.values(value) : []);
        emit();
      }, (error) => emitStatus(`Error de patrocinadores: ${error.code || error.message}`, false));

      metaUnsubscribe = onValue(metaRef, (snapshotMeta) => {
        const metadata = snapshotMeta.val() || {};
        connected = true;
        if (role === 'camera') {
          emitStatus(metadata.controllerOnline ? 'Control conectado' : 'Esperando control', true);
        } else {
          emitStatus(metadata.cameraOnline === true ? 'Conectado al teléfono' : 'Esperando teléfono', metadata.cameraOnline === true);
        }
      });

      const rolePatch = role === 'camera'
        ? { cameraOnline: true, cameraUid: uid }
        : { controllerOnline: true, controllerUid: uid };
      await update(metaRef, { ...rolePatch, updatedAt: serverTimestamp() });
      const disconnectPatch = role === 'camera'
        ? { cameraOnline: false, streamStatus: 'ended', updatedAt: serverTimestamp() }
        : { controllerOnline: false, updatedAt: serverTimestamp() };
      onDisconnect(metaRef).update(disconnectPatch);

      ready = true;
      connected = true;
      emitStatus(role === 'camera' ? 'Esperando control' : 'Conectado al teléfono', true);
    } catch (error) {
      console.error('Firebase initialization error', error);
      connected = false;
      emitStatus(`Firebase: ${error.code || error.message}`, false);
    }
  }

  initialize();

  return {
    configured: true,
    subscribe(fn) {
      listeners.push(fn);
      fn(combined());
      return () => {
        const index = listeners.indexOf(fn);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
    onStatus(fn) {
      statusListeners.push(fn);
      return () => {
        const index = statusListeners.indexOf(fn);
        if (index >= 0) statusListeners.splice(index, 1);
      };
    },
    async patch(changes) {
      const patch = { ...(changes || {}) };
      if (Array.isArray(patch.sponsors)) {
        currentSponsors = sanitizeSponsors(patch.sponsors);
        await set(sponsorsRef, currentSponsors);
        delete patch.sponsors;
      }
      if (patch.activeSponsor && !patch.activeSponsorId) {
        patch.activeSponsorId = patch.activeSponsor.id || null;
      }
      delete patch.activeSponsor;
      delete patch.sponsorCommand;
      if (Object.keys(patch).length) {
        currentState = { ...currentState, ...patch };
        await update(stateRef, { ...patch, updatedAt: serverTimestamp() });
      }
      emit();
    },
    async setStreamStatus(status) {
      await update(metaRef, { streamStatus: status, updatedAt: serverTimestamp() });
    },
    onMetadata(fn) {
      return onValue(metaRef, (snapshot) => fn(snapshot.val() || {}));
    },
    get online() { return connected; },
    get ready() { return ready; },
    get mode() { return 'firebase'; },
    get match() { return match; },
    destroy() {
      stateUnsubscribe?.();
      sponsorUnsubscribe?.();
      metaUnsubscribe?.();
    }
  };
}
