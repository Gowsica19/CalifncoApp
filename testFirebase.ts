
import { db } from './firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

export async function testFirebase() {
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    console.log('Firebase connected successfully!');
    console.log('Products found:', snapshot.size);
  } catch (error) {
    console.error('Firebase connection failed:', error);
  }
}
