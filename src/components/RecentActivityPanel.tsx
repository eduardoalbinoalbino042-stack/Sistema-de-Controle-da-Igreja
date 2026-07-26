import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, X, Clock, User, Mail, Calendar, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscribeToRecentActivity, ActivityLog } from '../lib/activityService';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const RecentActivityPanel = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToRecentActivity(user.uid, (data) => {
      setActivities(data);
    });
    return () => unsubscribe();
  }, [user]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'event': return <Calendar className="w-3.5 h-3.5" />;
      case 'email': return <Mail className="w-3.5 h-3.5" />;
      case 'account': return <User className="w-3.5 h-3.5" />;
      default: return <Activity className="w-3.5 h-3.5" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'event': return 'bg-cyan-500';
      case 'email': return 'bg-emerald-500';
      case 'account': return 'bg-indigo-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[150] lg:hidden"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-80 bg-white dark:bg-[#0b1120] border-l border-slate-200 dark:border-slate-800 z-[160] flex flex-col shadow-2xl"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-500">
                  <Activity className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">Atividade Recente</h2>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
                  <Activity className="w-12 h-12 text-slate-300" />
                  <p className="text-sm font-medium">Nenhuma atividade recente</p>
                </div>
              ) : (
                activities.map((item, i) => (
                  <div key={item.id} className="flex gap-4 group">
                    <div className="relative">
                      <div className={`w-8 h-8 rounded-lg ${getActivityColor(item.type)} flex items-center justify-center text-white shadow-lg shadow-black/10 transition-transform group-hover:scale-110`}>
                        {getActivityIcon(item.type)}
                      </div>
                      {i !== activities.length - 1 && (
                        <div className="absolute top-10 left-[15px] w-[2px] h-12 bg-slate-100 dark:bg-slate-800" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.userName}</p>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {item.timestamp ? formatDistanceToNow(item.timestamp.toDate(), { locale: ptBR, addSuffix: true }) : 'agora'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">{item.action}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 italic mt-0.5 line-clamp-2">{item.details}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-slate-50/50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-center text-slate-400 font-medium uppercase tracking-widest italic">
                Logs de auditoria em tempo real
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
