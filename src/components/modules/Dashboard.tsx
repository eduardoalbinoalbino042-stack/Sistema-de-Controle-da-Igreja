import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Wallet, 
  UserPlus, 
  Calendar, 
  Activity, 
  ChevronRight, 
  Database, 
  ExternalLink, 
  Mail, 
  User, 
  Loader2,
  Gift,
  AlertTriangle,
  Sun,
  CloudRain,
  Thermometer,
  Clock
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { subscribeToRecentActivity, ActivityLog } from '../../lib/activityService';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';

interface DashboardProps {
  onNavigate?: (module: string, data?: any) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>('ALL');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [membersCount, setMembersCount] = useState(0);
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    // Activity listener
    const unsubActivity = subscribeToRecentActivity(user.uid, (data) => {
      setActivities(data);
    });

    // Transactions listener
    const qTrans = query(
      collection(db, 'church_transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'church_transactions');
    });

    // Members listener
    const qMembers = query(collection(db, 'members'), where('userId', '==', user.uid));
    const unsubMembers = onSnapshot(qMembers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMembers(data);
      setMembersCount(snapshot.size);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
    });

    // Invoices listener
    const qInvoices = query(collection(db, 'invoices'), where('userId', '==', user.uid));
    const unsubInvoices = onSnapshot(qInvoices, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'invoices');
    });

    // Events listener
    const qEvents = query(collection(db, 'events'), where('userId', '==', user.uid));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      setEventsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    // Weather Fetch (One time)
    const fetchWeather = async () => {
      try {
        // Default to Maracaí/Assis region based on sample data
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-22.6139&longitude=-50.6384&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FSao_Paulo');
        const data = await res.json();
        if (data.daily) {
          setWeather({
            max: data.daily.temperature_2m_max[0],
            min: data.daily.temperature_2m_min[0],
            rainProb: data.daily.precipitation_probability_max[0]
          });
        }
      } catch (error) {
        console.error('Weather error:', error);
      }
    };
    fetchWeather();

    return () => {
      unsubActivity();
      unsubTrans();
      unsubMembers();
      unsubInvoices();
      unsubEvents();
    };
  }, [user]);

  const todayData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayMonthDay = todayStr.substring(5); // MM-DD

    const todayEvents = eventsList.filter(e => {
      const dateStr = e.start || e.date;
      return dateStr && dateStr.startsWith(todayStr);
    });

    const todayBirthdays = members.filter(m => {
      if (!m.dataNascimento) return false;
      return m.dataNascimento.endsWith(todayMonthDay);
    });

    const overdueInvoices = invoices.filter(i => i.status !== 'Paga' && i.dueDate && i.dueDate < todayStr);
    const todayInvoices = invoices.filter(i => i.status !== 'Paga' && i.dueDate && i.dueDate === todayStr);

    return {
      events: todayEvents,
      birthdays: todayBirthdays,
      overdue: overdueInvoices,
      todayBills: todayInvoices
    };
  }, [eventsList, members, invoices]);

  const years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];
  const monthsFull = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

  const stats = useMemo(() => {
    const filtered = transactions.filter(t => {
      const [y, m] = (t.date || '').split('-'); // date is YYYY-MM-DD
      const yearMatch = y === selectedYear.toString();
      const monthMatch = selectedMonth === 'ALL' || parseInt(m) === (selectedMonth as number) + 1;
      return yearMatch && monthMatch;
    });

    const filteredEventsCount = eventsList.filter(e => {
      const dateStr = e.start || e.date;
      if (!dateStr) return false;
      
      // Events usually have start as an ISO string (e.g. 2024-03-12T10:00:00) 
      const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
      const [y, m] = datePart.split('-'); 
      
      const yearMatch = y === selectedYear.toString();
      const monthMatch = selectedMonth === 'ALL' || parseInt(m) === (selectedMonth as number) + 1;
      return yearMatch && monthMatch;
    }).length;

    const entries = filtered.filter(t => t.type === 'entrada').reduce((acc, t) => acc + (t.value || 0), 0);
    const exits = filtered.filter(t => t.type === 'saida').reduce((acc, t) => acc + (t.value || 0), 0);
    
    return [
      { id: 'caixa', label: 'Entradas Totais', value: `R$ ${entries.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, change: '+12.5%', icon: Wallet, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
      { id: 'cadastro', label: 'Membros Ativos', value: membersCount.toString(), change: 'Total', icon: UserPlus, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500/10' },
      { id: 'agenda', label: 'Agendamentos', value: filteredEventsCount.toString(), change: 'No Período', icon: Calendar, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
      { id: 'caixa', label: 'Saídas Total', value: `R$ ${exits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, change: 'Total', icon: Activity, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' },
      { id: 'configuracoes', label: 'Banco de Dados', value: '0.2%', change: '99.8% Livre', icon: Database, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10', subValue: '2.14 MB de 1GB' },
    ];
  }, [transactions, eventsList, selectedYear, selectedMonth, membersCount]);

  const chartData = useMemo(() => {
    if (selectedMonth === 'ALL') {
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const data = monthNames.map(name => ({ name, value1: 0, value2: 0 }));
      
      transactions.forEach(t => {
        const [y, m] = (t.date || '').split('-');
        if (y === selectedYear.toString()) {
          const mIdx = parseInt(m) - 1;
          if (data[mIdx]) {
            if (t.type === 'entrada') data[mIdx].value1 += (t.value || 0);
            if (t.type === 'saida') data[mIdx].value2 += (t.value || 0);
          }
        }
      });
      return data;
    } else {
      // Daily view for selected month
      const daysInMonth = new Date(selectedYear, (selectedMonth as number) + 1, 0).getDate();
      const data = Array.from({ length: daysInMonth }, (_, i) => ({
        name: (i + 1).toString().padStart(2, '0'),
        value1: 0,
        value2: 0
      }));

      transactions.forEach(t => {
        const [y, m, d] = (t.date || '').split('-');
        const targetMonth = ((selectedMonth as number) + 1).toString().padStart(2, '0');
        if (y === selectedYear.toString() && m === targetMonth) {
          const dIdx = parseInt(d) - 1;
          if (data[dIdx]) {
            if (t.type === 'entrada') data[dIdx].value1 += (t.value || 0);
            if (t.type === 'saida') data[dIdx].value2 += (t.value || 0);
          }
        }
      });
      return data;
    }
  }, [transactions, selectedYear, selectedMonth]);

  return (
    <div className="h-full overflow-y-auto scrollbar-hide px-[15px] pb-[15px] pt-0 bg-slate-50 dark:bg-[#0b1120]">
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.04)] p-6 lg:p-8 space-y-8 min-h-full">
        {/* Date Filters */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 bg-white dark:bg-slate-900/40 p-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/50 shadow-sm w-full transition-all">
        {/* Year Selector */}
        <div className="flex items-center bg-slate-50 dark:bg-slate-950 rounded-xl p-1 shrink-0 border border-slate-100 dark:border-slate-800/60">
          {years.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                selectedYear === year 
                  ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {year}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="hidden lg:block w-px h-6 bg-slate-200 dark:bg-slate-800/60 shrink-0" />

        {/* Month Selector */}
        <div className="flex-1 flex items-center justify-between gap-1 overflow-x-auto lg:overflow-hidden scrollbar-hide px-2 w-full">
          <button
            onClick={() => setSelectedMonth('ALL')}
            className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-wider transition-all whitespace-nowrap shrink-0 ${
              selectedMonth === 'ALL'
                ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
             ANO INTEIRO
          </button>
          
          {monthsFull.map((month, index) => (
            <button
              key={month}
              onClick={() => setSelectedMonth(index)}
              className={`px-2 py-1.5 rounded-xl text-[10px] font-bold tracking-widest transition-all whitespace-nowrap flex-1 text-center min-w-fit ${
                selectedMonth === index
                  ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {month}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        {loading ? (
          <div className="col-span-5 py-10 flex justify-center">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
          </div>
        ) : (
          stats.map((stat, i) => (
            <motion.div 
              key={i}
              onClick={() => stat.id !== 'configuracoes' && onNavigate && onNavigate(stat.id)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 p-3.5 rounded-xl transition-all group shadow-sm flex flex-col justify-center min-h-[110px] ${stat.id !== 'configuracoes' && onNavigate ? 'cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-md' : 'hover:border-slate-300 dark:hover:border-slate-700'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${stat.change.includes('Livre') || stat.change.includes('Total') || stat.change.startsWith('+') ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                  {stat.change}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-medium leading-none">{stat.label}</p>
                <div className="flex items-end gap-1.5">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tight">{stat.value}</h3>
                  {stat.subValue && (
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium tracking-tight mb-0.5">
                      {stat.subValue}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Fluxo Financeiro ({selectedMonth === 'ALL' ? 'Anual' : monthsFull[selectedMonth]})</h2>
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedMonth === 'ALL' ? `Ano ${selectedYear}` : `${monthsFull[selectedMonth]} ${selectedYear}`}</span>
            </div>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorValue2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#991b1b" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#991b1b" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
                  dy={10}
                  padding={{ left: 10, right: 10 }}
                />
                <YAxis hide />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#1e293b] p-3 rounded-lg shadow-xl border-none text-white min-w-[120px]">
                          <p className="text-xs font-bold mb-2">{selectedMonth === 'ALL' ? 'Mês: ' : 'Dia: '}{label}</p>
                          <div className="space-y-1">
                            {payload.map((entry: any, index: number) => (
                              <p key={index} className="text-[11px] font-medium flex justify-between gap-4">
                                <span>{entry.name} :</span>
                                <span className="font-bold text-emerald-400">R$ {entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                />
                <Area 
                  name="Saídas"
                  type="monotone" 
                  dataKey="value2" 
                  stroke="#991b1b" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue2)" 
                />
                <Area 
                  name="Entradas"
                  type="monotone" 
                  dataKey="value1" 
                  stroke="#ef4444" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue1)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 shadow-sm flex flex-col h-full">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Atividade Recente</h2>
          <div className="space-y-4 flex-1">
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 opacity-40 italic">
                <Activity className="w-8 h-8 mb-2" />
                <p className="text-xs">Nenhuma atividade registrada</p>
              </div>
            ) : (
              activities.slice(0, 3).map((item, i) => (
                <div key={item.id} className="flex gap-4 group">
                  <div className="relative">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      item.type === 'event' ? 'bg-cyan-500' : 
                      item.type === 'email' ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`} />
                    {i !== Math.min(activities.length, 3) - 1 && <div className="absolute top-4 left-[3px] w-[2px] h-8 bg-slate-200 dark:bg-slate-800" />}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{item.userName}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{item.action}</p>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {item.timestamp && typeof item.timestamp.toDate === 'function' 
                        ? formatDistanceToNow(item.timestamp.toDate(), { locale: ptBR, addSuffix: true }) 
                        : 'agora mesmo'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <button className="w-full mt-4 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 transition-colors flex items-center justify-center gap-2 group">
            Ver tudo <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
        {/* Today's Appointments */}
        <div 
          onClick={() => onNavigate && onNavigate('agenda')}
          className="bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-3 shadow-sm min-h-[110px] cursor-pointer hover:border-cyan-500/50 transition-all hover:shadow-md"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 leading-none">Compromissos</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Hoje</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {todayData.events.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic py-1">Vazio hoje</p>
            ) : (
              todayData.events.slice(0, 2).map(event => (
                <div key={event.id} className="flex items-center gap-1.5 p-1 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                  <Clock className="w-2.5 h-2.5 text-cyan-500 shrink-0" />
                  <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{event.title}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Today's Birthdays */}
        <div 
          onClick={() => onNavigate && onNavigate('cadastro', { view: 'birthday' })}
          className="bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-3 shadow-sm min-h-[110px] cursor-pointer hover:border-fuchsia-500/50 transition-all hover:shadow-md"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-fuchsia-500/10 text-fuchsia-500">
              <Gift className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 leading-none">Aniversariantes</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Hoje</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {todayData.birthdays.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic py-1">Vazio hoje</p>
            ) : (
              todayData.birthdays.slice(0, 2).map(m => (
                <div key={m.id} className="flex items-center gap-1.5 p-1 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                  <User className="w-2.5 h-2.5 text-fuchsia-500 shrink-0" />
                  <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{m.nome}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Financial Pendencies */}
        <div 
          onClick={() => onNavigate && onNavigate('financas')}
          className="bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-3 shadow-sm min-h-[110px] cursor-pointer hover:border-orange-500/50 transition-all hover:shadow-md"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 leading-none">Pendências</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Contas</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500">Atrasados:</span>
              <span className={`text-[10px] font-black px-1.5 py-0 rounded-full ${todayData.overdue.length > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                {todayData.overdue.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500">Hoje:</span>
              <span className={`text-[10px] font-black px-1.5 py-0 rounded-full ${todayData.todayBills.length > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                {todayData.todayBills.length}
              </span>
            </div>
          </div>
        </div>

        {/* Weather Forecast */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-3 shadow-sm min-h-[110px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
              {weather && weather.rainProb > 40 ? <CloudRain className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 leading-none">Clima</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Previsão</p>
            </div>
          </div>
          {weather ? (
            <div className="grid grid-cols-1 gap-2 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400">TEMP</span>
                <span className="text-[11px] font-black text-slate-900 dark:text-white">{Math.round(weather.min)}° - {Math.round(weather.max)}°</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400">CHUVA</span>
                <span className="text-[11px] font-black text-slate-900 dark:text-white">{weather.rainProb}%</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center p-1">
              <Loader2 className="w-3 h-3 text-indigo-500 animate-spin" />
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
