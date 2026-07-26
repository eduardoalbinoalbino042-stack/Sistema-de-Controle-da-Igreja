import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot
} from 'firebase/firestore';
import { 
  parseISO, 
  isSameDay, 
  addMinutes, 
  addHours, 
  addDays, 
  addWeeks, 
  addMonths, 
  startOfDay 
} from 'date-fns';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { Event } from '../lib/calendar-types';

interface NotificationContextType {
  reminders: Event[];
  overdue: Event[];
  totalNotifications: number;
  unreadCount: number;
  isReady: boolean;
  markAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady } = useAuth();
  const [reminders, setReminders] = useState<Event[]>([]);
  const [overdue, setOverdue] = useState<Event[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [readIds, setReadIds] = useState<Set<string | number>>(() => {
    const saved = localStorage.getItem('readNotificationIds');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  
  const eventsRef = React.useRef<Event[]>([]);

  // Update localStorage when readIds change
  useEffect(() => {
    localStorage.setItem('readNotificationIds', JSON.stringify(Array.from(readIds)));
  }, [readIds]);

  const calculateReminders = useCallback((allEvents: Event[]) => {
// ... existing logic ...
    const now = new Date();
    const upcoming: Event[] = [];
    const late: Event[] = [];

    allEvents.forEach(event => {
      if (event.isCompleted) return;

      const eventStart = parseISO(event.start);
      if (isNaN(eventStart.getTime())) return;

      // --- Overdue Logic ---
      const overdueLimit = addDays(startOfDay(eventStart), 1);
      if (now >= overdueLimit) {
        late.push(event);
        return;
      }

      // --- Reminder Logic ---
      if (event.hasReminder && event.reminderValue !== undefined && event.reminderUnit) {
        let reminderTime: Date;
        const val = event.reminderValue;

        switch (event.reminderUnit) {
          case 'minutes': reminderTime = addMinutes(eventStart, -val); break;
          case 'hours': reminderTime = addHours(eventStart, -val); break;
          case 'days': reminderTime = addDays(eventStart, -val); break;
          case 'weeks': reminderTime = addWeeks(eventStart, -val); break;
          case 'months': reminderTime = addMonths(eventStart, -val); break;
          default: reminderTime = addMinutes(eventStart, -val);
        }

        // If it's day-based, trigger from the start of that day
        if (['days', 'weeks', 'months'].includes(event.reminderUnit)) {
          reminderTime = startOfDay(reminderTime);
        }

        // Trigger if we are between reminderTime and eventStart (or just past reminderTime)
        if (now >= reminderTime && now < eventStart) {
          upcoming.push(event);
        }
      }
    });

    setReminders(upcoming);
    setOverdue(late);
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setReminders([]);
      setOverdue([]);
      setIsReady(false);
      eventsRef.current = [];
      return;
    }

    const q = query(collection(db, 'events'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      eventsRef.current = allEvents;
      calculateReminders(allEvents);
    });

    const interval = setInterval(() => {
      if (eventsRef.current.length > 0) {
        calculateReminders(eventsRef.current);
      }
    }, 60000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [user, isAuthReady, calculateReminders]);

  const markAsRead = useCallback(() => {
    const allIds = [...reminders, ...overdue].map(e => e.id);
    setReadIds(prev => {
      const next = new Set(prev);
      allIds.forEach(id => next.add(id));
      return next;
    });
  }, [reminders, overdue]);

  const value = {
    reminders,
    overdue,
    totalNotifications: reminders.length + overdue.length,
    unreadCount: [...reminders, ...overdue].filter(e => !readIds.has(e.id)).length,
    isReady,
    markAsRead
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
