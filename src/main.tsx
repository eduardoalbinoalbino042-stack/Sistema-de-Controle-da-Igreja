import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ConfigProvider } from './context/ConfigContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ConfigProvider>
        <NotificationProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </NotificationProvider>
      </ConfigProvider>
    </AuthProvider>
  </StrictMode>,
);
