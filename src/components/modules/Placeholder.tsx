import { motion } from 'motion/react';

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-transparent">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md space-y-4"
      >
        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Módulo {title}</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Este módulo está em fase de desenvolvimento. Em breve você terá acesso a todas as funcionalidades de {title.toLowerCase()}.
        </p>
        <div className="pt-6">
          <button className="px-6 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-full transition-all text-sm font-medium shadow-sm border border-slate-200 dark:border-slate-700">
            Voltar ao Início
          </button>
        </div>
      </motion.div>
    </div>
  );
}
