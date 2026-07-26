import { Bell, LogIn, LogOut, Clock, AlertCircle, Activity, Download, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle, logout as firebaseLogout } from '../lib/firebase';
import { useNotifications } from '../context/NotificationContext';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { exportBackup, importBackup } from '../lib/backupService';
import { sidebarItems } from '../constants';

interface HeaderProps {
  onNavigate?: (module: string, event?: any) => void;
  onToggleActivity?: () => void;
  isActivityOpen?: boolean;
  activeItem?: string;
}

export default function Header({ onNavigate, onToggleActivity, isActivityOpen, activeItem }: HeaderProps) {
  const { user, isAuthReady } = useAuth();
  const { reminders, overdue, totalNotifications, unreadCount, markAsRead } = useNotifications();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isInstallable, setIsInstallable] = useState(true);

  useEffect(() => {
    // Sempre mantem true para o botão de instalação ficar sempre visível como ajuda do PWA
    setIsInstallable(true);
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = (window as any).deferredPrompt;
    if (!promptEvent) {
      // Abre as instruções personalizadas do PWA
      const { showPwaInstructions } = await import('../lib/alerts');
      showPwaInstructions();
      return;
    }

    try {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      console.log(`PWA install from Header outcome: ${outcome}`);
      (window as any).deferredPrompt = null;
    } catch (err) {
      console.error(err);
      const { showPwaInstructions } = await import('../lib/alerts');
      showPwaInstructions();
    }
  };

  const handleToggleNotifications = () => {
    if (!isNotificationsOpen) {
      markAsRead();
    }
    setIsNotificationsOpen(!isNotificationsOpen);
  };

  const formatDisplayName = (name: string | null) => {
    if (!name) return 'Usuário';
    const words = name.split(' ');
    const filteredWords = words.filter((word, index) => word !== words[index - 1]);
    return filteredWords.join(' ');
  };

  const firstName = user?.displayName?.split(' ')[0] || 'Visitante';

  const getPageContext = () => {
    switch (activeItem) {
      case 'home':
        return { 
          title: `Olá, ${firstName}! 👋`, 
          subtitle: 'Aqui está o que está acontecendo hoje no seu painel.' 
        };
      case 'agenda':
        return { 
          title: 'Agenda e Eventos', 
          subtitle: 'Gerencie seus compromissos, reuniões e lembretes em tempo real.' 
        };
      case 'cadastro':
        return { 
          title: 'Membros e Cadastro', 
          subtitle: 'Administre o cadastro de membros, obreiros e departamentos.' 
        };
      case 'caixa':
        return { 
          title: 'Fluxo de Caixa', 
          subtitle: 'Controle financeiro detalhado de entradas e saídas.' 
        };
      case 'fornecedor':
        return { 
          title: 'Gestão de Fornecedores', 
          subtitle: 'Cadastro e acompanhamento de parceiros e fornecedores.' 
        };
      case 'financas':
        return { 
          title: 'Finanças Pessoais', 
          subtitle: 'Gestão de cartões de crédito, faturas e seus próprios gastos.' 
        };
      case 'credencial':
        return { 
          title: 'Emissor de Credenciais', 
          subtitle: 'Imprima identificações horizontais para seus membros.' 
        };
      case 'cracha':
        return { 
          title: 'Emissor de Crachás', 
          subtitle: 'Gerencie identificações verticais para eventos e uso oficial.' 
        };
      case 'carta':
        return { 
          title: 'Cartas de Apresentação', 
          subtitle: 'Gere documentos oficiais para membros.' 
        };
      case 'secretaria':
        return { 
          title: 'Secretaria e Escalas', 
          subtitle: 'Gerenciamento de escalas, documentos e registros administrativos.' 
        };
      case 'configuracoes':
        return { 
          title: 'Configurações do Sistema', 
          subtitle: 'Personalize preferências, temas e integrações de segurança.' 
        };
      case 'selecionar':
        return { 
          title: 'Busca de CEP e Endereços', 
          subtitle: 'Localize endereços em todo o Brasil usando inteligência artificial.' 
        };
      default:
        const item = sidebarItems.find(i => i.id === activeItem);
        return { 
          title: item?.label || 'Church Control System', 
          subtitle: 'Painel Administrativo para controle total.' 
        };
    }
  };

  const context = getPageContext();
  const allNotifications = [...overdue, ...reminders];

  return (
    <header className="h-16 flex items-center justify-between px-6 lg:px-8 bg-slate-50 dark:bg-[#0b1120] sticky top-0 z-40 transition-colors duration-300">
      <div className="flex items-center gap-4 flex-1">
        <div className="flex flex-col gap-0.5 animate-in fade-in slide-in-from-left-4 duration-500">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-none" translate="no">
            {context.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{context.subtitle}</p>
        </div>
      </div>

      {/* Middle Section: Backup Buttons */}
      {activeItem === 'home' && (
        <div className="hidden md:flex items-center gap-3 animate-in fade-in zoom-in duration-500">
          {isInstallable && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-br from-[#00f5ff] to-cyan-600 hover:from-cyan-400 hover:to-cyan-700 text-[#0f1115] text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-cyan-500/20 mr-1"
            >
              <Download className="w-3.5 h-3.5 animate-bounce" />
              Instalar App
            </button>
          )}

          <button 
            onClick={() => exportBackup(user, setIsBackupLoading)}
            disabled={isBackupLoading}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Backup Excel
          </button>
          
          <label className="flex items-center gap-2 px-5 py-2 bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white text-[11px] font-black uppercase tracking-widest rounded-xl cursor-pointer transition-all shadow-lg shadow-rose-500/20">
            <Upload className="w-3.5 h-3.5" />
            Importar
            <input 
              type="file" 
              accept=".xlsx,.xls" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importBackup(user, file, setIsBackupLoading);
                e.target.value = '';
              }}
              disabled={isBackupLoading} 
            />
          </label>
        </div>
      )}

      <div className="flex items-center gap-4 flex-1 justify-end">
        {activeItem === 'home' && (
          <>
            {isInstallable && (
              <button
                onClick={handleInstallClick}
                className="p-2 rounded-full text-emerald-500 hover:text-emerald-400 dark:text-emerald-400 dark:hover:text-[#00f5ff] transition-all relative group flex items-center justify-center focus:outline-none"
                title="Instalar Aplicativo na Área de Trabalho"
              >
                <Download className="w-5 h-5 animate-bounce" />
                <span className="sr-only">Instalar App</span>
              </button>
            )}

            <div className="relative">
              <button 
                onClick={handleToggleNotifications}
                className={`relative p-2 rounded-full transition-all ${isNotificationsOpen ? 'bg-slate-100 dark:bg-slate-800 text-cyan-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-[#0f172a]" />
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-80 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notificações</h3>
                        <span className="text-[10px] bg-cyan-500/10 text-cyan-500 px-2 py-0.5 rounded-full font-bold">
                          {totalNotifications} Ativas
                        </span>
                      </div>

                      <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
                        {allNotifications.length > 0 ? (
                          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {allNotifications.map((event) => {
                              const isOverdue = overdue.some(oe => oe.id === event.id);
                              return (
                                <button
                                  key={event.id}
                                  onClick={() => {
                                    if (onNavigate) onNavigate('agenda', event);
                                    setIsNotificationsOpen(false);
                                  }}
                                  className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                                >
                                  <div className="flex gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isOverdue ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-cyan-100 dark:bg-cyan-900/30'}`}>
                                      {isOverdue ? (
                                        <AlertCircle className="w-4 h-4 text-amber-500" />
                                      ) : (
                                        <Clock className="w-4 h-4 text-cyan-500" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                                          {isOverdue ? 'Eventos Atrasados' : 'Lembrete'}
                                        </span>
                                        <span className="text-[9px] text-slate-400 whitespace-nowrap">
                                          {format(parseISO(event.start), 'dd/MM')}
                                        </span>
                                      </div>
                                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-cyan-500 transition-colors">
                                        {event.title}
                                      </h4>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        {format(parseISO(event.start), 'HH:mm')}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-8 text-center">
                            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Bell className="w-6 h-6 text-slate-300" />
                            </div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Nenhuma notificação por enquanto</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            <button 
              onClick={onToggleActivity}
              className={`p-2 rounded-full transition-all ${isActivityOpen ? 'bg-slate-100 dark:bg-slate-800 text-cyan-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              title="Atividade Recente"
            >
              <Activity className="w-5 h-5" />
            </button>

            <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2" />
            
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block leading-tight">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white" translate="no">
                    {formatDisplayName(user.displayName)}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-500" translate="no">Administrador</span>
                    <button 
                      onClick={firebaseLogout}
                      className="text-[10px] text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 group"
                    >
                      <LogOut className="w-2.5 h-2.5" />
                      <span>Sair</span>
                    </button>
                  </div>
                </div>
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={formatDisplayName(user.displayName)} 
                    className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 shadow-sm" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold border-2 border-white dark:border-slate-800 shadow-sm text-sm">
                    {formatDisplayName(user.displayName)[0].toUpperCase()}
                  </div>
                )}
              </div>
            ) : isAuthReady && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block leading-tight">
                  <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 italic" translate="no">Nenhuma conta</p>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-300 dark:text-slate-600" translate="no">Visitante</p>
                </div>
                <button 
                  onClick={async () => {
                    try {
                      await signInWithGoogle();
                    } catch (err) {
                      console.warn("Login interrupção ou erro tratado:", err);
                    }
                  }}
                  className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm group"
                >
                  <LogIn className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition-transform" />
                  Entrar
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}
