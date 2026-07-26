import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAuthReady: false });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    console.log("Iniciando escuta de autenticação...");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Estado de autenticação mudou:", user ? "Logado" : "Deslogado");
      setUser(user);
      setLoading(false);
      setIsAuthReady(true);
    }, (error) => {
      console.error("Erro no onAuthStateChanged:", error);
      setLoading(false);
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
