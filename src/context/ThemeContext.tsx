import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  sidebarBg: string | null;
  setSidebarBg: (bg: string | null) => void;
  sidebarOverlayColor: string;
  setSidebarOverlayColor: (color: string) => void;
  sidebarOverlayOpacity: number;
  setSidebarOverlayOpacity: (opacity: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getAutoTheme = (): Theme => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTimeInMinutes = hours * 60 + minutes;
    
    const startLight = 6 * 60; // 06:00
    const endLight = 18 * 60 + 30; // 18:30
    
    // Se estiver entre 06:00 e 18:30, retorna 'light', caso contrário 'dark'
    if (currentTimeInMinutes >= startLight && currentTimeInMinutes < endLight) {
      return 'light';
    }
    return 'dark';
  };

  const [sidebarBg, setSidebarBgState] = useState<string | null>(() => {
    return localStorage.getItem('sidebar_bg');
  });

  const [sidebarOverlayColor, setSidebarOverlayColorState] = useState<string>(() => {
    return localStorage.getItem('sidebar_overlay_color') || '#0f1115';
  });

  const [sidebarOverlayOpacity, setSidebarOverlayOpacityState] = useState<number>(() => {
    const saved = localStorage.getItem('sidebar_overlay_opacity');
    return saved ? parseFloat(saved) : 0.9;
  });

  const setSidebarBg = (bg: string | null) => {
    setSidebarBgState(bg);
    if (bg) {
      localStorage.setItem('sidebar_bg', bg);
    } else {
      localStorage.removeItem('sidebar_bg');
    }
  };

  const setSidebarOverlayColor = (color: string) => {
    setSidebarOverlayColorState(color);
    localStorage.setItem('sidebar_overlay_color', color);
  };

  const setSidebarOverlayOpacity = (opacity: number) => {
    setSidebarOverlayOpacityState(opacity);
    localStorage.setItem('sidebar_overlay_opacity', opacity.toString());
  };

  const [theme, setTheme] = useState<Theme>(() => {
    // Verificamos se o usuário já definiu um tema manualmente
    const isManual = localStorage.getItem('theme_manual_override') === 'true';
    const saved = localStorage.getItem('theme');
    
    if (isManual && saved) {
      return saved as Theme;
    }
    
    // Se não houver override manual, seguimos o relógio
    return getAutoTheme();
  });

  // Efeito para aplicar a classe no HTML e salvar no storage
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Efeito para verificar o horário periodicamente (a cada minuto)
  // e atualizar o tema se o usuário não tiver feito um override manual
  useEffect(() => {
    const checkTime = () => {
      const isManual = localStorage.getItem('theme_manual_override') === 'true';
      if (!isManual) {
        const autoTheme = getAutoTheme();
        setTheme(prev => {
          if (prev !== autoTheme) return autoTheme;
          return prev;
        });
      }
    };

    const interval = setInterval(checkTime, 60000); // Verifica a cada 1 minuto
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'dark' ? 'light' : 'dark';
      // Ao clicar manualmente, ativamos o override para não mudar sozinho com o relógio
      localStorage.setItem('theme_manual_override', 'true');
      return newTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      toggleTheme, 
      sidebarBg, 
      setSidebarBg, 
      sidebarOverlayColor, 
      setSidebarOverlayColor, 
      sidebarOverlayOpacity, 
      setSidebarOverlayOpacity 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
