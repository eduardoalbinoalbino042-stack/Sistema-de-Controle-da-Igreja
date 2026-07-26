import React, { createContext, useContext, useEffect, useState } from 'react';

interface ConfigContextType {
  mapsKey: string;
  isConfigReady: boolean;
  refreshConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType>({
  mapsKey: '',
  isConfigReady: false,
  refreshConfig: async () => {},
});

export const ConfigProvider = ({ children }: { children: React.ReactNode }) => {
  const [mapsKey, setMapsKey] = useState('');
  const [isConfigReady, setIsConfigReady] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        if (data.config?.mapsKey) {
          setMapsKey(data.config.mapsKey);
        }
      }
    } catch (err) {
      console.error('Error fetching system config:', err);
    } finally {
      setIsConfigReady(true);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <ConfigContext.Provider value={{ mapsKey, isConfigReady, refreshConfig: fetchConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => useContext(ConfigContext);
