import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDTwua7cXOZNYRyqLSGxGzu8ZChcLCc2hs',
  authDomain: 'expense-tracker-fb95d.firebaseapp.com',
  projectId: 'expense-tracker-fb95d',
  storageBucket: 'expense-tracker-fb95d.firebasestorage.app',
  messagingSenderId: '68266704080',
  appId: '1:68266704080:web:83d72ee30a85ca676672d5',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
