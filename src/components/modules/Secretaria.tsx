import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar as CalendarIcon, 
  FileText, 
  UserSquare2,
  FileDown,
  Printer,
  ChevronRight,
  Plus
} from 'lucide-react';
import EscalaDiaconos from './secretaria/EscalaDiaconos';

const tabs = [
  { id: 'escala', label: 'Escala de Diáconos', icon: CalendarIcon },
  { id: 'membros', label: 'Membros', icon: Users },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'visitantes', label: 'Visitantes', icon: UserSquare2 },
];

export default function Secretaria() {
  const [activeTab, setActiveTab] = useState('escala');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'escala':
        return <EscalaDiaconos />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <p className="text-lg font-medium">Conteúdo em desenvolvimento</p>
            <p className="text-sm">A aba {tabs.find(t => t.id === activeTab)?.label} estará disponível em breve.</p>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-hidden">
      {/* Tab Selectors */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto scrollbar-hide">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
