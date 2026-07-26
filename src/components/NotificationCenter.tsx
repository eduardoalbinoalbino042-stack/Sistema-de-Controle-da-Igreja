import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Clock, MapPin, List, Lock } from 'lucide-react';
import { format, parseISO, addDays, startOfDay, isToday, isBefore, subMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Event, getEventStyles } from '../lib/calendar-types';

interface NotificationCenterProps {
  onNavigate: (module: string, event?: Event) => void;
}

const ReminderToast = ({ event, onClose, onView }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isHovered && !isInfoModalOpen) {
      timerRef.current = setTimeout(() => {
        onClose();
      }, 15000); // 15 seconds display
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isHovered, isInfoModalOpen, onClose]);

  const start = parseISO(event.start || '');
  if (isNaN(start.getTime())) {
    return null; // Don't show toast for invalid date
  }
  const isOverdue = new Date() >= addDays(startOfDay(start), 1);
  const styles = getEventStyles(event.color || 'bg-cyan-500');

  return (
    <div className="pointer-events-auto relative">
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        onMouseEnter={() => {
          setIsHovered(true);
          setIsInfoModalOpen(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsInfoModalOpen(false);
        }}
        className="w-96 bg-white dark:bg-[#0b1120] relative overflow-hidden py-2.5 px-4 pl-6 rounded-2xl shadow-2xl flex flex-col gap-1 cursor-pointer transition-all hover:scale-[1.01]"
        onClick={onView}
      >
        {/* Abinha lateral esquerda */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${styles.sidebar}`} />

        <div className="flex items-center justify-between mb-0">
          <div className="flex items-center gap-2">
            <p className={`text-[10px] font-black uppercase tracking-widest ${styles.text}`}>
              Lembrete de compromisso
            </p>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex justify-between items-start gap-3">
          <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight flex-1">
            {event.title}
          </h4>
          <span className="text-[11px] font-bold text-blue-500 dark:text-blue-400 whitespace-nowrap">
            {format(start, 'dd/MM/yyyy')} às {format(start, 'HH:mm')}
          </span>
        </div>

        <div className="flex flex-col gap-0">
          {(event.patientName || event.responsibleName) && (
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {event.patientName && `Paciente: ${event.patientName}`}
              {event.patientName && event.responsibleName && ' | '}
              {event.responsibleName && `Resp: ${event.responsibleName}`}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between min-h-[1.25rem] mt-0.5">
          <p className="text-[10px] text-slate-400 font-medium">
            {event.patientName || event.doctorName || event.responsibleName || ''}
          </p>
          {isOverdue && (
            <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 rounded-lg text-[9px] font-black uppercase tracking-tight">
              Atrasado
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {isInfoModalOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute bottom-full right-0 mb-4 w-72 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-4 z-[210] pointer-events-none"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className={`w-2 h-2 rounded-full ${styles.dot}`} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{event.category}</span>
              </div>
              
              {event.doctorName && (
                <div className="space-y-0.5">
                  <p className="text-[10px] text-slate-400">Médico</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{event.doctorName}</p>
                </div>
              )}
              
              {event.specialty && (
                <div className="space-y-0.5">
                  <p className="text-[10px] text-slate-400">Especialidade</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{event.specialty}</p>
                </div>
              )}

              {event.address && (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <MapPin className="w-3 h-3" />
                    <span>Localização</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed italic">{event.address}</p>
                </div>
              )}

              {event.description && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <List className="w-3 h-3" />
                    <span>Descrição</span>
                  </div>
                  <div 
                    className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-3 prose dark:prose-invert max-w-full overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: event.description }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

import { useNotifications } from '../context/NotificationContext';

export const NotificationCenter = ({ onNavigate }: NotificationCenterProps) => {
  const { reminders, overdue, isReady } = useNotifications();
  const [activeReminders, setActiveReminders] = useState<Event[]>([]);
  const [shownReminders, setShownReminders] = useState<Set<string | number>>(new Set());

  useEffect(() => {
    if (!isReady) return;

    const checkReminders = () => {
      const allToNotify = [...reminders, ...overdue];
      const currentDue = allToNotify.filter(e => !shownReminders.has(e.id));

      if (currentDue.length > 0) {
        setActiveReminders(prev => {
          const newEntries = currentDue.filter(due => !prev.some(p => p.id === due.id));
          return [...prev, ...newEntries];
        });
        setShownReminders(prev => {
          const next = new Set(prev);
          currentDue.forEach(e => next.add(e.id));
          return next;
        });
      }
    };

    // 10s delay after mount/isReady to show first batch
    const timer = setTimeout(checkReminders, 10000);
    // Interval check every 30s
    const interval = setInterval(checkReminders, 30000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [reminders, overdue, isReady, shownReminders]);

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {activeReminders.map(event => (
          <ReminderToast 
            key={event.id} 
            event={event} 
            onClose={() => setActiveReminders(prev => prev.filter(r => r.id !== event.id))}
            onView={() => {
              onNavigate('agenda', event);
              setActiveReminders(prev => prev.filter(r => r.id !== event.id));
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
