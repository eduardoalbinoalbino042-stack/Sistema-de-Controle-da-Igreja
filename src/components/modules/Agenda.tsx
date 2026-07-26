import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Plus,
  Filter,
  Search,
  Clock,
  MapPin,
  Phone,
  X,
  Calendar as CalendarIcon,
  Save,
  Repeat,
  Briefcase,
  Bell,
  Tag,
  Lock,
  Type,
  Bold,
  Italic,
  Underline,
  Palette,
  List,
  ListOrdered,
  Paperclip,
  Image as ImageIcon,
  Smile,
  Mail,
  AlertCircle,
  Type as FontIcon,
  Accessibility,
  MoreHorizontal,
  Users,
  Trash2,
  Edit2,
  Flag,
  Star,
  Activity,
  LogOut,
  LogIn,
  Loader2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  isToday,
  parseISO,
  startOfDay,
  endOfDay,
  eachHourOfInterval,
  addWeeks,
  subWeeks,
  subDays,
  addHours,
  setHours,
  setMinutes,
  setMonth,
  setYear
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  APIProvider, 
  useMapsLibrary, 
  useMap 
} from '@vis.gl/react-google-maps';
import { db, auth, signInWithGoogle, logout as firebaseLogout } from '../../lib/firebase';

import { useConfig } from '../../context/ConfigContext';

const DEFAULT_MAPS_KEY = 'AIzaSyC_YbCIHXRMfedcwMhxhDRIxq9p2eYwJzo';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { Event, getEventStyles, PALETTE_STYLES } from '../../lib/calendar-types';
import { logActivity } from '../../lib/activityService';
import { confirmAction, showSuccess, showError, showInfo, confirmSaveAction, confirmDeleteAction, confirmRecurrentDeleteAction } from '../../lib/alerts';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

/* 
  Tailwind Safelist - Explicitly list all classes used dynamically to prevent JIT purging.
  CLASSES:
  text-red-700 text-red-600 text-orange-600 text-orange-700 text-yellow-700 text-yellow-600 text-stone-700 text-lime-700 
  text-lime-800 text-green-700 text-green-800 text-cyan-700 text-cyan-800 text-sky-700 text-blue-700 text-indigo-700 
  text-purple-700 text-pink-700 text-fuchsia-700 text-slate-700 text-slate-800 text-gray-700 text-stone-600 
  text-amber-700 text-emerald-700
  border-red-600 border-red-300 border-orange-300 border-orange-500 border-orange-400 border-yellow-500 
  border-yellow-600 border-yellow-200 border-stone-500 border-lime-400 border-lime-500 border-green-500 
  border-green-600 border-green-700 border-cyan-400 border-cyan-500 border-cyan-600 border-cyan-700 
  border-sky-400 border-sky-500 border-blue-400 border-blue-600 border-indigo-400 border-purple-400 
  border-purple-600 border-pink-400 border-amber-600 border-emerald-600 border-fuchsia-500 border-slate-400 
  border-slate-500 border-slate-700 border-gray-400 border-stone-300
  bg-red-500 bg-red-200 bg-orange-200 bg-orange-400 bg-orange-300 bg-yellow-400 bg-yellow-100 bg-stone-400 
  bg-lime-200 bg-lime-400 bg-green-400 bg-green-600 bg-cyan-200 bg-cyan-400 bg-cyan-600 bg-sky-200 
  bg-sky-400 bg-blue-200 bg-indigo-300 bg-purple-300 bg-pink-200 bg-fuchsia-400 bg-slate-200 bg-slate-400 
  bg-slate-600 bg-gray-300 bg-stone-100 bg-amber-500 bg-emerald-500 bg-blue-500 bg-cyan-500 bg-purple-500 
  bg-red-500 bg-yellow-500
*/

const OUTLOOK_COLORS = [
  { name: 'Azul', class: 'bg-blue-500' },
  { name: 'Verde', class: 'bg-emerald-500' },
  { name: 'Laranja', class: 'bg-orange-500' },
  { name: 'Vermelho', class: 'bg-rose-500' },
  { name: 'Roxo', class: 'bg-violet-500' },
  { name: 'Amarelo', class: 'bg-yellow-400' },
  { name: 'Cinza', class: 'bg-slate-500' },
  { name: 'Ciano', class: 'bg-cyan-500' },
  { name: 'Teal', class: 'bg-teal-500' },
  { name: 'Índigo', class: 'bg-indigo-500' },
];

// --- Components ---

const MiniCalendar = ({ currentMonth, selectedDate, onDateClick, onMonthChange }: any) => {
  const [showPicker, setShowPicker] = useState(false);
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 relative">
        <button 
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center gap-1 group"
        >
          <span className="text-sm font-bold text-slate-900 dark:text-white capitalize group-hover:text-cyan-500 transition-colors">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <ChevronDown className={`w-3 h-3 text-slate-400 dark:text-slate-500 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showPicker && (
            <MonthYearPicker 
              date={currentMonth} 
              onChange={onMonthChange} 
              onClose={() => setShowPicker(false)} 
            />
          )}
        </AnimatePresence>

        <div className="flex gap-1">
          <button 
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <span key={`${d}-${i}`} className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, i) => (
          <button
            key={i}
            onClick={() => onDateClick(day)}
            className={`
              text-[11px] p-1.5 rounded-md transition-colors
              ${!isSameMonth(day, monthStart) ? 'text-slate-300 dark:text-slate-600' : 'text-slate-600 dark:text-slate-300'}
              ${isSameDay(day, selectedDate) ? 'bg-cyan-500 text-white font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}
              ${isToday(day) && !isSameDay(day, selectedDate) ? 'text-cyan-600 dark:text-cyan-400 border border-cyan-500/30' : ''}
            `}
          >
            {format(day, 'd')}
          </button>
        ))}
      </div>
    </div>
  );
};

const REMINDER_OPTIONS = [
  { label: '0 minutos', value: 0 },
  { label: '15 minutos', value: 15 },
  { label: '30 minutos', value: 30 },
  { label: '1 hora', value: 60 },
  { label: '2 horas', value: 120 },
  { label: '1 dia', value: 1440 },
  { label: '1 semana', value: 10080 },
  { label: '1 mês', value: 43200 },
];

const RECURRENCE_OPTIONS = [
  { label: 'Todo dia', value: 'daily' },
  { label: 'Semanalmente', value: 'weekly' },
  { label: 'Mensalmente', value: 'monthly' },
  { label: 'Anualmente', value: 'yearly' },
];

const CATEGORIES = [
  { name: 'Médico', color: 'bg-amber-500', iconColor: 'text-amber-500' },
  { name: 'Particular', color: 'bg-emerald-500', iconColor: 'text-emerald-500' },
  { name: 'Trabalho', color: 'bg-blue-500', iconColor: 'text-blue-500' },
  { name: 'Pessoal', color: 'bg-indigo-300', iconColor: 'text-indigo-300' },
  { name: 'Categoria Amarela', color: 'bg-yellow-400', iconColor: 'text-yellow-400' },
  { name: 'Categoria Azul', color: 'bg-cyan-500', iconColor: 'text-cyan-500' },
  { name: 'Categoria Laranja', color: 'bg-orange-500', iconColor: 'text-orange-500' },
  { name: 'Categoria Roxa', color: 'bg-purple-500', iconColor: 'text-purple-500' },
  { name: 'Categoria Verde', color: 'bg-green-500', iconColor: 'text-green-500' },
  { name: 'Categoria Vermelha', color: 'bg-red-500', iconColor: 'text-red-500' },
];

const REMINDER_UNITS = [
  { label: 'Minutos', value: 'minutes' },
  { label: 'Horas', value: 'hours' },
  { label: 'Dias', value: 'days' },
  { label: 'Semanas', value: 'weeks' },
  { label: 'Meses', value: 'months' },
];

const CATEGORY_PALETTE = [
  'bg-red-500', 'bg-red-200', 'bg-orange-200', 'bg-orange-400', 'bg-orange-300', 'bg-yellow-400', 'bg-yellow-100', 'bg-stone-400', 'bg-lime-200', 'bg-lime-400', 'bg-green-400', 'bg-green-600', 'bg-cyan-200',
  'bg-cyan-400', 'bg-cyan-600', 'bg-sky-200', 'bg-sky-400', 'bg-blue-200', 'bg-indigo-300', 'bg-purple-300', 'bg-pink-200', 'bg-fuchsia-400', 'bg-slate-200', 'bg-slate-400', 'bg-slate-600', 'bg-gray-300', 'bg-stone-100'
];

const MonthYearPicker = ({ date, onChange, onClose }: { date: Date, onChange: (date: Date) => void, onClose: () => void }) => {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className="absolute top-full left-0 md:left-auto md:right-0 mt-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-[110] w-64 overflow-hidden"
    >
      <div className="flex items-center justify-between mb-4 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700/50">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onChange(setYear(date, date.getFullYear() - 1));
          }}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 shadow-sm transition-all active:scale-90"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-black text-slate-900 dark:text-white px-4 tracking-tighter text-lg italic">
          {format(date, 'yyyy')}
        </span>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onChange(setYear(date, date.getFullYear() + 1));
          }}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 shadow-sm transition-all active:scale-90"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {months.map((m, i) => (
          <button
            key={m}
            onClick={(e) => {
              e.stopPropagation();
              onChange(setMonth(date, i));
              onClose();
            }}
            className={`text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl transition-all ${
              date.getMonth() === i
                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-500'
            }`}
          >
            {m.substring(0, 3)}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

const ModernDateTimePicker = ({ value, onChange, label, icon: Icon }: { value: string, onChange: (val: string) => void, label: string, icon: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentViewDate, setCurrentViewDate] = useState(value ? parseISO(value) : new Date());
  const [showPicker, setShowPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const dateValue = value ? parseISO(value) : new Date();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monthStart = startOfMonth(currentViewDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(endOfMonth(monthStart));
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const handleDateSelect = (day: Date) => {
    const newDate = setMinutes(setHours(day, dateValue.getHours()), dateValue.getMinutes());
    onChange(newDate.toISOString());
  };

  const handleTimeSelect = (h?: number, m?: number) => {
    let newDate = new Date(dateValue);
    if (h !== undefined) newDate = setHours(newDate, h);
    if (m !== undefined) newDate = setMinutes(newDate, m);
    onChange(newDate.toISOString());
  };

  return (
    <div className="relative flex-1" ref={containerRef}>
      <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide ml-1">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-cyan-500/50 cursor-pointer group"
      >
        <Icon className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-full">
          {value && !isNaN(dateValue.getTime()) ? format(dateValue, "dd/MM/yyyy HH:mm") : 'Selecionar data'}
        </span>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            className="absolute top-full left-0 mt-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[120] w-[320px] flex flex-col gap-4 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700/50 relative">
               <div className="flex items-center gap-1 group cursor-pointer" onClick={() => setShowPicker(!showPicker)}>
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white ml-2 italic">
                    {format(currentViewDate, 'MMMM yyyy', { locale: ptBR })}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
               </div>

               <AnimatePresence>
                 {showPicker && (
                   <MonthYearPicker 
                     date={currentViewDate} 
                     onChange={(d) => { setCurrentViewDate(d); setShowPicker(false); }} 
                     onClose={() => setShowPicker(false)} 
                   />
                 )}
               </AnimatePresence>

               <div className="flex gap-1">
                 <button onClick={() => setCurrentViewDate(subMonths(currentViewDate, 1))} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-500 transition-all active:scale-90"><ChevronLeft className="w-4 h-4" /></button>
                 <button onClick={() => setCurrentViewDate(addMonths(currentViewDate, 1))} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-500 transition-all active:scale-90"><ChevronRight className="w-4 h-4" /></button>
               </div>
            </div>

            <div className="flex gap-4">
              {/* Calendar Grid */}
              <div className="flex-1">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                    <span key={d} className="text-[8px] font-black text-slate-400 dark:text-slate-500 text-center uppercase tracking-widest">{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day, i) => (
                    <button
                      key={i}
                      onClick={() => handleDateSelect(day)}
                      className={`
                        text-[10px] h-7 w-7 flex items-center justify-center rounded-lg transition-all font-bold
                        ${!isSameMonth(day, monthStart) ? 'text-slate-300 dark:text-slate-700 opacity-50' : 'text-slate-600 dark:text-slate-300'}
                        ${isSameDay(day, dateValue) ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}
                      `}
                    >
                      {format(day, 'd')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Selection */}
              <div className="w-24 flex gap-2 h-[200px]">
                <div className="flex-1 overflow-y-auto scrollbar-hide py-1 flex flex-col gap-1 items-stretch">
                   <div className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center mb-1 sticky top-0 bg-white dark:bg-slate-900 py-1">Hora</div>
                   {hours.map(h => (
                     <button 
                       key={h}
                       onClick={() => handleTimeSelect(h)}
                       className={`text-[10px] py-1.5 rounded-lg font-bold transition-all ${dateValue.getHours() === h ? 'bg-cyan-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                     >
                       {h.toString().padStart(2, '0')}
                     </button>
                   ))}
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide py-1 flex flex-col gap-1">
                   <div className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center mb-1 sticky top-0 bg-white dark:bg-slate-900 py-1">Min</div>
                   {minutes.filter(m => m % 5 === 0).map(m => (
                     <button 
                       key={m}
                       onClick={() => handleTimeSelect(undefined, m)}
                       className={`text-[10px] py-1.5 rounded-lg font-bold transition-all ${dateValue.getMinutes() === m ? 'bg-cyan-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                     >
                       {m.toString().padStart(2, '0')}
                     </button>
                   ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
               <button 
                 onClick={() => { onChange(''); setIsOpen(false); }}
                 className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors"
               >
                 Limpar
               </button>
               <div className="flex gap-2">
                 <button 
                   onClick={() => { onChange(new Date().toISOString()); setIsOpen(false); }}
                   className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                 >
                   Hoje
                 </button>
                 <button 
                   onClick={() => setIsOpen(false)}
                   className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white bg-cyan-500 rounded-lg shadow-lg shadow-cyan-500/20 hover:bg-cyan-600 transition-colors"
                 >
                   Confirmar
                 </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CEPSearch = ({ onSelect }: { onSelect: (cep: string, address: string) => void }) => {
  const { mapsKey } = useConfig();
  const MAPS_API_KEY = mapsKey || DEFAULT_MAPS_KEY;
  const hasValidMapsKey = Boolean(mapsKey);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const placesLib = useMapsLibrary('places');
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    if (placesLib) {
      setAutocompleteService(new placesLib.AutocompleteService());
      // PlacesService requires a dummy element or map, we can use a dummy div
      const dummy = document.createElement('div');
      setPlacesService(new placesLib.PlacesService(dummy));
    }
  }, [placesLib]);

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (!val || val.length < 3 || !autocompleteService) {
      setResults([]);
      return;
    }

    setLoading(true);
    autocompleteService.getPlacePredictions(
      { input: val, componentRestrictions: { country: 'br' } },
      (predictions, status) => {
        setLoading(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setResults(predictions);
        } else {
          setResults([]);
        }
      }
    );
  };

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService) return;

    setLoading(true);
    placesService.getDetails(
      { placeId: prediction.place_id, fields: ['address_components', 'formatted_address'] },
      (place, status) => {
        setLoading(true);
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const addressComponents = place.address_components || [];
          const postalCode = addressComponents.find(c => c.types.includes('postal_code'))?.long_name || '';
          onSelect(postalCode.replace(/\D/g, ''), place.formatted_address || '');
          setQuery('');
          setResults([]);
        }
        setLoading(false);
      }
    );
  };

  if (!hasValidMapsKey) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-xl space-y-2">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-wider">Chave do Google Maps Necessária</span>
        </div>
        <p className="text-[10px] text-amber-700 dark:text-amber-500 leading-relaxed font-bold">
          Para ativar a busca dinâmica de CEP e endereços, adicione sua chave de API nas configurações do sistema (GOOGLE_MAPS_PLATFORM_KEY).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 relative">
      <div className="flex items-center gap-3 bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm focus-within:ring-2 focus-within:ring-cyan-500/20 focus-within:border-cyan-500 transition-all group">
        <Search className="w-4 h-4 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
        <input 
          type="text" 
          value={query} 
          onChange={e => handleSearch(e.target.value)}
          placeholder="Pesquisar oficina, rua ou lugar em Assis SP..."
          className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-full"
        />
        {loading && <Loader2 className="w-3 h-3 text-cyan-500 animate-spin" />}
      </div>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-[150] max-h-[200px] overflow-y-auto overflow-x-hidden scrollbar-hide py-2"
          >
            {results.map(res => (
              <button
                key={res.place_id}
                onClick={() => handleSelect(res)}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-2 group"
              >
                <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-500 mt-0.5 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{res.structured_formatting.main_text}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate">{res.structured_formatting.secondary_text}</span>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SHORTCUT_OPTIONS = [
  { label: 'Não definido', value: '' },
  { label: 'Alt + 1', value: 'alt+1' },
  { label: 'Alt + 2', value: 'alt+2' },
  { label: 'Alt + 3', value: 'alt+3' },
];

const EventModal = ({ event, onClose, onSave, onDelete, isNew, allEvents, categories, setCategories }: { event: Partial<Event>, onClose: () => void, onSave: (e: any) => void, onDelete?: (id: string | number) => void, isNew: boolean, allEvents: Event[], categories: any[], setCategories: React.Dispatch<React.SetStateAction<any[]>> }) => {
  const { mapsKey } = useConfig();
  const MAPS_API_KEY = mapsKey || DEFAULT_MAPS_KEY;
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    status: 'busy',
    hasReminder: false,
    reminderMinutes: 15,
    reminderValue: 15,
    reminderUnit: 'minutes',
    isPrivate: false,
    isCompleted: false,
    recurrenceType: 'weekly',
    senderEmail: '',
    recipientEmail: '',
    patientName: '',
    responsibleName: '',
    doctorName: event.doctorName || '',
    specialty: event.specialty || '',
    phone: event.phone || '',
    cep: event.cep || '',
    numero: event.numero || '',
    logradouro: '',
    bairro: '',
    cidade: '',
    uf: '',
    ...event
  });

  // Handle legacy events that only have a combined title
  useEffect(() => {
    if (isNew) return;
    if (formData.title && !formData.doctorName && !formData.specialty) {
      if (formData.title.includes(' - ')) {
        const [doctor, spec] = formData.title.split(' - ');
        setFormData(prev => ({ ...prev, doctorName: doctor, specialty: spec }));
      } else {
        setFormData(prev => ({ ...prev, doctorName: formData.title }));
      }
    }
  }, []);
  const [previewDate, setPreviewDate] = useState(event.start ? parseISO(event.start as string) : new Date());

  // Suggestions Logic
  const suggestions = useMemo(() => {
    const doctors = new Set<string>();
    const specialties = new Set<string>();
    const patients = new Set<string>();
    const responsibles = new Set<string>();
    const recipients = new Set<string>();
    const mappings: Record<string, { specialty?: string, address?: string, phone?: string, cep?: string, numero?: string }> = {};

    allEvents.forEach(e => {
      if (e.doctorName) {
        doctors.add(e.doctorName);
        if (!mappings[e.doctorName]) {
          mappings[e.doctorName] = { 
            specialty: e.specialty, 
            address: e.address,
            phone: e.phone,
            cep: e.cep,
            numero: e.numero
          };
        } else {
          // Update mapping if current one is more complete
          const current = mappings[e.doctorName];
          mappings[e.doctorName] = {
            specialty: current.specialty || e.specialty,
            address: current.address || e.address,
            phone: current.phone || e.phone,
            cep: current.cep || e.cep,
            numero: current.numero || e.numero
          };
        }
      }
      if (e.specialty) specialties.add(e.specialty);
      if (e.patientName) patients.add(e.patientName);
      if (e.responsibleName) responsibles.add(e.responsibleName);
      if (e.recipientEmail) recipients.add(e.recipientEmail);
    });

    return {
      doctors: Array.from(doctors).sort(),
      specialties: Array.from(specialties).sort(),
      patients: Array.from(patients).sort(),
      responsibles: Array.from(responsibles).sort(),
      recipients: Array.from(recipients).sort(),
      mappings
    };
  }, [allEvents]);

  // Auto-fill address and specialty when doctor is selected
  useEffect(() => {
    if (formData.doctorName && suggestions.mappings[formData.doctorName]) {
      const mapping = suggestions.mappings[formData.doctorName];
      setFormData(prev => ({
        ...prev,
        specialty: prev.specialty || mapping.specialty || '',
        address: prev.address || mapping.address || '',
        phone: prev.phone || mapping.phone || '',
        cep: prev.cep || mapping.cep || '',
        numero: prev.numero || mapping.numero || ''
      }));
    }
  }, [formData.doctorName, suggestions.mappings]);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category specific states
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [isManageCategoriesModalOpen, setIsManageCategoriesModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [showAllCategoriesSubmenu, setShowAllCategoriesSubmenu] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('bg-blue-500');
  
  const [registeredSenders, setRegisteredSenders] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'sender_emails'),
      where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emails = snapshot.docs.map(doc => doc.data().email);
      setRegisteredSenders(emails);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sender_emails');
    });
    return () => unsubscribe();
  }, [user]);

  // Synchronize reminderMinutes based on value and unit
  useEffect(() => {
    let factor = 1;
    switch (formData.reminderUnit) {
      case 'minutes': factor = 1; break;
      case 'hours': factor = 60; break;
      case 'days': factor = 1440; break;
      case 'weeks': factor = 10080; break;
      case 'months': factor = 43200; break;
    }
    const totalMinutes = (formData.reminderValue || 0) * factor;
    if (formData.reminderMinutes !== totalMinutes) {
      setFormData(prev => ({ ...prev, reminderMinutes: totalMinutes }));
    }
  }, [formData.reminderValue, formData.reminderUnit]);

  // Sync title from doctor and specialty
  useEffect(() => {
    if (formData.doctorName || formData.specialty) {
      const parts = [];
      if (formData.doctorName) parts.push(formData.doctorName);
      if (formData.specialty) parts.push(formData.specialty);
      const newTitle = parts.join(' - ');
      if (formData.title !== newTitle) {
        setFormData(prev => ({ ...prev, title: newTitle }));
      }
    }
  }, [formData.doctorName, formData.specialty]);

  const allCategoriesList = useMemo(() => {
    return categories
      .filter(c => !c.isPrincipal)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  const principalCategories = useMemo(() => {
    return categories.filter(c => c.isPrincipal).sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    
    if (editingCategory) {
      setCategories(prev => prev.map(c => 
        c.name === editingCategory.name ? { ...c, name: newCategoryName, color: newCategoryColor } : c
      ));
      if (formData.category === editingCategory.name) {
        setFormData(prev => ({ ...prev, category: newCategoryName, color: newCategoryColor }));
      }
    } else {
      const newCat = {
        name: newCategoryName,
        color: newCategoryColor,
        isPrincipal: false
      };
      setCategories(prev => [...prev, newCat]);
      setFormData(prev => ({...prev, category: newCat.name, color: newCat.color}));
    }
    
    setIsNewCategoryModalOpen(false);
    setNewCategoryName('');
    setEditingCategory(null);
    setShowColorPicker(false);
  };

  const handleEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setNewCategoryName(cat.name);
    setNewCategoryColor(cat.color);
    setIsNewCategoryModalOpen(true);
    setIsManageCategoriesModalOpen(false);
  };

  const toggleCategoryPrincipal = (name: string) => {
    setCategories(prev => prev.map(c => 
      c.name === name ? { ...c, isPrincipal: !c.isPrincipal } : c
    ));
  };

  const deleteCategory = (name: string) => {
    setCategories(prev => prev.filter(c => c.name !== name));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isTypingRef.current) {
      editorRef.current.innerHTML = formData.description || '';
    }
  }, []);

  const [isCompleted, setIsCompleted] = useState(formData.isCompleted || false);
  const [syncToGoogle, setSyncToGoogle] = useState(false);
  const [authStatus, setAuthStatus] = useState({ google: false, googleAccounts: [] as string[] });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [selectedGoogleAccount, setSelectedGoogleAccount] = useState<string>('');

  useEffect(() => {
    if (authStatus.googleAccounts.length > 0 && !selectedGoogleAccount) {
      setSelectedGoogleAccount(authStatus.googleAccounts[0]);
    }
  }, [authStatus.googleAccounts]);

  const fetchCalendars = async () => {
    // No longer needed to fetch all calendars upfront if we only pick account
  };

  const handleSendEmail = async () => {
    if (!formData.senderEmail || !formData.recipientEmail) return;
    
    setIsSendingEmail(true);
    setError(null);
    try {
      const emailBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #0078d4;">Detalhes do seu Compromisso</h2>
          <p>Olá, este é um lembrete do seu agendamento:</p>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
            <p><strong>Evento:</strong> ${formData.title}</p>
            <p><strong>Data/Hora:</strong> ${formData.start && !isNaN(parseISO(formData.start as string).getTime()) ? format(parseISO(formData.start as string), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}</p>
            ${formData.address ? `<p><strong>Local:</strong> ${formData.address}</p>` : ''}
            ${formData.phone ? `<p><strong>Telefone:</strong> ${formData.phone}</p>` : ''}
            ${formData.description ? `
              <div style="margin-top: 10px; border-top: 1px dashed #ccc; pt: 10px;">
                <p><strong>Observações:</strong></p>
                <div style="font-size: 14px; color: #444;">${formData.description}</div>
              </div>
            ` : ''}
          </div>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">Enviado via Church Control System.</p>
        </div>
      `;

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: formData.senderEmail,
          to: formData.recipientEmail,
          subject: `Compromisso Agendado: ${formData.title}`,
          body: emailBody
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar e-mail');
      
    // Update Firestore with email status if event exists
    if (formData.id) {
      try {
        const updateData = {
          emailSent: true,
          lastEmailSentAt: new Date().toISOString(),
          lastRecipientEmail: formData.recipientEmail
        };
        const eventRef = doc(db, 'events', String(formData.id));
        await updateDoc(eventRef, updateData);
        
        // Update local state immediately
        setFormData(prev => ({ 
          ...prev, 
          emailSent: true,
          lastEmailSentAt: updateData.lastEmailSentAt,
          lastRecipientEmail: updateData.lastRecipientEmail
        }));
        
        if (user) {
          logActivity({
            userId: user.uid,
            userName: user.displayName || 'Usuário',
            action: 'E-mail enviado',
            details: `Enviado para ${formData.recipientEmail} • Evento: ${formData.title}`,
            type: 'email'
          });
        }

        showSuccess('Enviado!', 'O resumo do evento foi enviado por e-mail.');
      } catch (dbErr) {
        console.error('Erro ao salvar status de envio:', dbErr);
        showError('Erro', 'E-mail enviado, mas não foi possível registrar no banco de dados.');
      }
    } else {
      showSuccess('Enviado!', 'E-mail enviado com sucesso.');
    }
  } catch (err: any) {
      setError(err.message);
      if (err.message.includes('não está conectada')) {
        alert(`${err.message}\n\nVá em Configurações para conectar sua conta.`);
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/status');
        if (res.ok) {
          const status = await res.json();
          setAuthStatus(status);
        }
      } catch (err) {
        console.error('Error checking auth status:', err);
      }
    };
    checkAuth();

    // Listen for OAuth success messages from popups
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const provider = event.data.provider;
        if (provider === 'google') {
          setAuthStatus(prev => ({ ...prev, google: true }));
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnect = async (provider: 'google') => {
    try {
      const res = await fetch(`/api/auth/${provider}/url`);
      const data = await res.json();
      
      if (!res.ok) {
        showError('Erro na conexão', data.error || `Erro ao conectar ao ${provider}`);
        return;
      }

      if (data.url) {
        window.open(data.url, 'oauth_popup', 'width=600,height=700');
      }
    } catch (err) {
      console.error(`Error connecting to ${provider}:`, err);
      showError('Erro', 'Conexão com o servidor falhou. Tente novamente.');
    }
  };

  useEffect(() => {
    setFormData(prev => ({ ...prev, isCompleted }));
  }, [isCompleted]);

  const handleCEPLookup = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, cep: cleanCEP }));
    
    if (cleanCEP.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            logradouro: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            uf: data.uf,
            address: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`
          }));
        }
      } catch (error) {
        console.error('Error fetching CEP:', error);
      }
    }
  };

  const execCommand = (command: string, value?: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setFormData(prev => ({ ...prev, description: editorRef.current?.innerHTML || '' }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, _type: 'file' | 'image') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        const attachments = formData.attachments || [];
        setFormData(prev => ({
          ...prev,
          attachments: [...attachments, { name: file.name, type: file.type, url }]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const hours = eachHourOfInterval({
    start: startOfDay(previewDate),
    end: endOfDay(previewDate)
  });

  const recurrenceText = useMemo(() => {
    if (!formData.isRecurrent) return null;
    try {
      const date = formData.start ? parseISO(formData.start as string) : new Date();
      if (isNaN(date.getTime())) return null;
      
      const startTime = format(date, 'HH:mm');
      const endTime = formData.end ? format(parseISO(formData.end as string), 'HH:mm') : '';
      const until = formData.recurrenceUntil ? format(parseISO(formData.recurrenceUntil), 'dd/MM/yyyy') : '';
      
      let typeText = '';
      switch(formData.recurrenceType) {
        case 'daily': typeText = 'todo dia'; break;
        case 'weekly': typeText = `a cada ${format(date, 'EEEE', { locale: ptBR })}`; break;
        case 'monthly': typeText = 'mensalmente'; break;
        case 'yearly': typeText = 'anualmente'; break;
      }

      return `Ocorre ${typeText} das ${startTime} às ${endTime} efetivo de ${format(date, 'dd/MM/yyyy')} até ${until}`;
    } catch (err) {
      console.error('Error formatting recurrence text:', err);
      return 'Configuração de recorrência inválida';
    }
  }, [formData.isRecurrent, formData.recurrenceType, formData.start, formData.end, formData.recurrenceUntil]);

  const handlePreviewSlotClick = (hour: Date) => {
    const start = setMinutes(setHours(previewDate, hour.getHours()), 0);
    const end = addHours(start, 1);
    setFormData({
      ...formData,
      start: format(start, "yyyy-MM-dd'T'HH:mm"),
      end: format(end, "yyyy-MM-dd'T'HH:mm")
    });
  };

  useEffect(() => {
    if (authStatus.google) setSyncToGoogle(true);
  }, [authStatus.google]);

  const handleSave = async () => {
    if (!formData.start || !formData.end) {
      setError('Por favor, defina o horário de início e fim.');
      return;
    }

    const start = parseISO(formData.start as string);
    const end = parseISO(formData.end as string);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setError('Horário inválido.');
      return;
    }

    if (start >= end) {
      setError('O horário de fim deve ser após o início.');
      return;
    }

    const conflict = allEvents.find(e => {
      if (e.id === formData.id) return false;
      const eStart = parseISO(e.start);
      const eEnd = parseISO(e.end);
      return (start < eEnd && end > eStart);
    });

    if (conflict) {
      setError(`Conflito de horário com: ${conflict.title}`);
      return;
    }

    let finalFormData = { ...formData };

    // SYNC TO CALENDARS
    if (syncToGoogle) {
      if (formData.isRecurrent && !formData.recurrenceUntil) {
        setError('Por favor, defina até quando o evento deve se repetir.');
        return;
      }

      // Garantir que o título vá preenchido para o Google (usando nome do médico se necessário)
      const displayTitle = formData.title || formData.doctorName || 'Compromisso Médico';
      const syncTitle = formData.patientName ? `${formData.patientName} - ${displayTitle}` : displayTitle;

      const syncEvent = {
        ...formData,
        title: syncTitle
      };

      setIsSyncing(true);
      setError(null);
      console.log('Iniciando sincronização com calendários...', { syncToGoogle });
      try {
        const res = await fetch('/api/sync/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: syncEvent,
            platforms: { 
              google: syncToGoogle, 
              googleAccountEmail: selectedGoogleAccount,
              googleCalendarId: 'primary'
            }
          })
        });
        
        const syncResults = await res.json();
        console.log('Resultados da sincronização:', syncResults);

        if (syncResults.google?.status === 'success') {
          finalFormData = {
            ...finalFormData,
            googleEventId: syncResults.google.id,
            googleAccountEmail: selectedGoogleAccount
          };
        } else if (syncResults.google?.status === 'error') {
          console.error('Erro Google Sync:', syncResults.google.message);
        }
        if (syncResults.outlook?.status === 'error') {
          console.error('Erro Outlook Sync:', syncResults.outlook.message);
        }
      } catch (err) {
        console.error('Error syncing calendar:', err);
      } finally {
        setIsSyncing(false);
      }
    }
    
    onSave(finalFormData);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 w-full max-w-[98vw] 2xl:max-w-7xl rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Toolbar */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-1">
            <button 
              onClick={handleSave}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#0078d4] hover:bg-[#005a9e] disabled:bg-slate-400 text-white text-xs font-semibold rounded transition-colors"
            >
              {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar
            </button>
            <div className="w-px h-6 bg-slate-200 dark:border-slate-700 mx-1" />
            
            <div className="flex items-center gap-1">
              <button 
                onClick={() => authStatus.google ? setSyncToGoogle(!syncToGoogle) : handleConnect('google')}
                className={`flex items-center gap-1 px-1.5 py-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-all ${syncToGoogle ? 'bg-cyan-100 dark:bg-cyan-900/30' : ''}`}
                title="Sincronizar Google"
              >
                <div className={`w-2 h-2 rounded-full ${authStatus.google ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Google</span>
              </button>
              
              {syncToGoogle && authStatus.googleAccounts.length > 0 && (
                <div className="flex items-center gap-1 bg-cyan-50 dark:bg-cyan-900/10 px-1.5 py-0.5 rounded border border-cyan-500/10 max-w-[220px]">
                   <Users className="w-2.5 h-2.5 text-cyan-600 shrink-0" />
                   <select 
                    value={selectedGoogleAccount}
                    onChange={(e) => setSelectedGoogleAccount(e.target.value)}
                    className="bg-transparent text-[10px] font-bold text-cyan-700 dark:text-cyan-300 outline-none border-none p-0 cursor-pointer truncate"
                  >
                    {authStatus.googleAccounts.map(email => (
                      <option key={email} value={email} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        {email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            </div>

            <div className="w-px h-6 bg-slate-200 dark:border-slate-700 mx-1" />
            
            <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer group">
              <input 
                type="checkbox" 
                checked={isCompleted} 
                onChange={() => setIsCompleted(!isCompleted)}
                className="w-3.5 h-3.5 text-[#22c55e] border-slate-300 rounded focus:ring-0 transition-all"
              />
              <span className={`text-[10px] font-bold uppercase tracking-tight transition-colors ${isCompleted ? 'text-[#22c55e]' : 'text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'}`}>
                {isCompleted ? 'Concluído' : 'Concluir'}
              </span>
            </label>

            <div className="w-px h-6 bg-slate-200 dark:border-slate-700 mx-1" />
            <button 
              onClick={() => setFormData({...formData, isRecurrent: false})}
              className={`flex items-center gap-2 px-3 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium rounded transition-colors ${!formData.isRecurrent ? 'bg-slate-200 dark:bg-slate-800 ring-1 ring-[#0078d4]/30' : ''}`}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-[#0078d4]" />
              Evento
            </button>
            
            <div className="relative">
              <button 
                onClick={() => {
                  setShowRecurrencePicker(!showRecurrencePicker);
                  setShowColorPicker(false);
                  setShowReminderPicker(false);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium rounded transition-colors ${formData.isRecurrent ? 'bg-slate-200 dark:bg-slate-800 ring-1 ring-[#0078d4]/30' : ''}`}
              >
                <Repeat className="w-3.5 h-3.5 text-[#0078d4]" />
                Recorrência
              </button>
              <AnimatePresence>
                {showRecurrencePicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowRecurrencePicker(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 w-48"
                    >
                      <button 
                        onClick={() => { setFormData({...formData, isRecurrent: false}); setShowRecurrencePicker(false); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300"
                      >
                        Não se repete
                      </button>
                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                      {RECURRENCE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setFormData({...formData, isRecurrent: true, recurrenceType: opt.value as any});
                            setShowRecurrencePicker(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center justify-between ${formData.isRecurrent && formData.recurrenceType === opt.value ? 'text-[#0078d4] font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="w-px h-6 bg-slate-200 dark:border-slate-700 mx-1" />
            <button 
              onClick={() => setFormData({...formData, status: formData.status === 'busy' ? 'free' : 'busy'})}
              className={`flex items-center gap-2 px-3 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium rounded transition-colors ${formData.status === 'busy' ? 'bg-slate-200 dark:bg-slate-800 ring-1 ring-[#0078d4]/30' : ''}`}
            >
              <Briefcase className="w-3.5 h-3.5 text-[#0078d4]" />
              {formData.status === 'busy' ? 'Ocupado' : 'Livre'}
            </button>

            <div className="relative">
              <button 
                onClick={() => {
                  setShowReminderPicker(!showReminderPicker);
                  setShowColorPicker(false);
                  setShowRecurrencePicker(false);
                }}
                className={`p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors ${formData.hasReminder ? 'text-[#0078d4] bg-slate-200 dark:bg-slate-800' : 'text-slate-500'}`}
              >
                <Bell className="w-3.5 h-3.5" />
              </button>
              <AnimatePresence>
                {showReminderPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowReminderPicker(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 mt-1 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 w-64 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase">Lembrete</span>
                        <button 
                          onClick={() => { setFormData({...formData, hasReminder: !formData.hasReminder}); }}
                          className={`text-[10px] px-2 py-0.5 rounded ${formData.hasReminder ? 'bg-cyan-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                        >
                          {formData.hasReminder ? 'Ativado' : 'Desativado'}
                        </button>
                      </div>
                      
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          min="0"
                          value={formData.reminderValue}
                          onChange={e => setFormData({...formData, reminderValue: parseInt(e.target.value) || 0, hasReminder: true})}
                          className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-cyan-500"
                        />
                        <select 
                          value={formData.reminderUnit}
                          onChange={e => setFormData({...formData, reminderUnit: e.target.value, hasReminder: true})}
                          className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-cyan-500"
                        >
                          {REMINDER_UNITS.map(unit => (
                            <option key={unit.value} value={unit.value}>{unit.label}</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[10px] text-slate-400 italic">Avisar antes do compromisso.</p>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => {
                  setShowColorPicker(!showColorPicker);
                  setShowReminderPicker(false);
                  setShowRecurrencePicker(false);
                }}
                className={`flex items-center gap-1 px-1.5 py-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors ${showColorPicker ? 'text-[#0078d4] bg-slate-200 dark:bg-slate-800' : 'text-slate-500'}`}
              >
                <Tag className="w-3.5 h-3.5" />
                <ChevronDown className="w-2.5 h-2.5 opacity-50" />
              </button>
              
              <AnimatePresence>
                {showColorPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 w-44"
                    >
                      <div className="p-2 space-y-0.5">
                          {principalCategories.map((cat) => (
                            <button
                              key={cat.name}
                              onMouseEnter={() => setShowAllCategoriesSubmenu(false)}
                              onClick={() => {
                                setFormData({...formData, category: cat.name, color: cat.color});
                                setShowColorPicker(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors group"
                            >
                              <Tag className={`w-4 h-4 ${getEventStyles(cat.color).text} fill-none stroke-[2px]`} />
                              <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white truncate">{cat.name}</span>
                              {formData.category === cat.name && <div className={`ml-auto w-1.5 h-1.5 ${cat.color} rounded-full`} />}
                            </button>
                          ))}
                      </div>
                      <div className="h-px bg-slate-100 dark:bg-slate-800" />
                      <div className="p-1">
                        <button 
                          onMouseEnter={() => setShowAllCategoriesSubmenu(false)}
                          onClick={() => { setIsNewCategoryModalOpen(true); }}
                          className="w-full text-left px-4 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"
                        >
                          Nova categoria
                        </button>
                        <div className="relative group/all">
                          <button 
                            onMouseEnter={() => setShowAllCategoriesSubmenu(true)}
                            className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"
                          >
                            Todas as categorias
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          
                          <AnimatePresence>
                            {showAllCategoriesSubmenu && (
                              <motion.div 
                                onMouseLeave={() => setShowAllCategoriesSubmenu(false)}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="absolute left-full top-0 ml-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 w-64 p-2 max-h-80 overflow-y-auto"
                              >
                                {allCategoriesList.map(cat => (
                                  <button
                                    key={cat.name}
                                    onClick={() => {
                                      setFormData({...formData, category: cat.name, color: cat.color});
                                      setShowColorPicker(false);
                                      setShowAllCategoriesSubmenu(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors group"
                                  >
                                    <Tag className={`w-4 h-4 ${getEventStyles(cat.color).text} fill-none stroke-[2px]`} />
                                    <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">{cat.name}</span>
                                    {formData.category === cat.name && <div className={`ml-auto w-1.5 h-1.5 ${cat.color} rounded-full`} />}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <button 
                          onMouseEnter={() => setShowAllCategoriesSubmenu(false)}
                          onClick={() => { setIsManageCategoriesModalOpen(true); setShowColorPicker(false); }}
                          className="w-full text-left px-4 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"
                        >
                          Gerenciar Categorias
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => setFormData({...formData, isPrivate: !formData.isPrivate})}
              className={`p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors ${formData.isPrivate ? 'text-[#0078d4] bg-slate-200 dark:bg-slate-800' : 'text-slate-500'}`}
              title="Privado"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>

            <button 
              disabled={!formData.senderEmail || !formData.recipientEmail || isSendingEmail}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${(formData.senderEmail && formData.recipientEmail && !isSendingEmail)
                  ? 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-md shadow-cyan-500/20' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'}
              `}
              onClick={handleSendEmail}
            >
              {isSendingEmail ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Mail className="w-3.5 h-3.5" />
              )}
              {isSendingEmail ? 'Enviando...' : 'Enviar'}
            </button>

            {!isNew && onDelete && (
              <>
                <div className="w-px h-6 bg-slate-200 dark:border-slate-700 mx-1" />
                <button 
                  onClick={() => formData.id && onDelete(formData.id)}
                  className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded transition-colors text-rose-500"
                  title="Excluir compromisso"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-900/20 border-b border-rose-200 dark:border-rose-800/50 px-4 py-2 flex items-center justify-between">
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600"><X className="w-3 h-3" /></button>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Left Column: Form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 border-r border-slate-200 dark:border-slate-800 scrollbar-hide">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center shrink-0 mt-1">
                <div className={`w-3 h-3 rounded-full ${formData.color || 'bg-blue-500'}`} />
              </div>
              <div className="flex-1 space-y-4">
                {/* Title Split: Doctor & Specialty */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative group">
                    <input 
                      type="text" 
                      list="doctors-list"
                      value={formData.doctorName || ''} 
                      onChange={e => setFormData({...formData, doctorName: e.target.value})}
                      className="w-full bg-transparent border-b border-slate-200 dark:border-slate-800 py-1 text-xl font-medium text-slate-900 dark:text-white focus:border-[#0078d4] outline-none placeholder:text-slate-400"
                      placeholder="Nome do Médico"
                    />
                    <div className="absolute left-0 bottom-[-1px] w-0 h-0.5 bg-[#0078d4] transition-all group-focus-within:w-full" />
                    <datalist id="doctors-list">
                      {suggestions.doctors.map(d => <option key={d} value={d} />)}
                    </datalist>
                  </div>
                  <div className="relative group">
                    <input 
                      type="text" 
                      list="specialties-list"
                      value={formData.specialty || ''} 
                      onChange={e => setFormData({...formData, specialty: e.target.value})}
                      className="w-full bg-transparent border-b border-slate-200 dark:border-slate-800 py-1 text-xl font-medium text-slate-900 dark:text-white focus:border-[#0078d4] outline-none placeholder:text-slate-400"
                      placeholder="Especialidade"
                    />
                    <div className="absolute left-0 bottom-[-1px] w-0 h-0.5 bg-[#0078d4] transition-all group-focus-within:w-full" />
                    <datalist id="specialties-list">
                      {suggestions.specialties.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                </div>

                {/* Attendees */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 group">
                    <Users className="w-5 h-5 text-slate-400 group-focus-within:text-[#0078d4]" />
                    <input 
                      type="text" 
                      list="patients-list"
                      value={formData.patientName || ''} 
                      onChange={e => setFormData({...formData, patientName: e.target.value})}
                      className="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-800 py-1 text-sm text-slate-700 dark:text-slate-300 focus:border-[#0078d4] outline-none placeholder:text-slate-400"
                      placeholder="Nome do Paciente"
                    />
                    <datalist id="patients-list">
                      {suggestions.patients.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                  <div className="flex items-center gap-3 group ml-8">
                    <input 
                      type="text" 
                      list="responsibles-list"
                      value={formData.responsibleName || ''} 
                      onChange={e => setFormData({...formData, responsibleName: e.target.value})}
                      className="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-800 py-1 text-sm text-slate-700 dark:text-slate-300 focus:border-[#0078d4] outline-none placeholder:text-slate-400"
                      placeholder="Nome do Responsável"
                    />
                    <datalist id="responsibles-list">
                      {suggestions.responsibles.map(r => <option key={r} value={r} />)}
                    </datalist>
                  </div>
                </div>

                {/* Emails */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 group">
                    <Type className="w-5 h-5 text-slate-400 group-focus-within:text-[#0078d4]" />
                    <input 
                      type="email" 
                      list="senders-list"
                      value={formData.senderEmail || ''} 
                      onChange={e => setFormData({...formData, senderEmail: e.target.value})}
                      className="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-800 py-1 text-sm text-slate-700 dark:text-slate-300 focus:border-[#0078d4] outline-none placeholder:text-slate-400"
                      placeholder="E-mail do Emitente"
                    />
                    <datalist id="senders-list">
                      {registeredSenders.map(e => <option key={e} value={e} />)}
                    </datalist>
                  </div>
                  <div className="flex items-center gap-3 group">
                    <Type className="w-5 h-5 text-slate-400 group-focus-within:text-[#0078d4]" />
                    <input 
                      type="email" 
                      list="recipients-list"
                      value={formData.recipientEmail || ''} 
                      onChange={e => setFormData({...formData, recipientEmail: e.target.value})}
                      className="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-800 py-1 text-sm text-slate-700 dark:text-slate-300 focus:border-[#0078d4] outline-none placeholder:text-slate-400"
                      placeholder="E-mail do Destinatário"
                    />
                    <datalist id="recipients-list">
                      {suggestions.recipients.map(e => <option key={e} value={e} />)}
                    </datalist>
                  </div>
                </div>

                {formData.emailSent && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-lg w-fit"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">E-mail enviado</span>
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-500">
                        Destinatário: <strong>{formData.lastRecipientEmail}</strong> • {formData.lastEmailSentAt ? format(parseISO(formData.lastEmailSentAt), "dd/MM 'às' HH:mm", { locale: ptBR }) : ''}
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Modern Scheduler Block */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Agendamento Profissional</h4>
                    <div className="flex items-center gap-2">
                       <button 
                         onClick={() => {
                           const now = new Date();
                           const start = format(now, "yyyy-MM-dd'T'HH:mm");
                           const end = format(addHours(now, 1), "yyyy-MM-dd'T'HH:mm");
                           setFormData({...formData, start, end});
                         }}
                         className="text-[9px] font-black uppercase text-cyan-600 hover:text-cyan-500 transition-colors"
                       >
                         Agora
                       </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Start Selection */}
                    <ModernDateTimePicker 
                      label="Início do Compromisso"
                      icon={CalendarIcon}
                      value={formData.start as string}
                      onChange={(val) => {
                        setFormData({...formData, start: val});
                        if (val) setPreviewDate(parseISO(val));
                      }}
                    />
                    {/* End Selection */}
                    <ModernDateTimePicker 
                      label="Término Previsto"
                      icon={Clock}
                      value={formData.end as string}
                      onChange={(val) => setFormData({...formData, end: val})}
                    />
                  </div>

                  {formData.isRecurrent && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-xl border border-cyan-500/20"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-3 h-3 text-cyan-500" />
                        <p className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-widest leading-none mt-0.5">Série Recorrente</p>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 italic">{recurrenceText}</p>
                      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Finalizar em:</span>
                        <input 
                          type="date" 
                          value={formData.recurrenceUntil || ''}
                          onChange={e => setFormData({...formData, recurrenceUntil: e.target.value})}
                          className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none text-right"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Location & Contact */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 group">
                    <MapPin className="w-5 h-5 text-slate-400 group-focus-within:text-[#0078d4]" />
                    <div className="flex-1 flex gap-2">
                      <input 
                        type="text" 
                        value={formData.cep || ''} 
                        onChange={e => handleCEPLookup(e.target.value)}
                        className="w-20 bg-transparent border-b border-slate-200 dark:border-slate-800 py-1 text-sm text-slate-700 dark:text-slate-300 focus:border-[#0078d4] outline-none placeholder:text-slate-400"
                        placeholder="CEP"
                        maxLength={9}
                      />
                      <input 
                        type="text" 
                        value={formData.numero || ''} 
                        onChange={e => setFormData({...formData, numero: e.target.value})}
                        className="w-16 bg-transparent border-b border-slate-200 dark:border-slate-800 py-1 text-sm text-slate-700 dark:text-slate-300 focus:border-[#0078d4] outline-none placeholder:text-slate-400"
                        placeholder="Nº"
                      />
                      <input 
                        type="text" 
                        value={formData.address || ''} 
                        onChange={e => setFormData({...formData, address: e.target.value})}
                        className="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-800 py-1 text-sm text-slate-700 dark:text-slate-300 focus:border-[#0078d4] outline-none placeholder:text-slate-400"
                        placeholder="Endereço completo"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 group">
                    <Phone className="w-5 h-5 text-slate-400 group-focus-within:text-[#0078d4]" />
                    <input 
                      type="tel" 
                      value={formData.phone || ''} 
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-800 py-1 text-sm text-slate-700 dark:text-slate-300 focus:border-[#0078d4] outline-none placeholder:text-slate-400"
                      placeholder="Telefone de contato"
                    />
                  </div>
                  
                  {(formData.logradouro || formData.cidade) && (
                    <div className="ml-8 grid grid-cols-2 gap-4">
                      <input 
                        type="text" 
                        value={formData.logradouro || ''} 
                        readOnly
                        className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-xs text-slate-500 outline-none"
                        placeholder="Logradouro"
                      />
                      <input 
                        type="text" 
                        value={formData.cidade || ''} 
                        readOnly
                        className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-xs text-slate-500 outline-none"
                        placeholder="Cidade"
                      />
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="flex flex-col min-h-[250px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-1 p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex-wrap">
                    <button onClick={() => execCommand('bold')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"><Bold className="w-3.5 h-3.5" /></button>
                    <button onClick={() => execCommand('italic')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"><Italic className="w-3.5 h-3.5" /></button>
                    <button onClick={() => execCommand('underline')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"><Underline className="w-3.5 h-3.5" /></button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                    <button onClick={() => execCommand('insertUnorderedList')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"><List className="w-3.5 h-3.5" /></button>
                    <div className="relative group/color">
                      <button 
                        type="button"
                        onClick={(e) => {
                          const menu = e.currentTarget.nextElementSibling;
                          if (menu) menu.classList.toggle('hidden');
                        }}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 flex items-center gap-1"
                      >
                        <Palette className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute top-full left-0 mt-1 hidden grid grid-cols-4 gap-2 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[110] w-40">
                        {['#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#ec4899', '#64748b', '#06b6d4', '#10b981', '#f59e0b', '#6366f1'].map(c => (
                          <button 
                            key={c} 
                            type="button"
                            onClick={(e) => {
                              execCommand('foreColor', c);
                              e.currentTarget.parentElement?.classList.add('hidden');
                            }} 
                            className="w-6 h-6 rounded-full border border-slate-200 hover:scale-125 transition-all shadow-sm ring-offset-2 hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-600" 
                            style={{ backgroundColor: c }} 
                          />
                        ))}
                      </div>
                    </div>
                    <button onClick={() => imageInputRef.current?.click()} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"><ImageIcon className="w-3.5 h-3.5" /></button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"><Paperclip className="w-3.5 h-3.5" /></button>
                    
                    <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'image')} />
                    <input type="file" ref={fileInputRef} className="hidden" onChange={e => handleFileChange(e, 'file')} />
                  </div>
                  <div 
                    ref={editorRef}
                    contentEditable
                    onInput={() => {
                      isTypingRef.current = true;
                      setFormData(prev => ({ ...prev, description: editorRef.current?.innerHTML || '' }));
                      setTimeout(() => { isTypingRef.current = false; }, 100);
                    }}
                    onBlur={() => { isTypingRef.current = false; }}
                    className="flex-1 w-full p-4 bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none min-h-[180px] overflow-y-auto"
                  />
                </div>

                {/* Address & CEP Search Tool */}
                <APIProvider apiKey={MAPS_API_KEY} version="weekly">
                  <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Localizador Inteligente (CEP & Endereço)</h4>
                      <MapPin className="w-3 h-3 text-slate-400" />
                    </div>
                    <CEPSearch 
                      onSelect={(cep, address) => {
                        setFormData(prev => ({ 
                          ...prev, 
                          cep, 
                          address,
                          logradouro: address.split(',')[0] || '',
                          cidade: address.split(',').length > 2 ? address.split(',')[2]?.trim() : address.split(',')[1]?.trim() || ''
                        }));
                      }} 
                    />
                    {formData.cep && (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800/50 rounded-lg w-fit"
                      >
                        <CheckCircle2 className="w-3 h-3 text-cyan-500" />
                        <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400">
                          CEP Encontrado: <span className="font-black underline">{formData.cep}</span>
                        </span>
                      </motion.div>
                    )}
                  </div>
                </APIProvider>

                {/* Attachments List */}
                {formData.attachments && formData.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Anexos</p>
                    <div className="flex flex-wrap gap-2">
                      {formData.attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 group/file">
                          {file.type.startsWith('image/') ? (
                            <div className="relative w-8 h-8 rounded overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                              <img src={file.url} alt={file.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          ) : (
                            <Paperclip className="w-3 h-3 shrink-0" />
                          )}
                          <span className="truncate max-w-[150px]">{file.name}</span>
                          <button 
                            onClick={() => {
                              const newAttachments = [...(formData.attachments || [])];
                              newAttachments.splice(idx, 1);
                              setFormData({...formData, attachments: newAttachments});
                            }}
                            className="ml-auto p-1 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded text-rose-500 opacity-0 group-hover/file:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Day Preview */}
          <div className="w-72 bg-slate-50/30 dark:bg-slate-900/20 flex flex-col overflow-hidden shrink-0">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <ChevronLeft 
                  className="w-4 h-4 cursor-pointer hover:text-[#0078d4]" 
                  onClick={() => setPreviewDate(subDays(previewDate, 1))}
                />
                <CalendarIcon className="w-4 h-4 text-[#0078d4]" />
                <ChevronRight 
                  className="w-4 h-4 cursor-pointer hover:text-[#0078d4]" 
                  onClick={() => setPreviewDate(addDays(previewDate, 1))}
                />
                <span className="capitalize whitespace-nowrap overflow-hidden text-ellipsis">{format(previewDate, "EEE, d MMM, yyyy", { locale: ptBR })}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 relative scrollbar-hide">
              {hours.map((hour, i) => (
                <div 
                  key={i} 
                  onClick={() => handlePreviewSlotClick(hour)}
                  className="flex h-12 border-b border-slate-100 dark:border-slate-800/50 relative cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <span className="w-8 text-[10px] text-slate-400 mt-[-6px]">{format(hour, 'HH')}</span>
                  <div className="flex-1" />
                </div>
              ))}
              {/* Current Event Preview Block */}
              {formData.start && formData.end && !isNaN(parseISO(formData.start as string).getTime()) && !isNaN(parseISO(formData.end as string).getTime()) && isSameDay(parseISO(formData.start as string), previewDate) && (() => {
                const styles = getEventStyles(formData.color || 'bg-blue-500');
                return (
                  <div 
                    className={`absolute left-10 right-2 rounded border-l-4 ${styles.border} ${styles.bg} ${styles.text} p-2 shadow-sm overflow-hidden pointer-events-none`}
                    style={{
                      top: `${(parseISO(formData.start as string).getHours() * 48) + (parseISO(formData.start as string).getMinutes() * 48 / 60) + 8}px`,
                      height: `${(parseISO(formData.end as string).getTime() - parseISO(formData.start as string).getTime()) / (1000 * 60 * 60) * 48}px`
                    }}
                  >
                    <p className="text-[10px] font-bold truncate">{formData.title || '(Sem título)'}</p>
                    <p className="text-[9px] opacity-80">
                      {format(parseISO(formData.start as string), 'HH:mm')} - {format(parseISO(formData.end as string), 'HH:mm')}
                    </p>
                  </div>
                );
              })()}
              
              {/* Other Events Preview */}
              {allEvents.filter(e => e.id !== formData.id && isSameDay(parseISO(e.start), previewDate)).map(event => {
                const start = parseISO(event.start);
                const end = parseISO(event.end);
                const styles = getEventStyles(event.color);
                return (
                  <div 
                    key={event.id}
                    className={`absolute left-10 right-2 rounded border-l-2 ${styles.border} ${styles.bg} ${styles.text} opacity-40 p-1 overflow-hidden pointer-events-none`}
                    style={{
                      top: `${(start.getHours() * 48) + (start.getMinutes() * 48 / 60) + 8}px`,
                      height: `${(end.getTime() - start.getTime()) / (1000 * 60 * 60) * 48}px`
                    }}
                  >
                    <p className="text-[8px] font-medium truncate">{event.title}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <AnimatePresence>
            {isNewCategoryModalOpen && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 w-full max-w-[320px] rounded-2xl p-4 shadow-[0_32px_64px_rgba(0,0,0,0.2)] space-y-3"
                >
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingCategory ? 'Editar categoria' : 'Criar nova categoria'}
                  </h3>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">Nome</label>
                    <div className="relative group">
                      <input 
                        type="text"
                        placeholder="Nomeie sua categoria"
                        autoFocus
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#0078d4] dark:focus:border-[#0078d4] transition-all pr-8 shadow-inner"
                      />
                      <Star className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-focus-within:text-[#ecc94b] transition-colors" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">Cor</label>
                    <div className="grid grid-cols-7 gap-1">
                      {CATEGORY_PALETTE.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewCategoryColor(color)}
                          className={`w-6.5 h-6.5 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm ${color} ${newCategoryColor === color ? 'ring-2 ring-offset-2 ring-[#0078d4] dark:ring-offset-[#0b1120] scale-110' : 'opacity-80 hover:opacity-100'}`}
                        >
                          <span className="text-[8px] font-black text-white drop-shadow-md">A</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">Atalho (opcional)</label>
                    <div className="relative">
                      <select className="w-full appearance-none bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#0078d4] dark:focus:border-[#0078d4] transition-all text-slate-700 dark:text-slate-200 shadow-inner">
                        {SHORTCUT_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button 
                      onClick={() => { setIsNewCategoryModalOpen(false); setEditingCategory(null); setNewCategoryName(''); }}
                      className="px-4 py-1.5 dark:text-slate-300 text-slate-600 text-[11px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={() => handleCreateCategory()}
                      disabled={!newCategoryName.trim()}
                      className="px-6 py-1.5 bg-[#0078d4] hover:bg-[#005a9e] text-white rounded-lg text-[11px] font-bold shadow-lg shadow-[#0078d4]/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                    >
                      {editingCategory ? 'Salvar' : 'Criar'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Sub-modal: Manage Categories (Gerenciar Categorias) */}
          <AnimatePresence>
            {isManageCategoriesModalOpen && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 w-full max-w-[320px] rounded-2xl p-4 shadow-[0_32px_64px_rgba(0,0,0,0.2)] flex flex-col max-h-[70vh]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Gerenciar Categorias</h3>
                    <button onClick={() => setIsManageCategoriesModalOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-hide mb-3 px-1">
                    {categories.map((cat) => {
                      const styles = getEventStyles(cat.color);
                      return (
                        <div 
                          key={cat.name}
                          className="group flex items-center justify-between p-1.5 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-3 h-3 rounded-full ${cat.color} ring-1 ring-black/10 dark:ring-white/10 shadow-sm`} />
                            <div>
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px] block">{cat.name}</span>
                              <span className={`text-[9px] font-black uppercase tracking-tighter ${styles.text} opacity-70`}>{cat.isPrincipal ? 'Principal' : 'Secundária'}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                               onClick={() => handleEditCategory(cat)}
                               title="Editar"
                               className="p-1 rounded-md text-slate-400 hover:text-[#0078d4] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                               <Edit2 className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => toggleCategoryPrincipal(cat.name)}
                              title={cat.isPrincipal ? "Remover dos principais" : "Marcar como principal"}
                              className={`p-1 rounded-md transition-colors ${cat.isPrincipal ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                              <Star className={`w-3 h-3 ${cat.isPrincipal ? 'fill-current' : ''}`} />
                            </button>
                            <button 
                              onClick={() => deleteCategory(cat.name)}
                              title="Excluir"
                              className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                    <button 
                      onClick={() => { setIsManageCategoriesModalOpen(false); setIsNewCategoryModalOpen(true); }}
                      className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold transition-all"
                    >
                      Nova categoria
                    </button>
                    <button 
                      onClick={() => setIsManageCategoriesModalOpen(false)}
                      className="flex-1 py-1.5 bg-[#0078d4] hover:bg-[#005a9e] text-white rounded-lg text-[11px] font-bold shadow-lg shadow-[#0078d4]/20 transition-all"
                    >
                      Concluído
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showSuccessToast && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: 20 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 bg-emerald-500 text-white rounded-xl shadow-[0_20px_40px_rgba(16,185,129,0.3)] border border-emerald-400/20"
            >
              <div className="bg-white/20 p-1 rounded-full">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold">Sucesso!</span>
                <span className="text-[11px] opacity-90">O e-mail foi enviado com sucesso.</span>
              </div>
              <button 
                onClick={() => setShowSuccessToast(false)}
                className="ml-4 p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

/* Color Safelist to prevent Tailwind from purging dynamically used colors */
const ColorSafelist = () => {
  const baseColors = [
    'red-500', 'red-200', 'orange-200', 'orange-400', 'orange-300', 'yellow-400', 'yellow-100', 'stone-400', 'stone-100', 'lime-200', 'lime-400', 'green-400', 'green-600', 'cyan-200', 'cyan-400', 'cyan-600', 'sky-200', 'sky-400', 'blue-200', 'indigo-300', 'purple-300', 'pink-200', 'fuchsia-400', 'slate-200', 'slate-400', 'slate-600', 'gray-300', 'amber-500', 'emerald-500', 'blue-500', 'cyan-500', 'purple-500', 'yellow-500', 'violet-500', 'rose-500', 'teal-500', 'indigo-500'
  ];
  
  return (
    <div className="hidden">
      {baseColors.map((c, i) => (
        <React.Fragment key={i}>
          <div className={`bg-${c} bg-${c}/10 bg-${c}/20 bg-${c}/30 bg-${c}/40 bg-${c}/50`} />
          <div className={`dark:bg-${c}/20 dark:bg-${c}/30`} />
          <div className={`text-${c.split('-')[0]}-700 text-${c.split('-')[0]}-300 text-${c.split('-')[0]}-600`} />
          <div className={`border-${c}`} />
        </React.Fragment>
      ))}
    </div>
  );
};

export default function Agenda({ initialEvent, onClearInitialEvent }: { initialEvent?: any, onClearInitialEvent?: () => void }) {
  const { mapsKey } = useConfig();
  const MAPS_API_KEY = mapsKey || DEFAULT_MAPS_KEY;
  const hasValidMapsKey = Boolean(mapsKey);
  return (
    <>
      <ColorSafelist />
      <AgendaContent initialEvent={initialEvent} onClearInitialEvent={onClearInitialEvent} />
    </>
  );
}

function AgendaContent({ initialEvent, onClearInitialEvent }: { initialEvent?: any, onClearInitialEvent?: () => void }) {
  const { user, isAuthReady } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('month');
  const [activeCalendars, setActiveCalendars] = useState<string[]>(() => {
    const saved = localStorage.getItem('managedCategories');
    if (saved) {
      return JSON.parse(saved).map((c: any) => c.name);
    }
    return CATEGORIES.map(c => c.name);
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Partial<Event> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMainPicker, setShowMainPicker] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string | number, event: any } | null>(null);
  const [saveConfirmation, setSaveConfirmation] = useState<any | null>(null);

  // Handle initial event from reminders
  useEffect(() => {
    if (initialEvent) {
      setSelectedEvent(initialEvent);
      setIsModalOpen(true);
      if (onClearInitialEvent) onClearInitialEvent();
    }
  }, [initialEvent, onClearInitialEvent]);
  const [managedCategories, setManagedCategories] = useState<any[]>(() => {
    const saved = localStorage.getItem('managedCategories');
    if (saved) {
      // Ensure we always have the requested principal categories marked correctly
      const parsed = JSON.parse(saved);
      return parsed.map((c: any) => ({
        ...c,
        isPrincipal: ['Médico', 'Particular', 'Trabalho', 'Pessoal'].includes(c.name)
      }));
    }
    return CATEGORIES.map((c) => ({ 
      ...c, 
      isPrincipal: ['Médico', 'Particular', 'Trabalho', 'Pessoal'].includes(c.name) 
    }));
  });

  useEffect(() => {
    localStorage.setItem('managedCategories', JSON.stringify(managedCategories));
  }, [managedCategories]);
  const [hoveredEvent, setHoveredEvent] = useState<{ 
    event: Event, 
    x: number, 
    y: number, 
    onRightSide: boolean,
    onBottomHalf: boolean,
    onTopHalf: boolean
  } | null>(null);

  const handleMouseEnter = (e: React.MouseEvent, event: Event) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Se o item estiver muito para a direita (sidebar), use o lado esquerdo
    const onRightSide = rect.right > viewportWidth - 320; 
    const onBottomHalf = rect.top > viewportHeight * 0.5;
    const onTopHalf = rect.top < viewportHeight * 0.4;
    
    setHoveredEvent({
      event,
      x: onRightSide ? rect.left - 12 : rect.left + rect.width / 2,
      y: onRightSide ? rect.top + rect.height / 2 : (onTopHalf ? rect.bottom : rect.top),
      onRightSide,
      onBottomHalf,
      onTopHalf
    });
  };

  const handleMouseLeave = () => {
    setHoveredEvent(null);
  };

  // Firestore Subscription
  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }

    const q = query(collection(db, 'events'), where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEvents = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Event[];
      setEvents(fetchedEvents);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    return unsubscribe;
  }, [user]);

  const handlePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const lastScrollTime = useRef(0);
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    // Cooldown de 400ms para evitar que mude vários meses com um único scroll rápido
    if (now - lastScrollTime.current < 400) return;

    if (Math.abs(e.deltaY) > 30) { // Threshold de sensibilidade
      if (e.deltaY > 0) {
        handleNext();
      } else {
        handlePrev();
      }
      lastScrollTime.current = now;
    }
  };

  const handleNewEvent = () => {
    const now = new Date();
    const start = setMinutes(setHours(selectedDate, now.getHours()), 0);
    setSelectedEvent({
      start: format(start, "yyyy-MM-dd'T'HH:mm"),
      end: format(addHours(start, 1), "yyyy-MM-dd'T'HH:mm"),
      category: 'Trabalho',
      color: 'bg-blue-500',
      isRecurrent: false
    });
    setIsModalOpen(true);
  };

  const handleSlotClick = (date: Date) => {
    setSelectedEvent({
      start: format(date, "yyyy-MM-dd'T'HH:mm"),
      end: format(addHours(date, 1), "yyyy-MM-dd'T'HH:mm"),
      category: 'Trabalho',
      color: 'bg-blue-500',
      isRecurrent: false
    });
    setIsModalOpen(true);
  };

  const handleDeleteEvent = async (id: string | number) => {
    if (!user) return;
    const eventToDelete = events.find(e => e.id === id);
    if (!eventToDelete) return;
    
    setDeleteConfirmation({ id, event: eventToDelete });
  };

  const syncDeleteToGoogle = async (googleEventId: string, email: string) => {
    try {
      console.log('Solicitando exclusão no Google:', { googleEventId, email });
      const res = await fetch('/api/sync/calendar/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleEventId, email })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro desconhecido ao deletar no Google');
      }
      console.log('Exclusão no Google concluída com sucesso');
    } catch (err) {
      console.error('Erro ao sincronizar exclusão com o Google:', err);
      // Não bloqueia a exclusão local, mas avisa no log
    }
  };

  const executeDeletion = async (id: string | number) => {
    try {
      const eventToDelete = events.find(e => e.id === id);
      console.log('Iniciando exclusão local:', id, eventToDelete);
      
      if (eventToDelete?.googleEventId && eventToDelete?.googleAccountEmail) {
        await syncDeleteToGoogle(eventToDelete.googleEventId, eventToDelete.googleAccountEmail);
      } else {
        console.log('Evento não possui vínculo com Google Calendar para exclusão sincronizada.');
      }
      
      await deleteDoc(doc(db, 'events', String(id)));
      
      if (user) {
        logActivity({
          userId: user.uid,
          userName: user.displayName || 'Usuário',
          action: 'Evento Excluído',
          details: eventToDelete?.title || `ID: ${id}`,
          type: 'event'
        });
      }

      setIsModalOpen(false);
      setSelectedEvent(null);
      setDeleteConfirmation(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${id}`);
    }
  };

  const handleConfirmDelete = async (type: 'single' | 'series', id: string | number, event: any) => {
    if (type === 'series') {
      try {
        console.log('Iniciando exclusão de SÉRIE:', event);
        
        const groupId = event.recurrenceGroupId;
        let eventsToDelete = [];

        if (groupId) {
          eventsToDelete = events.filter(e => e.recurrenceGroupId === groupId);
        } else {
          eventsToDelete = events.filter(e => 
            e.userId === user?.uid && 
            e.title === event.title && 
            e.doctorName === event.doctorName &&
            e.isRecurrent
          );
        }

        // NOVO: Extrair IDs únicos do Google para não mandar 50 deletes duplicados (causando 410/404 errors) da mesma série
        const uniqueGoogleEvents = new Map();
        eventsToDelete.forEach(e => {
          if (e.googleEventId && e.googleAccountEmail) {
            uniqueGoogleEvents.set(e.googleEventId, e.googleAccountEmail);
          }
        });

        const googleDeletes = Array.from(uniqueGoogleEvents.entries()).map(([eventId, email]) => 
          syncDeleteToGoogle(eventId as string, email as string)
        );
        
        if (googleDeletes.length > 0) {
          console.log(`Deletando ${googleDeletes.length} eventos sincronizados do Google Calendar...`);
          await Promise.allSettled(googleDeletes);
        } else {
          console.log('Série não possui vínculo com Google Calendar para exclusão sincronizada.');
        }

        await Promise.all(eventsToDelete.map(e => deleteDoc(doc(db, 'events', String(e.id)))));
        setIsModalOpen(false);
        setSelectedEvent(null);
        setDeleteConfirmation(null);
        showSuccess('Excluído com sucesso!');
      } catch (error) {
        console.error('Error deleting series:', error);
        showError('Erro', 'Não foi possível excluir a série da agenda.');
      }
    } else {
      await executeDeletion(id);
      showSuccess('Excluído com sucesso!');
    }
  };

  const handleSaveEvent = async (eventData: any) => {
    if (!user) {
      signInWithGoogle();
      return;
    }

    if (!saveConfirmation) {
      setSaveConfirmation(eventData);
      return;
    }

    const start = parseISO(eventData.start);
    const end = parseISO(eventData.end);
    
    // Simplificando conflitos para recorrência (apenas no primeiro evento por enquanto)
    const conflict = events.find(e => {
      if (e.id === eventData.id) return false;
      const eStart = parseISO(e.start);
      const eEnd = parseISO(e.end);
      return (start < eEnd && end > eStart);
    });

    if (conflict) {
      showError('Conflito de Horário!', `Este horário se sobrepõe ao agendamento: "${conflict.title}".`);
      return;
    }

    const baseData = {
      ...eventData,
      userId: user.uid,
      updatedAt: new Date().toISOString()
    };

    try {
      if (eventData.id) {
        // Se estiver editando, apenas atualiza este (podemos expandir isso depois para 'esta e seguintes')
        const { id, ...updateData } = baseData;
        await updateDoc(doc(db, 'events', String(id)), updateData);

        logActivity({
          userId: user.uid,
          userName: user.displayName || 'Usuário',
          action: 'Evento Atualizado',
          details: updateData.title || 'Compromisso',
          type: 'event'
        });
        showSuccess('Atualizado com sucesso!');
      } else {
        // Novo Evento
        if (eventData.isRecurrent && eventData.recurrenceType && eventData.recurrenceUntil) {
          const untilDate = endOfDay(parseISO(eventData.recurrenceUntil));
          let currentStart = start;
          let currentEnd = end;
          const batch: any[] = [];
          const recurrenceGroupId = `${user.uid}-${Date.now()}`;
          
          while (currentStart <= untilDate && batch.length < 366) { // Limite de 366 ocorrências (1 ano)
            batch.push({
              ...baseData,
              recurrenceGroupId,
              title: baseData.title || baseData.doctorName || 'Compromisso Médico',
              start: format(currentStart, "yyyy-MM-dd'T'HH:mm"),
              end: format(currentEnd, "yyyy-MM-dd'T'HH:mm"),
              createdAt: new Date().toISOString()
            });
            
            if (eventData.recurrenceType === 'daily') {
              currentStart = addDays(currentStart, 1);
              currentEnd = addDays(currentEnd, 1);
            } else if (eventData.recurrenceType === 'weekly') {
              currentStart = addDays(currentStart, 7);
              currentEnd = addDays(currentEnd, 7);
            } else if (eventData.recurrenceType === 'monthly') {
              currentStart = addMonths(currentStart, 1);
              currentEnd = addMonths(currentEnd, 1);
            } else if (eventData.recurrenceType === 'yearly') {
              currentStart = addMonths(currentStart, 12);
              currentEnd = addMonths(currentEnd, 12);
            } else {
              break;
            }
          }
          
          // Usar Promise.all para salvar mais rápido
          await Promise.all(batch.map(ev => addDoc(collection(db, 'events'), ev)));
          
          logActivity({
            userId: user.uid,
            userName: user.displayName || 'Usuário',
            action: 'Eventos Recorrentes Criados',
            details: `${batch.length} ocorrências de: ${baseData.title}`,
            type: 'event'
          });
        } else {
          // Evento Único
          await addDoc(collection(db, 'events'), {
            ...baseData,
            title: baseData.title || baseData.doctorName || 'Compromisso Médico',
            createdAt: new Date().toISOString()
          });

          logActivity({
            userId: user.uid,
            userName: user.displayName || 'Usuário',
            action: 'Evento Criado',
            details: baseData.title || 'Compromisso Médico',
            type: 'event'
          });
        }
        
        showSuccess('Salvo com sucesso!');
      }

      // Garantir que a categoria do evento salvo esteja visível no calendário
      if (eventData.category && !activeCalendars.includes(eventData.category)) {
        setActiveCalendars(prev => [...prev, eventData.category]);
      }

      setIsModalOpen(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error saving event:', error);
      showError('Erro ao salvar', 'Ocorreu um erro no banco de dados. Tente novamente.');
      handleFirestoreError(error, OperationType.WRITE, 'events');
    }
  };

  const getEventStatus = (event: Event) => {
    if (event.isCompleted) return { label: 'Concluído', color: 'text-emerald-500' };
    const start = parseISO(event.start);
    if (start < new Date()) return { label: 'Atrasado', color: 'text-rose-500' };
    return { label: 'Pendente', color: 'text-amber-500' };
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const weekStart = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const START_HOUR = 7;

  const hours = eachHourOfInterval({
    start: setHours(startOfDay(currentDate), START_HOUR),
    end: endOfDay(currentDate)
  });

  return (
    <div className="flex h-full bg-slate-50 dark:bg-[#0f172a] overflow-hidden transition-colors duration-300">
      <AnimatePresence>
        {isModalOpen && (
          <EventModal 
            event={selectedEvent || {}} 
            isNew={!selectedEvent?.id}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSaveEvent}
            onDelete={handleDeleteEvent}
            allEvents={events}
            categories={managedCategories}
            setCategories={setManagedCategories}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirmation && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmation(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[480px] bg-white dark:bg-[#0b1120] rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              {/* Header like Caixa - Red for Deletion */}
              <div className="relative h-28 bg-red-50 dark:bg-red-500/10 p-6 flex flex-col justify-end">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-red-500 rounded-xl shadow-lg shadow-red-200 dark:shadow-none">
                      <Trash2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex gap-1">
                      <div className="w-1 h-3 bg-red-300/60 rounded-full" />
                      <div className="w-1 h-3 bg-red-400/80 rounded-full" />
                      <div className="w-1 h-3 bg-red-500 rounded-full" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-black text-red-900 dark:text-red-100 tracking-tight leading-none pt-2">
                    Excluir Registro
                  </h3>
                </div>

                <div className="absolute top-6 right-6 opacity-20 pointer-events-none text-red-500">
                  <AlertTriangle className="w-20 h-20 rotate-12" />
                </div>

                <button 
                  onClick={() => setDeleteConfirmation(null)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 transition-colors z-20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Card */}
              <div className="p-6 bg-white dark:bg-[#0b1120]">
                <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 p-8 text-center space-y-6 shadow-sm">
                  <div className="space-y-2">
                    <h4 className="text-xl font-black text-red-500 uppercase tracking-wider">
                      Deseja apagar esse registro?
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed px-4">
                      {deleteConfirmation.event.isRecurrent 
                        ? 'Este agendamento é recorrente. Escolha como deseja prosseguir com a exclusão.'
                        : 'Esta ação removerá permanentemente os dados do sistema e da agenda Google.'}
                    </p>
                  </div>

                  {deleteConfirmation.event.isRecurrent ? (
                    <div className="space-y-3 pt-2">
                      <button
                        onClick={async () => {
                          const { id, event } = deleteConfirmation;
                          setDeleteConfirmation(null);
                          await handleConfirmDelete('single', id, event);
                          setIsModalOpen(false);
                        }}
                        className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg shadow-red-100 dark:shadow-none transition-all active:scale-[0.98]"
                      >
                        Apenas este evento
                      </button>
                      <button
                        onClick={async () => {
                          const { id, event } = deleteConfirmation;
                          setDeleteConfirmation(null);
                          await handleConfirmDelete('series', id, event);
                          setIsModalOpen(false);
                        }}
                        className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg shadow-orange-100 dark:shadow-none transition-all active:scale-[0.98]"
                      >
                        Toda a recorrência
                      </button>
                      <button
                        onClick={() => setDeleteConfirmation(null)}
                        className="w-full py-4 bg-slate-50 dark:bg-slate-800 text-slate-500 font-black text-[11px] uppercase tracking-widest rounded-xl border border-slate-200 dark:border-slate-700 transition-all active:scale-[0.98]"
                      >
                        Não, Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <button
                        onClick={async () => {
                          const { id } = deleteConfirmation;
                          setDeleteConfirmation(null);
                          await executeDeletion(id);
                          showSuccess('Excluído com sucesso!');
                          setIsModalOpen(false);
                        }}
                        className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-95"
                      >
                        Sim, Excluir
                      </button>
                      <button
                        onClick={() => setDeleteConfirmation(null)}
                        className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95 border border-slate-100 dark:border-slate-700"
                      >
                        Não, Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {saveConfirmation && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSaveConfirmation(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[480px] bg-white dark:bg-[#0b1120] rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              {/* Header like Caixa */}
              <div className={`relative h-28 p-6 flex flex-col justify-end transition-colors duration-200 ${
                saveConfirmation.id 
                  ? "bg-blue-50 dark:bg-blue-500/10" 
                  : "bg-emerald-50 dark:bg-emerald-500/10"
              }`}>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-1">
                    <div className={`p-2 rounded-xl shadow-lg transition-colors duration-200 ${
                      saveConfirmation.id 
                        ? "bg-blue-500 shadow-blue-200 dark:shadow-none" 
                        : "bg-emerald-500 shadow-emerald-200 dark:shadow-none"
                    }`}>
                      {saveConfirmation.id ? (
                        <Edit2 className="w-5 h-5 text-white" />
                      ) : (
                        <CalendarIcon className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex gap-1">
                      <div className={`w-1 h-3 rounded-full transition-colors duration-200 ${saveConfirmation.id ? "bg-blue-300/60" : "bg-emerald-300/60"}`} />
                      <div className={`w-1 h-3 rounded-full transition-colors duration-200 ${saveConfirmation.id ? "bg-blue-400/80" : "bg-emerald-400/80"}`} />
                      <div className={`w-1 h-3 rounded-full transition-colors duration-200 ${saveConfirmation.id ? "bg-blue-500" : "bg-emerald-500"}`} />
                    </div>
                  </div>
                  <h3 className={`text-3xl font-black tracking-tight leading-none pt-2 transition-colors duration-200 ${
                    saveConfirmation.id 
                      ? "text-blue-900 dark:text-blue-100" 
                      : "text-emerald-900 dark:text-emerald-100"
                  }`}>
                    {saveConfirmation.id ? "Editar Evento" : "Novo Evento"}
                  </h3>
                </div>

                <div className={`absolute top-6 right-6 opacity-20 pointer-events-none transition-colors duration-200 ${
                  saveConfirmation.id ? "text-blue-500" : "text-emerald-500"
                }`}>
                  {saveConfirmation.id ? (
                    <Edit2 className="w-20 h-20 rotate-12" />
                  ) : (
                    <Plus className="w-20 h-20 rotate-45" />
                  )}
                </div>

                <button 
                  onClick={() => setSaveConfirmation(null)}
                  className={`absolute top-4 right-4 p-2 text-slate-400 transition-colors z-20 ${
                    saveConfirmation.id ? "hover:text-blue-500" : "hover:text-emerald-500"
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Card */}
              <div className="p-6 bg-white dark:bg-[#0b1120]">
                <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 p-8 text-center space-y-6 shadow-sm">
                  <div className="space-y-2">
                    <h4 className={`text-xl font-black uppercase tracking-wider ${
                      saveConfirmation.id ? "text-blue-500" : "text-emerald-500"
                    }`}>
                      {saveConfirmation.id ? "Confirmar Alterações?" : "Confirmar este agendamento?"}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                      {saveConfirmation.id 
                        ? "Esta ação registrará as alterações permanentemente na agenda do médico." 
                        : "Esta ação registrará os dados permanentemente na agenda do médico."}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button
                      onClick={() => {
                        const data = saveConfirmation;
                        setSaveConfirmation(null);
                        handleSaveEvent(data);
                        setIsModalOpen(false);
                      }}
                      className={`flex-1 py-4 text-white font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg dark:shadow-none ${
                        saveConfirmation.id 
                          ? "bg-blue-500 hover:bg-blue-600 shadow-blue-200 shadow-lg dark:shadow-none" 
                          : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200 shadow-lg dark:shadow-none"
                      }`}
                    >
                      Sim, Confirmar
                    </button>
                    <button
                      onClick={() => setSaveConfirmation(null)}
                      className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95 border border-slate-100 dark:border-slate-700"
                    >
                      Não, Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Left Sidebar */}
      <div className="w-64 border-r border-slate-200 dark:border-slate-800/50 flex flex-col bg-white dark:bg-[#0b1120]/50 shrink-0">
        <div className="p-4">
          <button 
            onClick={handleNewEvent}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-5 h-5" />
            Novo Evento
          </button>
        </div>

        <MiniCalendar 
          currentMonth={currentDate} 
          selectedDate={selectedDate} 
          onDateClick={(date: Date) => {
            setSelectedDate(date);
            setCurrentDate(date);
          }} 
          onMonthChange={setCurrentDate}
        />

        <div className="mt-4 px-4 space-y-6">
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Meus Calendários</h3>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
              {managedCategories
                .filter((c: any) => c.isPrincipal)
                .map((cat: any) => {
                  const cal = cat.name;
                  return (
                    <label key={cal} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          checked={activeCalendars.includes(cal)} 
                          onChange={() => {
                            if (activeCalendars.includes(cal)) {
                              setActiveCalendars(activeCalendars.filter(a => a !== cal));
                            } else {
                              setActiveCalendars([...activeCalendars, cal]);
                            }
                          }}
                          className={`w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer shadow-sm`}
                          style={{ accentColor: cat.color.replace('bg-', '') }}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors font-bold tracking-tight">{cal}</span>
                      </div>
                    </label>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b border-slate-100 dark:border-slate-800/30 flex items-center justify-between px-6 bg-white dark:bg-[#0f172a]">
          <div className="flex items-center gap-4 relative">
            <button 
              onClick={() => setShowMainPicker(!showMainPicker)}
              className="flex items-center gap-1 group"
            >
              <span className="text-sm font-bold text-slate-600 dark:text-slate-400 capitalize mr-2 group-hover:text-cyan-500 transition-colors">
                {format(currentDate, view === 'month' ? 'MMMM yyyy' : 'd MMMM yyyy', { locale: ptBR })}
              </span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showMainPicker ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showMainPicker && (
                <MonthYearPicker 
                  date={currentDate} 
                  onChange={setCurrentDate} 
                  onClose={() => setShowMainPicker(false)} 
                />
              )}
            </AnimatePresence>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800/50 rounded-lg p-1">
              <button onClick={handlePrev} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 transition-colors shadow-sm dark:shadow-none"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">Hoje</button>
              <button onClick={handleNext} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 transition-colors shadow-sm dark:shadow-none"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-slate-800/50 rounded-lg p-1 mr-2">
              {[
                { id: 'day', label: 'Dia' },
                { id: 'week', label: 'Semana' },
                { id: 'month', label: 'Mês' }
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id as any)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                    view === v.id 
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div 
          onWheel={handleWheel}
          className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0b1120]/30 scrollbar-hide"
        >
          {view === 'month' && (
            <div className="grid grid-cols-7 h-full min-h-[600px]">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="h-10 flex items-center justify-center border-b border-r border-slate-100 dark:border-slate-800/30 bg-white dark:bg-[#0b1120]/50 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {day}
                </div>
              ))}
              {calendarDays.map((day, i) => {
                const dayEvents = events.filter(e => 
                  isSameDay(parseISO(e.start), day) && 
                  (activeCalendars.includes(e.category) || !CATEGORIES.some(cat => cat.name === e.category))
                );
                return (
                  <div 
                    key={i} 
                    onClick={() => handleSlotClick(setHours(day, new Date().getHours()))}
                    className={`min-h-[120px] p-2 border-b border-r border-slate-200 dark:border-slate-800/30 transition-colors flex flex-col gap-1 cursor-pointer ${!isSameMonth(day, monthStart) ? 'bg-slate-100/50 dark:bg-slate-900/20' : 'bg-white dark:bg-transparent'} ${isToday(day) ? 'bg-cyan-500/5' : ''} hover:bg-slate-50 dark:hover:bg-slate-800/20`}
                  >
                    <span className={`text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday(day) ? 'bg-cyan-500 text-white' : 'text-slate-400'}`}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex-1 space-y-1 overflow-y-auto scrollbar-hide py-0.5">
                      {dayEvents.map(event => {
                        const styles = getEventStyles(event.color);
                        const isCompleted = event.isCompleted;
                        return (
                          <div 
                            key={event.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); setIsModalOpen(true); }}
                            onMouseEnter={(e) => handleMouseEnter(e, event)}
                            onMouseLeave={handleMouseLeave}
                            className={`${styles.bg} ${isCompleted ? 'line-through' : ''} text-slate-800 dark:text-slate-200 text-[10px] font-bold py-1 px-1.5 rounded shadow-sm cursor-pointer hover:brightness-105 transition-all relative overflow-hidden flex flex-col min-h-[32px]`}
                          >
                            <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${styles.sidebar} opacity-100 shadow-sm`} />
                            <div className="flex items-center gap-1.5 truncate pr-8">
                              <Tag className={`w-2 h-2 shrink-0 ml-1 ${styles.text}`} />
                              <span className="truncate">
                                <span className={styles.text}>{format(parseISO(event.start), 'HH:mm')}</span> {event.title}
                              </span>
                            </div>
                            <div className="mt-0.5 flex justify-end">
                              <span className={`text-[7px] font-black uppercase tracking-tighter px-1 rounded-sm bg-white/40 dark:bg-black/20 ${getEventStatus(event).color}`}>
                                {getEventStatus(event).label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(view === 'week' || view === 'day') && (
            <div className="flex h-full min-h-[1000px]">
              <div className="w-16 border-r border-slate-200 dark:border-slate-800/50 shrink-0 bg-white dark:bg-transparent">
                <div className="h-12 border-b border-slate-200 dark:border-slate-800/50" />
                {hours.map(hour => (
                  <div key={hour.toString()} className="h-20 border-b border-slate-100 dark:border-slate-800/10 text-[10px] font-bold text-slate-400 dark:text-slate-500 p-2 text-right">
                    {format(hour, 'HH:mm')}
                  </div>
                ))}
              </div>
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${view === 'week' ? 7 : 1}, 1fr)` }}>
                {(view === 'week' ? weekDays : [currentDate]).map((day, i) => (
                  <div key={i} className="border-r border-slate-200 dark:border-slate-800/50 relative bg-white dark:bg-transparent">
                    <div className="h-12 border-b border-slate-100 dark:border-slate-800/30 flex flex-col items-center justify-center bg-white dark:bg-[#0b1120]/50 sticky top-0 z-10">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{format(day, 'EEE', { locale: ptBR })}</span>
                      <span className={`text-sm font-bold ${isToday(day) ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-300'}`}>{format(day, 'd')}</span>
                    </div>
                    {hours.map(hour => {
                      const slotDate = setMinutes(setHours(day, hour.getHours()), 0);
                      return (
                        <div 
                          key={hour.toString()} 
                          onClick={() => handleSlotClick(slotDate)}
                          className="h-20 border-b border-slate-100 dark:border-slate-800/10 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors" 
                        />
                      );
                    })}
                    {/* Events Layer */}
                    <div className="absolute inset-0 top-12 pointer-events-none">
                      {events.filter(e => 
                        isSameDay(parseISO(e.start), day) && 
                        (activeCalendars.includes(e.category) || !CATEGORIES.some(cat => cat.name === e.category))
                      ).map(event => {
                        const start = parseISO(event.start);
                        const top = ((start.getHours() - START_HOUR) * 80) + (start.getMinutes() / 60 * 80);
                        const duration = (parseISO(event.end).getTime() - start.getTime()) / (1000 * 60 * 60);
                        const styles = getEventStyles(event.color);
                        const isCompleted = event.isCompleted;

                        // Don't render events that start before our display window
                        if (start.getHours() < START_HOUR) return null;

                        return (
                          <div 
                            key={event.id}
                            onClick={() => { setSelectedEvent(event); setIsModalOpen(true); }}
                            onMouseEnter={(e) => handleMouseEnter(e, event)}
                            onMouseLeave={handleMouseLeave}
                            className={`absolute left-1 right-1 rounded ${styles.bg} p-2 text-[10px] font-bold shadow cursor-pointer hover:brightness-105 transition-all pointer-events-auto overflow-hidden flex flex-col gap-1`}
                            style={{ top: `${top}px`, height: `${duration * 80}px`, minHeight: '20px' }}
                          >
                            <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${styles.sidebar} opacity-100 shadow-sm`} />
                            <div className="flex items-center gap-3 ml-2">
                              <div className={`truncate font-bold text-slate-900 dark:text-white transition-colors ${isCompleted ? 'line-through' : ''}`}>{event.title}</div>
                              <div className={`${styles.text} bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 whitespace-nowrap`}>
                                {format(start, 'HH:mm')} - {event.end && !isNaN(parseISO(event.end).getTime()) ? format(parseISO(event.end), 'HH:mm') : ''}
                              </div>
                            </div>
                            
                            {(event.patientName || event.responsibleName) && (
                              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 transition-colors truncate italic">
                                <Users className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">
                                  {event.patientName} {event.responsibleName ? `(Resp.: ${event.responsibleName})` : ''}
                                </span>
                              </div>
                            )}

                            {event.address && (
                              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 transition-colors truncate">
                                <MapPin className="w-2.5 h-2.5" />
                                <span className="truncate">{event.address}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Monthly Appointments */}
      <div className="w-72 border-l border-slate-200 dark:border-slate-800/50 flex flex-col bg-white dark:bg-[#0b1120]/50 shrink-0 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800/50">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-cyan-500" />
            Compromissos do Mês
          </h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider font-medium">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
          {useMemo(() => {
            const monthlyEvents = events
              .filter(e => 
                isSameMonth(parseISO(e.start), currentDate) && 
                (activeCalendars.includes(e.category) || !CATEGORIES.some(cat => cat.name === e.category))
              )
              .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime());

            if (monthlyEvents.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-3">
                    <Clock className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum compromisso para este mês.</p>
                </div>
              );
            }

            return monthlyEvents.map(event => {
              const styles = getEventStyles(event.color);
              const isCompleted = event.isCompleted;
              return (
                <div 
                  key={event.id}
                  onClick={() => { setSelectedEvent(event); setIsModalOpen(true); }}
                  onMouseEnter={(e) => handleMouseEnter(e, event)}
                  onMouseLeave={handleMouseLeave}
                  className={`group ${styles.bg} p-3 rounded-lg hover:brightness-105 transition-all cursor-pointer shadow-sm relative overflow-hidden`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${styles.sidebar} opacity-100 shadow-sm`} />
                  <div className="flex items-center justify-between mb-2 ml-1.5">
                    <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${styles.text} bg-white/60 dark:bg-black/20`}>
                      <Tag className="w-2.5 h-2.5 fill-none stroke-[2px]" />
                      {event.category}
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-wider ${styles.text} opacity-60`}>
                      {event.start && !isNaN(parseISO(event.start).getTime()) ? format(parseISO(event.start), 'dd MMM') : ''}
                    </span>
                  </div>
                  <h4 className={`text-sm font-extrabold tracking-tight text-slate-900 dark:text-slate-100 truncate group-hover:underline underline-offset-4 decoration-current/30 ml-1.5 transition-colors ${isCompleted ? 'line-through' : ''}`}>
                    {event.title}
                  </h4>
                  <div className="flex items-center justify-between mt-2 ml-1.5">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold italic transition-colors">
                      <Clock className="w-3 h-3" />
                      {event.start && !isNaN(parseISO(event.start).getTime()) ? format(parseISO(event.start), 'HH:mm') : ''} - {event.end && !isNaN(parseISO(event.end).getTime()) ? format(parseISO(event.end), 'HH:mm') : ''}
                    </div>
                    <span className={`text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-white/40 dark:bg-black/20 ${getEventStatus(event).color}`}>
                      {getEventStatus(event).label}
                    </span>
                  </div>
                </div>
              );
            });
          }, [events, currentDate])}
        </div>
      </div>
      {/* Event Information Popup */}
      <AnimatePresence>
        {hoveredEvent && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)', y: hoveredEvent.onTopHalf ? -10 : 10 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              filter: 'blur(0px)',
              y: 0,
              x: hoveredEvent.onRightSide ? '-100%' : '-50%',
              // The base Y position is already set in the style prop, 
              // but we need to account for the flip logic here too for the motion animation
              translateY: hoveredEvent.onRightSide 
                ? (hoveredEvent.onBottomHalf ? '-90%' : hoveredEvent.onTopHalf ? '-10%' : '-50%')
                : (hoveredEvent.onTopHalf ? '8px' : '-100%'),
            }}
            transition={{ 
              type: "spring", 
              stiffness: 180, 
              damping: 24,
              mass: 0.6,
              opacity: { duration: 0.4 },
              filter: { duration: 0.4 }
            }}
            exit={{ 
              opacity: 0, 
              scale: 0.95, 
              filter: 'blur(10px)',
              transition: { duration: 0.2, ease: "easeInOut" } 
            }}
            className="fixed z-[100] w-80 pointer-events-none"
            style={{ 
              left: hoveredEvent.x, 
              top: hoveredEvent.y
            }}
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${hoveredEvent.event.color}`} />
                   <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{hoveredEvent.event.category}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium whitespace-nowrap bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded">
                  {format(parseISO(hoveredEvent.event.start), 'dd/MM/yyyy')}
                </div>
              </div>

              <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {hoveredEvent.event.title}
              </h4>

              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="font-semibold">
                    {format(parseISO(hoveredEvent.event.start), 'HH:mm')} - {hoveredEvent.event.end ? format(parseISO(hoveredEvent.event.end), 'HH:mm') : ''}
                  </span>
                </div>

                {hoveredEvent.event.patientName && (
                  <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="w-7 h-7 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-cyan-500" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{hoveredEvent.event.patientName}</span>
                      {hoveredEvent.event.responsibleName && <span className="text-[10px] opacity-70 truncate">Responsável: {hoveredEvent.event.responsibleName}</span>}
                    </div>
                  </div>
                )}

                {hoveredEvent.event.address && (
                  <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                    </div>
                    <span className="leading-relaxed py-1">{hoveredEvent.event.address}</span>
                  </div>
                )}

                {hoveredEvent.event.phone && (
                  <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="font-medium">{hoveredEvent.event.phone}</span>
                  </div>
                )}

                {hoveredEvent.event.description && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Type className="w-4 h-4 text-slate-400" />
                    </div>
                    <div 
                      className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-4 prose-xs leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: hoveredEvent.event.description }}
                    />
                  </div>
                )}
              </div>
              
              <div className="pt-2 flex flex-wrap gap-2">
                 {hoveredEvent.event.isRecurrent && (
                   <span className="flex items-center gap-1 text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg font-medium">
                     <Repeat className="w-3 h-3" /> Recorrente
                   </span>
                 )}
                 {hoveredEvent.event.hasReminder && (
                   <span className="flex items-center gap-1 text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-lg font-medium">
                     <Bell className="w-3 h-3" /> Lembrete
                   </span>
                 )}
                 {hoveredEvent.event.isPrivate && (
                    <span className="flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-lg font-medium">
                      <Lock className="w-3 h-3" /> Privado
                    </span>
                 )}
              </div>
            </div>
            {hoveredEvent.onRightSide ? (
              <div 
                className="w-3 h-3 bg-white dark:bg-slate-900 border-r border-t border-slate-200 dark:border-slate-800 rotate-45 absolute -right-1.5 shadow-sm" 
                style={{ 
                  top: hoveredEvent.onBottomHalf ? '90%' : hoveredEvent.onTopHalf ? '10%' : '50%',
                  marginTop: '-6px'
                }}
              />
            ) : hoveredEvent.onTopHalf ? (
              <div className="w-3 h-3 bg-white dark:bg-slate-900 border-l border-t border-slate-200 dark:border-slate-800 rotate-45 mx-auto -mb-1.5 shadow-sm absolute top-0 left-1/2 -translate-x-1/2" />
            ) : (
              <div className="w-3 h-3 bg-white dark:bg-slate-900 border-r border-b border-slate-200 dark:border-slate-800 rotate-45 mx-auto -mt-1.5 shadow-sm absolute bottom-0 left-1/2 -translate-x-1/2" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tailwind Safelist to force generation of color classes */}
      <div className="hidden" aria-hidden="true">
        {CATEGORY_PALETTE.map(c => (
          <div key={c} className={`${c} ${c.replace('bg-', 'text-')} ${c.replace('bg-', 'border-')} border-opacity-10 dark:border-opacity-20 bg-opacity-10 dark:bg-opacity-20`} />
        ))}
      </div>
    </div>
  );
}

