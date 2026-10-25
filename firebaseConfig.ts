
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyA4JK_dFQrCi-uJoFePMtzoDhpb_Mcft8c',
  authDomain: 'califncoapp.firebaseapp.com',
  projectId: 'califncoapp',
  storageBucket: 'califncoapp.firebasestorage.app',
  messagingSenderId: '986871678339',
  appId: '1:986871678339:web:e8978a901f43ee443aa2b6',
  measurementId: 'G-JVV2H9H3JQ',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);