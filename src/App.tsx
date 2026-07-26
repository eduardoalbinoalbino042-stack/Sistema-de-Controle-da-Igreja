import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';

// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { RecentActivityPanel } from './components/RecentActivityPanel';
import { NotificationCenter } from './components/NotificationCenter';

// Modules
import Dashboard from './components/modules/Dashboard';
import Agenda from './components/modules/Agenda';
import Cadastro from './components/modules/Cadastro';
import Caixa from './components/modules/Caixa';
import Financas from './components/modules/Financas';
import Settings from './components/modules/Settings';
import Fornecedor from './components/modules/Fornecedor';
import Credencial from './components/modules/Credencial';
import Cracha from './components/modules/Cracha';
import Carta from './components/modules/Carta';
import Certificado from './components/modules/Certificado';
import Secretaria from './components/modules/Secretaria';
import Placeholder from './components/modules/Placeholder';
import BuscaCep from './components/modules/BuscaCep';

import { sidebarItems } from './constants';
import { useTheme } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';

export default function App() {
  const [activeItem, setActiveItem] = useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isActivityPanelOpen, setIsActivityPanelOpen] = useState(false);
  const { theme } = useTheme();
  const { user, isAuthReady } = useAuth();
  const [targetData, setTargetData] = useState<any>(null);
  const [showWakeupAdvice, setShowWakeupAdvice] = useState(false);

  // Detect if server is taking a high time to boot (cold-start / VM sleeping from zero inactivity)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isAuthReady) {
      timer = setTimeout(() => {
        setShowWakeupAdvice(true);
      }, 5000); // 5 segundos
    } else {
      setShowWakeupAdvice(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isAuthReady]);

  // Sync mechanism: Auto-reload fullscreen tabs when the AI Studio preview reloads
  useEffect(() => {
    const channel = new BroadcastChannel('app_sync_channel');
    
    if (window !== window.top) {
      // We are inside the AI Studio iframe preview. Broadcast reload signal on mount.
      channel.postMessage({ type: 'RELOAD_APP' });
    } else {
      // We are in a fullscreen tab. Listen for the reload signal.
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'RELOAD_APP') {
          console.log('🔄 Atualização detectada. Recarregando a tela cheia...');
          window.location.reload();
        }
      };
      channel.addEventListener('message', handleMessage);
      
      return () => {
        channel.removeEventListener('message', handleMessage);
        channel.close();
      };
    }
    
    return () => channel.close();
  }, []);

  const handleNavigate = (module: string, data?: any) => {
    if (data) setTargetData(data);
    else setTargetData(null);
    setActiveItem(module);
  };

  const renderModule = () => {
    switch (activeItem) {
      case 'home':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'agenda':
        return <Agenda initialEvent={targetData} onClearInitialEvent={() => setTargetData(null)} />;
      case 'cadastro':
        return <Cadastro initialView={targetData?.view} onClearInitialView={() => setTargetData(null)} />;
      case 'caixa':
        return <Caixa />;
      case 'financas':
        return <Financas />;
      case 'fornecedor':
        return <Fornecedor />;
      case 'credencial':
        return <Credencial />;
      case 'cracha':
        return <Cracha />;
      case 'carta':
        return <Carta />;
      case 'certificado':
        return <Certificado />;
      case 'secretaria':
        return <Secretaria />;
      case 'configuracoes':
        return <Settings />;
      case 'selecionar':
        return <BuscaCep />;
      default:
        const item = sidebarItems.find(i => i.id === activeItem);
        return <Placeholder title={item?.label || activeItem} />;
    }
  };

  if (!isAuthReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#0b1120] px-4">
        <div className="flex flex-col items-center max-w-md w-full bg-white dark:bg-[#111827] shadow-xl rounded-3xl border border-slate-100 dark:border-slate-800 p-8 text-center animate-in fade-in duration-500">
          
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-black text-emerald-500 uppercase tracking-widest animate-pulse">CCS</span>
            </div>
          </div>

          <h3 className="text-lg font-black uppercase text-slate-800 dark:text-slate-100 tracking-wide mb-2">
            {!showWakeupAdvice ? 'Iniciando o Sistema' : 'Servidor Inicializando'}
          </h3>
          
          <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed mb-6">
            {!showWakeupAdvice ? (
              'Carregando suas credenciais e preparando o painel de bordo...'
            ) : (
              'Como o servidor em nuvem entra em modo de suspensão por inatividade, o primeiro login do dia pode demorar de 15 a 30 segundos adicionais para "acordar" os serviços do banco de dados.'
            )}
          </p>

          {showWakeupAdvice && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 text-left text-[11px] text-amber-800 dark:text-amber-300 mb-6 leading-relaxed">
              <span className="font-bold uppercase tracking-wider block mb-1">💡 Dica Rápida:</span>
              O contêiner virtual de testes está iniciando. Se o carregamento permanecer nesta tela por muito tempo, clique no botão abaixo para recarregar.
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/10 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              Recarregar Página
            </button>
            {showWakeupAdvice && (
              <button 
                onClick={() => {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(regs => {
                      for (const reg of regs) reg.unregister();
                      window.location.reload();
                    });
                  } else {
                    window.location.reload();
                  }
                }}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all"
              >
                Limpar Cache & Recarregar
              </button>
            )}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-slate-200 font-sans overflow-hidden transition-colors duration-300 relative">
      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        items={sidebarItems}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          onNavigate={handleNavigate} 
          onToggleActivity={() => setIsActivityPanelOpen(!isActivityPanelOpen)}
          isActivityOpen={isActivityPanelOpen}
          activeItem={activeItem}
        />

        <div className="flex-1 overflow-hidden">
          {renderModule()}
        </div>
      </main>
      <NotificationCenter onNavigate={handleNavigate} />
      <RecentActivityPanel 
        isOpen={isActivityPanelOpen} 
        onClose={() => setIsActivityPanelOpen(false)} 
      />
    </div>
  );
}


