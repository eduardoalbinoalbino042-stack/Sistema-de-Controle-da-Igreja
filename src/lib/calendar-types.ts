import { ptBR } from 'date-fns/locale';

export interface Event {
  id: string | number;
  userId: string;
  title: string;
  start: string;
  end: string;
  category: string;
  color: string;
  description?: string;
  address?: string;
  numero?: string;
  phone?: string;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  patientName?: string;
  responsibleName?: string;
  doctorName?: string;
  specialty?: string;
  senderEmail?: string;
  recipientEmail?: string;
  isRecurrent?: boolean;
  recurrenceType?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceUntil?: string;
  recurrenceGroupId?: string;
  googleEventId?: string;
  googleAccountEmail?: string;
  status?: 'busy' | 'free' | 'tentative' | 'away';
  hasReminder?: boolean;
  reminderMinutes?: number;
  reminderValue?: number;
  reminderUnit?: string;
  isPrivate?: boolean;
  attachments?: { name: string, type: string, url: string }[];
  isCompleted?: boolean;
  emailSent?: boolean;
  lastEmailSentAt?: string;
  lastRecipientEmail?: string;
}

export const PALETTE_STYLES: Record<string, { text: string, border: string }> = {
  'bg-red-500': { text: 'text-red-700', border: 'border-red-600' },
  'bg-red-200': { text: 'text-red-600', border: 'border-red-300' },
  'bg-orange-200': { text: 'text-orange-600', border: 'border-orange-300' },
  'bg-orange-400': { text: 'text-orange-700', border: 'border-orange-500' },
  'bg-orange-300': { text: 'text-orange-600', border: 'border-orange-400' },
  'bg-yellow-400': { text: 'text-yellow-700', border: 'border-yellow-500' },
  'bg-yellow-100': { text: 'text-yellow-600', border: 'border-yellow-200' },
  'bg-stone-400': { text: 'text-stone-700', border: 'border-stone-500' },
  'bg-lime-200': { text: 'text-lime-700', border: 'border-lime-400' },
  'bg-lime-400': { text: 'text-lime-700', border: 'border-lime-500' },
  'bg-green-400': { text: 'text-green-700', border: 'border-green-500' },
  'bg-green-600': { text: 'text-green-800', border: 'border-green-700' },
  'bg-cyan-200': { text: 'text-cyan-700', border: 'border-cyan-400' },
  'bg-cyan-400': { text: 'text-cyan-700', border: 'border-cyan-500' },
  'bg-cyan-500': { text: 'text-cyan-700', border: 'border-cyan-600' },
  'bg-cyan-600': { text: 'text-cyan-800', border: 'border-cyan-700' },
  'bg-sky-200': { text: 'text-sky-700', border: 'border-sky-400' },
  'bg-sky-400': { text: 'text-sky-700', border: 'border-sky-500' },
  'bg-blue-200': { text: 'text-blue-700', border: 'border-blue-400' },
  'bg-blue-500': { text: 'text-blue-700', border: 'border-blue-600' },
  'bg-indigo-300': { text: 'text-indigo-700', border: 'border-indigo-400' },
  'bg-purple-300': { text: 'text-purple-700', border: 'border-purple-400' },
  'bg-purple-500': { text: 'text-purple-700', border: 'border-purple-600' },
  'bg-pink-200': { text: 'text-pink-700', border: 'border-pink-400' },
  'bg-amber-500': { text: 'text-amber-700', border: 'border-amber-600' },
  'bg-emerald-500': { text: 'text-emerald-700', border: 'border-emerald-600' },
  'bg-fuchsia-400': { text: 'text-fuchsia-700', border: 'border-fuchsia-500' },
  'bg-slate-200': { text: 'text-slate-700', border: 'border-slate-400' },
  'bg-slate-400': { text: 'text-slate-700', border: 'border-slate-500' },
  'bg-slate-600': { text: 'text-slate-800', border: 'border-slate-700' },
  'bg-gray-300': { text: 'text-gray-700', border: 'border-gray-400' },
  'bg-stone-100': { text: 'text-stone-600', border: 'border-stone-300' },
};

export const getEventStyles = (colorClass: string) => {
  const custom = PALETTE_STYLES[colorClass];
  const baseColor = colorClass.replace('bg-', '');
  
  return {
    bg: `bg-${baseColor}/30 dark:bg-${baseColor}/40`,
    border: custom?.border || colorClass.replace('bg-', 'border-'),
    text: custom?.text || `text-${baseColor.split('-')[0]}-700 dark:text-${baseColor.split('-')[0]}-300`,
    dot: colorClass,
    sidebar: colorClass
  };
};
