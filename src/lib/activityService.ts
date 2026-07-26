import { db } from './firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

export interface ActivityLog {
  id?: string;
  userId: string;
  userName: string;
  action: string; // e.g., 'Criou um compromisso', 'Enviou um e-mail'
  details: string; // e.g., 'Compromisso: Consulta com Dr. Silva'
  timestamp: any;
  type: 'event' | 'email' | 'account' | 'system';
}

import { handleFirestoreError } from './firestoreUtils';

export async function logActivity(activity: Omit<ActivityLog, 'timestamp'>) {
  try {
    await addDoc(collection(db, 'activities'), {
      ...activity,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'create', 'activities');
  }
}

export function subscribeToRecentActivity(userId: string, callback: (activities: ActivityLog[]) => void) {
  const q = query(
    collection(db, 'activities'),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(10)
  );

  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ActivityLog));
    callback(activities);
  }, (error) => {
    handleFirestoreError(error, 'list', 'activities');
  });
}
