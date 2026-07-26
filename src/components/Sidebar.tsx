import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  LayoutGrid, 
  Settings, 
  X, 
  Menu,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  activeItem: string;
  setActiveItem: (id: string) => void;
  items: any[];
}

export default function Sidebar({ isSidebarOpen, setIsSidebarOpen, activeItem, setActiveItem, items }: SidebarProps) {
  const { theme, toggleTheme, sidebarBg, sidebarOverlayColor, sidebarOverlayOpacity } = useTheme();
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
      console.log(`PWA install outcome: ${outcome}`);
      (window as any).deferredPrompt = null;
    } catch (err) {
      console.error(err);
      const { showPwaInstructions } = await import('../lib/alerts');
      showPwaInstructions();
    }
  };

  // Split items into categories
  const gestaoItems = items.filter(item => !['tema', 'fechar', 'configuracoes'].includes(item.id));
  const sessaoItems = items.filter(item => ['tema', 'fechar'].includes(item.id));

  const NavItem = ({ item, isActive }: { item: any, isActive: boolean, key?: any }) => {
    const Icon = item.icon;
    const isTheme = item.id === 'tema';
    const strokeWidth = isActive ? 2 : 1.2;

    return (
      <button
        key={item.id}
        onClick={() => {
          if (isTheme) toggleTheme();
          else setActiveItem(item.id);
        }}
        className={`
          relative w-full flex items-center gap-4 px-4 py-2.5 my-[1px] transition-all duration-300 ease-in-out group outline-none border-y border-transparent
          ${isActive 
            ? 'text-[#00f5ff] bg-gradient-to-r from-[#00f5ff]/20 to-transparent border-l-[4px] border-r-[1.5px] border-l-[#00f5ff] border-r-[#00f5ff]/40 rounded-sm shadow-[inset_0_0_10px_rgba(0,245,255,0.1)]' 
            : `${theme === 'light' ? 'text-slate-300' : 'text-slate-500'} hover:text-[#00f5ff] hover:bg-white/5 rounded-sm`}
        `}
      >
        <div className={`
          shrink-0 transition-all duration-300 
          ${isActive ? 'drop-shadow-[0_0_8px_rgba(0,245,255,0.6)]' : `opacity-70 group-hover:opacity-100 ${theme === 'light' ? 'text-slate-300' : 'text-slate-500'}`}
        `}>
          {isTheme ? (
            theme === 'dark' ? <Sun size={18} strokeWidth={strokeWidth} /> : <Moon size={18} strokeWidth={strokeWidth} />
          ) : (
            <Icon size={18} strokeWidth={strokeWidth} />
          )}
        </div>

        {isSidebarOpen && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`
              text-[10px] uppercase tracking-widest whitespace-nowrap transition-all duration-300
              ${isActive ? 'font-black' : 'font-medium group-hover:tracking-[0.15em]'}
            `}
            translate="no"
          >
            {isTheme ? (theme === 'dark' ? 'Tema Claro' : 'Tema Escuro') : item.label}
          </motion.span>
        )}
      </button>
    );
  };

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isSidebarOpen ? 240 : 64 }}
      className={`relative flex flex-col ${sidebarBg ? 'bg-transparent' : 'bg-[#0f1115]'} border-r border-[#1e2329] shrink-0 z-50 overflow-hidden`}
    >
      {/* Dynamic Background Image */}
      {sidebarBg && (
        <>
          <div 
            className="absolute inset-0 z-[-2] bg-cover bg-center bg-no-repeat transition-all duration-700" 
            style={{ backgroundImage: `url(${sidebarBg})` }} 
          />
          <div 
            className="absolute inset-0 z-[-1] backdrop-blur-[2px] transition-colors duration-500" 
            style={{ 
              backgroundColor: sidebarOverlayColor,
              opacity: sidebarOverlayOpacity
            }}
          />
        </>
      )}

      {/* Sidebar Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute right-2 top-6 p-1 rounded-md bg-slate-800/30 text-slate-500 hover:text-[#00f5ff] transition-all z-10 border border-[#1e2329]"
      >
        {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Logo Section */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-[#00f5ff] rounded flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,245,255,0.3)]">
          <LayoutGrid className="text-[#0f1115] w-4.5 h-4.5" strokeWidth={2.5} />
        </div>
        {isSidebarOpen && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-black text-[13px] tracking-tighter text-white uppercase italic"
            translate="no"
          >
            Church Control System
          </motion.span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pt-2 pb-8 px-0 space-y-6">
        {/* Gestão Section */}
        <div className="space-y-1">
          {isSidebarOpen && (
            <div className="px-5 mb-2 text-[10px] font-black tracking-[0.25em] text-slate-600 uppercase opacity-70">
              Gestão
            </div>
          )}
          {gestaoItems.map((item) => (
            <NavItem key={item.id} item={item} isActive={activeItem === item.id} />
          ))}
        </div>

        {/* Sessão Section */}
        <div className="space-y-1">
          {isSidebarOpen && (
            <div className="px-5 mb-2 text-[10px] font-black tracking-[0.25em] text-slate-600 uppercase opacity-70">
              Sessão
            </div>
          )}
          {sessaoItems.map((item) => (
            <NavItem key={item.id} item={item} isActive={activeItem === item.id} />
          ))}
          
          <button
            onClick={() => setActiveItem('configuracoes')}
            className={`
              relative w-full flex items-center gap-4 px-4 py-2.5 my-[1px] transition-all duration-300 ease-in-out group outline-none border-y border-transparent
              ${activeItem === 'configuracoes' 
                ? 'text-[#00f5ff] bg-gradient-to-r from-[#00f5ff]/20 to-transparent border-l-[4px] border-r-[1.5px] border-l-[#00f5ff] border-r-[#00f5ff]/40 rounded-sm shadow-[inset_0_0_10px_rgba(0,245,255,0.1)]' 
                : `${theme === 'light' ? 'text-slate-300' : 'text-slate-500'} hover:text-[#00f5ff] hover:bg-white/5 rounded-sm`}
            `}
          >
            <div className={`
              shrink-0 transition-all duration-300 
              ${activeItem === 'configuracoes' ? 'drop-shadow-[0_0_8px_rgba(0,245,255,0.6)]' : `opacity-70 group-hover:opacity-100 ${theme === 'light' ? 'text-slate-300' : 'text-slate-500'}`}
            `}>
              <Settings size={18} strokeWidth={activeItem === 'configuracoes' ? 2 : 1.2} />
            </div>
            {isSidebarOpen && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`
                  text-[10px] uppercase tracking-widest whitespace-nowrap transition-all duration-300
                  ${activeItem === 'configuracoes' ? 'font-black' : 'font-medium group-hover:tracking-[0.15em]'}
                `}
                translate="no"
              >
                Configurações
              </motion.span>
            )}
          </button>

          {isInstallable && (
            <button
              onClick={handleInstallClick}
              className={`
                relative w-full flex items-center gap-4 px-4 py-2.5 my-3 transition-all duration-300 ease-in-out group outline-none border-y border-transparent
                text-emerald-400 hover:text-[#00f5ff] hover:bg-emerald-500/10 rounded-sm
              `}
            >
              <div className="shrink-0 transition-all duration-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                <Download size={18} className="animate-bounce" />
              </div>
              {isSidebarOpen && (
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] uppercase tracking-widest font-black transition-all duration-300 group-hover:tracking-[0.15em]"
                  translate="no"
                >
                  Instalar App
                </motion.span>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
