import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Key,
  Save,
  ChevronDown,
  ChevronUp,
  Mail,
  Trash2,
  Plus,
  Activity,
  UserPlus,
  Database,
  Layout,
  ExternalLink,
  User,
  Download,
  Upload,
  FileSpreadsheet,
  HardDrive,
  Church,
  MapPin,
  Globe,
  Link as LinkIcon,
  ImagePlus,
  Phone,
  Image as ImageIcon,
  Users,
  Eye,
  EyeOff,
  CreditCard,
  Receipt,
  ShieldAlert,
  AlertOctagon,
  Zap
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, where, getDocs, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { logActivity } from '../../lib/activityService';
import { confirmAction, showSuccess, showError } from '../../lib/alerts';

export default function Settings() {
  const { user } = useAuth();
  const { 
    sidebarBg, 
    setSidebarBg, 
    sidebarOverlayColor, 
    setSidebarOverlayColor, 
    sidebarOverlayOpacity, 
    setSidebarOverlayOpacity 
  } = useTheme();
  const [googleStatus, setGoogleStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');
  const [googleAccounts, setGoogleAccounts] = useState<string[]>([]);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [isExpended, setIsExpanded] = useState(false);

  // Form states
  const [googleId, setGoogleId] = useState('');
  const [googleSecret, setGoogleSecret] = useState('');
  const [mapsKey, setMapsKey] = useState('');
  const [showGoogleSecret, setShowGoogleSecret] = useState(false);
  const [showMapsKey, setShowMapsKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'accounts' | 'emails' | 'shortcuts' | 'backup' | 'church' | 'api' | 'billing' | 'infrastructure'>('accounts');
  const [isBackupLoading, setIsBackupLoading] = useState(false);

  const [billingConfig, setBillingConfig] = useState<{
    [key: string]: { closingDay: number; dueDay: number }
  }>({
    'Cartão de Crédito': { closingDay: 5, dueDay: 15 },
    'Boleto': { closingDay: 10, dueDay: 20 },
    'Carnê': { closingDay: 1, dueDay: 10 },
  });

  // Church Data states
  const [churchData, setChurchData] = useState({
    socialName: '',
    ministry: '',
    cnpj: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    email: '',
    website: '',
    description: '',
    pastorPresident: '',
    vicePresident: '',
    treasurer1: '',
    treasurer2: '',
    secretary1: '',
    secretary2: '',
    auditor1: '',
    auditor2: '',
    board: '',
    logos: [] as string[]
  });
  const [newLogoUrl, setNewLogoUrl] = useState('');

  // Email Senders state
  const [registeredSenders, setRegisteredSenders] = useState<{id: string, email: string}[]>([]);
  const [newSenderEmail, setNewSenderEmail] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'sender_emails'),
      where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emails = snapshot.docs.map(doc => ({ id: doc.id, email: doc.data().email }));
      setRegisteredSenders(emails);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sender_emails');
    });

    // Load Church Data
    const churchRef = doc(db, 'church_data', user.uid);
    const unsubscribeChurch = onSnapshot(churchRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChurchData({
          socialName: data.socialName || '',
          ministry: data.ministry || '',
          cnpj: data.cnpj || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          zipCode: data.zipCode || '',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          description: data.description || '',
          pastorPresident: data.pastorPresident || '',
          vicePresident: data.vicePresident || '',
          treasurer1: data.treasurer1 || '',
          treasurer2: data.treasurer2 || '',
          secretary1: data.secretary1 || '',
          secretary2: data.secretary2 || '',
          auditor1: data.auditor1 || '',
          auditor2: data.auditor2 || '',
          board: data.board || '',
          logos: data.logos || []
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'church_data');
    });

    // Load Billing Config
    const billingRef = doc(db, 'billing_config', user.uid);
    const unsubscribeBilling = onSnapshot(billingRef, (docSnap) => {
      if (docSnap.exists()) {
        setBillingConfig(docSnap.data().methods || {});
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'billing_config');
    });

    return () => {
      unsubscribe();
      unsubscribeChurch();
      unsubscribeBilling();
    };
  }, [user]);

  const [lookupLoading, setLookupLoading] = useState(false);

  const handleChurchDataChange = (field: string, value: string) => {
    let formattedValue = value;
    
    if (field === 'cnpj') {
      formattedValue = value.replace(/\D/g, '');
      if (formattedValue.length > 14) formattedValue = formattedValue.slice(0, 14);
      formattedValue = formattedValue.replace(/^(\d{2})(\d)/, '$1.$2');
      formattedValue = formattedValue.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
      formattedValue = formattedValue.replace(/\.(\d{3})(\d)/, '.$1/$2');
      formattedValue = formattedValue.replace(/(\d{4})(\d)/, '$1-$2');
      
      const digits = formattedValue.replace(/\D/g, '');
      if (digits.length === 14) {
        setTimeout(() => lookupChurchCNPJ(digits), 100);
      }
    } else if (field === 'zipCode') {
      formattedValue = value.replace(/\D/g, '');
      if (formattedValue.length > 8) formattedValue = formattedValue.slice(0, 8);
      formattedValue = formattedValue.replace(/^(\d{5})(\d)/, '$1-$2');
      
      const digits = formattedValue.replace(/\D/g, '');
      if (digits.length === 8) {
        setTimeout(() => lookupChurchCEP(digits), 100);
      }
    } else if (field === 'phone') {
      formattedValue = value.replace(/\D/g, '');
      if (formattedValue.length > 11) formattedValue = formattedValue.slice(0, 11);
      
      if (formattedValue.length > 10) {
        formattedValue = formattedValue.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      } else if (formattedValue.length > 2) {
        formattedValue = formattedValue.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
      } else if (formattedValue.length > 0) {
        formattedValue = formattedValue.replace(/^(\d*)/, '($1');
      }
    }

    setChurchData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const lookupChurchCNPJ = async (cnpjParam?: string) => {
    const cnpj = (cnpjParam || churchData.cnpj)?.replace(/\D/g, '');
    if (!cnpj || cnpj.length !== 14) return;

    setLookupLoading(true);
    try {
      const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      const data = response.data;
      
      setChurchData(prev => ({
        ...prev,
        socialName: data.razao_social || prev.socialName,
        ministry: data.nome_fantasia || data.razao_social || prev.ministry,
        address: data.logradouro ? `${data.logradouro}, ${data.numero || ''} ${data.complemento || ''}`.trim() : prev.address,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
        zipCode: data.cep ? data.cep.replace(/^(\d{5})(\d{3})/, '$1-$2') : prev.zipCode,
        phone: data.ddd_telefone_1 ? data.ddd_telefone_1.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : prev.phone,
        email: data.email || prev.email,
      }));
    } catch (error) {
      console.error("Error looking up CNPJ:", error);
    } finally {
      setLookupLoading(false);
    }
  };

  const lookupChurchCEP = async (cepParam?: string) => {
    const cep = (cepParam || churchData.zipCode)?.replace(/\D/g, '');
    if (!cep || cep.length !== 8) return;

    setLookupLoading(true);
    try {
      const response = await axios.get(`https://brasilapi.com.br/api/cep/v1/${cep}`);
      const data = response.data;
      
      setChurchData(prev => ({
        ...prev,
        address: data.street ? `${data.street}, bairro ${data.neighborhood}` : prev.address,
        city: data.city || prev.city,
        state: data.state || prev.state,
      }));
    } catch (error) {
      console.error("Error looking up CEP:", error);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSenderEmail.trim() || !user) return;
    try {
      await addDoc(collection(db, 'sender_emails'), { 
        email: newSenderEmail.trim(),
        userId: user.uid
      });
      
      logActivity({
        userId: user.uid,
        userName: user.displayName || 'Usuário',
        action: 'E-mail de Emitente Adicionado',
        details: newSenderEmail.trim(),
        type: 'email'
      });

      setNewSenderEmail('');
    } catch (err) {
      console.error('Erro ao adicionar e-mail:', err);
    }
  };

  const handleRemoveSender = async (id: string) => {
    const emailToRemove = registeredSenders.find(s => s.id === id)?.email;
    const confirmed = await confirmAction(
      'Remover e-mail?',
      `Tem certeza que deseja remover ${emailToRemove || 'este e-mail'} dos emissores autorizados?`,
      'Sim, remover',
      'Cancelar',
      '#ef4444' // red-500
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'sender_emails', id));
      
      if (user) {
        logActivity({
          userId: user.uid,
          userName: user.displayName || 'Usuário',
          action: 'E-mail de Emitente Removido',
          details: emailToRemove || id,
          type: 'email'
        });
      }
      showSuccess('Removido!', 'E-mail excluído com sucesso.');
    } catch (err) {
      console.error('Erro ao remover e-mail:', err);
      showError('Erro', 'Ocorreu um erro ao remover o e-mail.');
    }
  };

  const checkStatus = async () => {
    setGoogleStatus('loading');
    
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        setGoogleAccounts(data.googleAccounts || []);
        setGoogleStatus(data.google ? 'connected' : 'disconnected');
        setGoogleConfigured(data.config?.google || false);
        if (data.config?.mapsKey) setMapsKey(data.config.mapsKey);
      }
    } catch (err) {
      console.error('Erro ao verificar status:', err);
      setGoogleStatus('disconnected');
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    const confirmed = await confirmAction(
      'Salvar chaves de API?',
      'Deseja atualizar as credenciais do Google?'
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/config/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleId,
          googleSecret,
          mapsKey
        })
      });
      if (res.ok) {
        showSuccess('Sucesso!', 'Configurações salvas corretamente.');
        checkStatus();
      } else {
        showError('Erro', 'Não foi possível salvar as chaves no servidor.');
      }
    } catch (err) {
      showError('Erro', 'Ocorreu um erro de conexão.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnect = async (provider: 'google') => {
    try {
      const res = await fetch(`/api/auth/${provider}/url`);
      const data = await res.json();
      
      if (!res.ok) {
        showError('Erro de conexão', data.error || `Erro ao conectar ao ${provider}`);
        return;
      }

      // Debug mismatch
      if (data.redirectUri) {
        const currentUri = `${window.location.protocol}//${window.location.hostname}/auth/${provider}/callback`;
        if (data.redirectUri !== currentUri) {
          console.warn('OAuth Redirect URI Mismatch:', { server: data.redirectUri, client: currentUri });
        }
      }

      if (data.url) {
        const popup = window.open(data.url, 'oauth_popup', 'width=600,height=700');
        
        // Listen for success message
        const messageHandler = (event: MessageEvent) => {
          if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === provider) {
            checkStatus();
            
            if (user) {
              logActivity({
                userId: user.uid,
                userName: user.displayName || 'Usuário',
                action: 'Conta Conectada',
                details: `${provider.charAt(0).toUpperCase() + provider.slice(1)} autenticado com sucesso.`,
                type: 'account'
              });
            }

            window.removeEventListener('message', messageHandler);
          }
        };
        window.addEventListener('message', messageHandler);
      }
    } catch (err) {
      console.error(`Error connecting to ${provider}:`, err);
      showError('Erro na conexão', 'O servidor não respondeu como esperado.');
    }
  };

  const handleDisconnect = async (provider: 'google', email?: string) => {
    const confirmed = await confirmAction(
      'Desconectar conta?',
      `Tem certeza que deseja remover o acesso dessa conta ${provider}?`,
      'Sim, desconectar',
      'Cancelar',
      '#ef4444' // red-500
    );

    if (!confirmed) return;

    try {
      await fetch(`/api/auth/${provider}/logout`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      showSuccess('Desconectado!', `A conta ${provider} foi removida da sincronização.`);
      checkStatus();
    } catch (err) {
      console.error(`Error disconnecting ${provider}:`, err);
      showError('Erro', 'Não foi possível desconectar a conta agora.');
    }
  };

  const handleExportBackup = async () => {
    if (!user) return;
    setIsBackupLoading(true);
    try {
      const q = query(collection(db, 'events'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        // Convert Timestamps to strings for Excel
        start: doc.data().start instanceof Object && 'toDate' in doc.data().start ? doc.data().start.toDate().toISOString() : doc.data().start,
        end: doc.data().end instanceof Object && 'toDate' in doc.data().end ? doc.data().end.toDate().toISOString() : doc.data().end,
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Eventos");
      
      const fileName = `Backup_Agenda_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      logActivity({
        userId: user.uid,
        userName: user.displayName || 'Usuário',
        action: 'Backup Exportado',
        details: `${data.length} eventos exportados para Excel.`,
        type: 'system'
      });
      
      showSuccess('Backup Concluído', `${data.length} eventos exportados com sucesso.`);
    } catch (err) {
      console.error('Erro ao exportar backup:', err);
      showError('Erro de Backup', 'Ocorreu um erro ao gerar o arquivo.');
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    const confirmed = await confirmAction(
      'Importar Backup?',
      'Isso lerá a planilha e adicionará os eventos ao seu banco de dados. Deseja prosseguir?'
    );

    if (!confirmed) {
      e.target.value = '';
      return;
    }
    
    setIsBackupLoading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const bstr = event.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('Planilha vazia ou formato inválido.');
        }

        const batch = writeBatch(db);
        data.forEach((item: any) => {
          // Remove ID to avoid conflicts and set current user
          const { id, ...cleanData } = item;
          const docRef = doc(collection(db, 'events'));
          batch.set(docRef, {
            ...cleanData,
            userId: user.uid,
            createdAt: new Date().toISOString()
          });
        });

        await batch.commit();
        showSuccess('Restauração Concluída!', `${data.length} eventos foram importados do backup.`);
        
        logActivity({
          userId: user.uid,
          userName: user.displayName || 'Usuário',
          action: 'Backup Importado',
          details: `${data.length} eventos restaurados via Excel.`,
          type: 'system'
        });
      } catch (err) {
        console.error('Erro ao importar backup:', err);
        showError('Erro na Importação', 'Não foi possível processar o arquivo. Verifique se ele está no formato correto de backup.');
      } finally {
        setIsBackupLoading(false);
        // Reset input
        e.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleSaveChurchData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const confirmed = await confirmAction(
      'Salvar Informações?',
      `Confirmar atualização dos dados de ${churchData.socialName || 'sua igreja'}?`
    );

    if (!confirmed) return;

    setIsSaving(true);
    try {
      await setDoc(doc(db, 'church_data', user.uid), {
        ...churchData,
        userId: user.uid,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      logActivity({
        userId: user.uid,
        userName: user.displayName || 'Usuário',
        action: 'Dados da Igreja Atualizados',
        details: churchData.socialName,
        type: 'system'
      });

      showSuccess('Salvo!', 'Os dados institucionais foram atualizados no sistema.');
    } catch (err) {
      console.error('Erro ao salvar dados da igreja:', err);
      showError('Erro ao Salvar', 'Houve um problema de permissão ou conexão ao gravar os dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'billing_config', user.uid), {
        methods: billingConfig,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showSuccess('Salvo!', 'Configurações de prazos de pagamento atualizadas.');
      
      logActivity({
        userId: user.uid,
        userName: user.displayName || 'Usuário',
        action: 'Configuração de Prazos Atualizada',
        details: 'Novos dias de fechamento e vencimento definidos.',
        type: 'system'
      });
    } catch (err) {
      console.error('Erro ao salvar billing:', err);
      showError('Erro', 'Ocorreu um erro ao salvar as configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit to 500KB per image to avoid Firestore document 1MB limit
    if (file.size > 512000) {
      showError('Imagem muito grande', 'Por favor, selecione uma imagem mais leve (até 500KB).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setChurchData(prev => ({
        ...prev,
        logos: [...prev.logos, base64String]
      }));
    };
    reader.readAsDataURL(file);
    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  const removeLogo = async (index: number) => {
    const confirmed = await confirmAction('Apagar Logo', 'Essa imagem será removida, deseja continuar?', 'Remover', 'Cancelar', '#ef4444');
    if (!confirmed) return;

    setChurchData(prev => ({
      ...prev,
      logos: prev.logos.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 md:p-8 w-full max-w-[1400px] mx-auto space-y-8 pt-0">
        <div className="flex flex-col md:flex-row gap-6 lg:gap-12 mt-4">
          {/* Sidebar Tab Navigation */}
          <div className="flex flex-col gap-2 w-full md:w-72 shrink-0 h-fit">
            {[
              { id: 'accounts', label: 'Conectar Contas', icon: Calendar },
              { id: 'emails', label: 'E-mails de Envio', icon: Mail },
              { id: 'shortcuts', label: 'Sistema e Atalhos', icon: Layout },
              { id: 'backup', label: 'Backup de Dados', icon: Database },
              { id: 'infrastructure', label: 'Infraestrutura e Banco', icon: HardDrive },
              { id: 'billing', label: 'Prazos e Fechamentos', icon: CreditCard },
              { id: 'church', label: 'Dados da Igreja', icon: Church },
              { id: 'api', label: 'Configurações de API', icon: Key },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`group relative flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 w-full text-left overflow-hidden ${
                    isActive
                      ? 'text-cyan-700 dark:text-cyan-300 shadow-sm bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/40 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {/* Left Accent Bar */}
                  {isActive && (
                    <motion.div 
                      layoutId="sidebar-active-indicator"
                      className="absolute left-0 top-2 bottom-2 w-1.5 bg-cyan-500 rounded-r-full" 
                    />
                  )}
                  {/* Subtle Background Gradient for Active State */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-50/50 to-transparent dark:from-cyan-900/10 dark:to-transparent opacity-50" />
                  )}
                  
                  {/* Icon Container */}
                  <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isActive 
                      ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 shadow-inner' 
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:text-cyan-500 group-hover:shadow-sm'
                  }`}>
                    <tab.icon className="w-5 h-5" />
                  </div>
                  
                  <span className="relative z-10 tracking-wide">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-w-0">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
          {activeTab === 'infrastructure' && (
            <div className="space-y-6">
              <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center">
                    <Database className="w-7 h-7 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-slate-900 dark:text-white">Status do Banco de Dados</h3>
                    <p className="text-sm text-slate-500">Gerencie a conexão com o Google Firebase</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Conexão Firestore</p>
                    <div className="flex items-center gap-2">
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                       <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Ativo e Conectado</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Região do Projeto</p>
                    <div className="flex items-center gap-2">
                       <Globe className="w-4 h-4 text-blue-500" />
                       <span className="text-sm font-bold text-slate-700 dark:text-slate-200">southamerica-east1 (SP)</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ID do Projeto</p>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                       <Key className="w-4 h-4 text-amber-500" />
                       <span className="text-[11px] font-mono font-bold truncate">gen-lang-client-0046634371</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-black text-amber-900 dark:text-amber-200 uppercase tracking-tight">O Login parou de funcionar?</h4>
                        <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed mt-1">
                          Toda vez que o endereço do seu app muda (como ao compartilhar ou trocar de conta), o Google exige que você autorize o novo domínio por segurança.
                        </p>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 bg-white/50 dark:bg-black/20 rounded-xl px-4 py-2 flex items-center justify-between border border-amber-200/50 dark:border-amber-700/30">
                          <code className="text-[11px] font-mono text-amber-900 dark:text-amber-100 truncate mr-2">{window.location.hostname}</code>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(window.location.hostname);
                              showSuccess('Copiado!', 'Domínio copiado para a área de transferência.');
                            }}
                            className="p-1.5 hover:bg-amber-200 dark:hover:bg-amber-700 rounded-lg text-amber-700 transition-colors shrink-0"
                          >
                            <Download className="w-3.5 h-3.5 rotate-180" />
                          </button>
                        </div>
                        
                        <a 
                          href="https://console.firebase.google.com/project/gen-lang-client-0046634371/authentication/settings" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-200 dark:shadow-none"
                        >
                          <ExternalLink className="w-4 h-4" /> Ir Autorizar Agora
                        </a>
                      </div>
                      
                      <p className="text-[10px] text-amber-700/60 dark:text-amber-400/60 font-bold italic">
                        * Cole o domínio acima na lista de "Domínios Autorizados" em Configurações &gt; Domínios.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                      <Layout className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Modo de Configuração Rápida</h3>
                      <p className="text-sm text-slate-500">Peça para mim (sua IA) ajustar o sistema</p>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      const confirmed = await confirmAction('Solicitar Ajuste?', 'Deseja que eu revise as regras de segurança e a conexão agora?');
                      if (confirmed) {
                         showSuccess('Solicitação Enviada!', 'Agora basta me enviar uma mensagem no chat dizendo: "Revise meu Firebase".');
                      }
                    }}
                    className="px-6 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all active:scale-95"
                  >
                    Resetar Conexão IA
                  </button>
                </div>
              </section>
            </div>
          )}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl flex items-center justify-center">
                    <CreditCard className="w-7 h-7 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-slate-900 dark:text-white">Prazos e Fechamentos</h3>
                    <p className="text-sm text-slate-500">Configure as regras de vencimento para cada meio de pagamento</p>
                  </div>
                </div>

                <form onSubmit={handleSaveBilling} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {Object.keys(billingConfig).map((method) => (
                      <div key={method} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                          {method === 'Cartão de Crédito' ? <CreditCard className="w-5 h-5 text-indigo-500" /> : <Receipt className="w-5 h-5 text-emerald-500" />}
                          <h4 className="font-black text-xs uppercase tracking-widest text-slate-700 dark:text-slate-200">{method}</h4>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Dia de Fechamento</label>
                            <input 
                              type="number" 
                              min="1" 
                              max="31"
                              value={billingConfig[method].closingDay}
                              onChange={(e) => setBillingConfig(prev => ({
                                ...prev,
                                [method]: { ...prev[method], closingDay: parseInt(e.target.value) || 1 }
                              }))}
                              className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none text-sm transition-all font-bold"
                            />
                            <p className="text-[9px] text-slate-400 mt-1 italic">Ex: Dia que a fatura "vira" ou que se encerra o ciclo.</p>
                          </div>
                          
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Dia de Vencimento</label>
                            <input 
                              type="number" 
                              min="1" 
                              max="31"
                              value={billingConfig[method].dueDay}
                              onChange={(e) => setBillingConfig(prev => ({
                                ...prev,
                                [method]: { ...prev[method], dueDay: parseInt(e.target.value) || 1 }
                              }))}
                              className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none text-sm transition-all font-bold"
                            />
                            <p className="text-[9px] text-slate-400 mt-1 italic">Ex: Dia fixo do pagamento (ex: todo dia 10).</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex gap-4">
                    <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-xl h-fit">
                      <AlertCircle className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="text-xs text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
                      <p className="font-bold mb-1">Como funciona a lógica inteligente?</p>
                      Se você lançar uma conta no dia <strong>11</strong> e o fechamento for dia <strong>10</strong>, o sistema jogará o vencimento automaticamente para o mês seguinte (no dia de vencimento escolhido). Se lançar no dia <strong>05</strong>, vencerá no <strong>mesmo mês</strong>.
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex items-center gap-2 px-8 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-cyan-200 dark:shadow-none"
                    >
                      {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      Salvar Regras de Prazos
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
          {activeTab === 'accounts' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Google Calendar Integration */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-xl flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Google Calendar</h3>
                      <p className="text-sm text-slate-500">Múltiplas contas suportadas</p>
                    </div>
                  </div>
                  <button 
                    onClick={checkStatus}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Atualizar status"
                  >
                    <RefreshCw className={`w-4 h-4 text-slate-400 ${googleStatus === 'loading' ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  {googleAccounts.length > 0 ? (
                    googleAccounts.map((email) => (
                      <div key={email} className="flex items-center justify-between p-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          <span className="text-sm font-medium text-green-800 dark:text-green-300 truncate">{email}</span>
                        </div>
                        <button 
                          onClick={() => handleDisconnect('google', email)}
                          className="text-[10px] font-bold text-red-600 hover:text-red-700 uppercase p-1"
                        >
                          Sair
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <AlertCircle className="w-5 h-5 text-slate-400" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {!googleConfigured ? 'Falta Configurar Chaves' : 'Nenhuma conta conectada'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-auto">
                  {googleConfigured && (
                    <button 
                      onClick={() => handleConnect('google')}
                      className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white hover:opacity-90 transition-opacity text-sm font-bold shadow-lg"
                    >
                      Conectar Outra Conta Google
                    </button>
                  )}
                  
                  {!googleConfigured && (
                    <p className="text-[10px] text-center text-amber-600 font-bold uppercase">Configure o Client ID na aba API para habilitar</p>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'emails' && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm max-w-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-cyan-50 dark:bg-cyan-500/10 rounded-xl flex items-center justify-center">
                  <Mail className="w-6 h-6 text-cyan-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-white">E-mails do Emitente</h3>
                  <p className="text-sm text-slate-500">Cadastre seus e-mails para envio de notificações.</p>
                </div>
              </div>

              <form onSubmit={handleAddSender} className="flex gap-2 mb-8">
                <input 
                  type="email"
                  value={newSenderEmail}
                  onChange={(e) => setNewSenderEmail(e.target.value)}
                  placeholder="novo-email@exemplo.com"
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                  required
                />
                <button 
                  type="submit"
                  className="px-6 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white hover:opacity-90 transition-opacity flex items-center gap-2 font-bold"
                >
                  <Plus className="w-5 h-5" /> Adicionar
                </button>
              </form>

              <div className="space-y-3">
                {registeredSenders.length > 0 ? (
                  registeredSenders.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 group transition-all hover:border-slate-200 dark:hover:border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-500/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-cyan-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.email}</span>
                      </div>
                      <button 
                        onClick={() => handleRemoveSender(item.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-400 text-sm italic bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                    Nenhum e-mail cadastrado.
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'shortcuts' && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center">
                  <Activity className="w-6 h-6 text-indigo-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Sistema e Atalhos</h3>
                  <p className="text-sm text-slate-500">Acesse o aplicativo de forma mais rápida e produtiva.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col">
                  <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-500/10 rounded-lg flex items-center justify-center mb-4 text-cyan-600">
                    <Database className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-base mb-2">Atalho no Desktop</h4>
                  <p className="text-sm text-slate-500 mb-6 flex-1">Crie um ícone na área de trabalho do seu PC Windows para abrir este app instantaneamente.</p>
                  <button 
                    onClick={() => {
                      const url = window.location.origin;
                      const shortcutContent = `[InternetShortcut]\r\nURL=${url}\r\nIconIndex=0`;
                      const blob = new Blob([shortcutContent], { type: 'application/octet-stream' });
                      const downloadUrl = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      link.download = 'App_de_Agenda.url';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(downloadUrl);
                    }}
                    className="w-full py-3 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                    Baixar Atalho (.url)
                  </button>
                </div>

                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4 text-emerald-600">
                    <ExternalLink className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-base mb-2">Modo Tela Cheia</h4>
                  <p className="text-sm text-slate-500 mb-6 flex-1">Abra o aplicativo em uma nova aba totalmente limpa, aproveitando o máximo do seu monitor.</p>
                  <button 
                    onClick={() => window.open(window.location.origin, '_blank')}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    Abrir em Tela Cheia
                  </button>
                </div>

                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/10 rounded-lg flex items-center justify-center mb-4 text-amber-600">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-base mb-2">Instalar como PWA</h4>
                  <p className="text-sm text-slate-500 mb-6 flex-1">Use a função "Instalar Aplicativo" do navegador para fixar o ícone na sua barra de tarefas com visual de App nativo.</p>
                  <div className="flex items-center gap-2 text-[10px] text-amber-600 font-bold uppercase py-2 bg-amber-50 dark:bg-amber-500/5 rounded-lg px-2">
                    <AlertCircle className="w-3 h-3" />
                    Veja o ícone (+) na barra de endereço
                  </div>
                </div>

                {/* Sidebar Background Upload Section */}
                <div className="md:col-span-2 lg:col-span-3 p-8 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 mt-4">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="shrink-0 w-full md:w-64">
                      <div className="aspect-[4/5] rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 relative group shadow-inner">
                        {sidebarBg ? (
                          <>
                            <img 
                              src={sidebarBg} 
                              alt="Background Preview" 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                onClick={() => setSidebarBg(null)}
                                className="p-2 bg-red-600 text-white rounded-lg shadow-lg hover:scale-105 transition-transform font-bold text-xs flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" /> Remover Fundo
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                            <ImageIcon className="w-10 h-10 text-slate-400 mb-2" />
                            <p className="text-xs text-slate-500 font-medium italic">Sem imagem salva para o fundo.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 space-y-4">
                      <div>
                        <h4 className="font-bold text-lg text-slate-900 dark:text-white">Imagem de Fundo do Painel Lateral</h4>
                        <p className="text-sm text-slate-500 mt-1">Personalize o visual do seu painel com uma imagem de alta tecnologia. A imagem será salva permanentemente neste navegador.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-all group">
                          <ImagePlus className="w-8 h-8 text-cyan-500 group-hover:scale-110 transition-transform mb-2" />
                          <span className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Selecionar Imagem</span>
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 1024 * 1024) {
                                showError('Imagem Pesada', 'Por favor, use uma imagem de até 1MB para não comprometer a performance.');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => setSidebarBg(reader.result as string);
                              reader.readAsDataURL(file);
                            }}
                            className="hidden"
                          />
                        </label>

                            <div className="p-6 bg-cyan-50 dark:bg-cyan-500/10 rounded-2xl border border-cyan-100 dark:border-cyan-900/30">
                              <h5 className="text-[10px] font-black uppercase tracking-widest text-cyan-600 mb-2">Ajustes Superiores</h5>
                              <div className="space-y-4">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Cor da Capa (Overlay)</label>
                                  <div className="flex items-center gap-3">
                                    <input 
                                      type="color" 
                                      value={sidebarOverlayColor}
                                      onChange={(e) => setSidebarOverlayColor(e.target.value)}
                                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none overflow-hidden"
                                    />
                                    <span className="text-xs font-mono text-slate-500">{sidebarOverlayColor}</span>
                                  </div>
                                </div>
                                
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Opacidade: {Math.round(sidebarOverlayOpacity * 100)}%</label>
                                  <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.05" 
                                    value={sidebarOverlayOpacity}
                                    onChange={(e) => setSidebarOverlayOpacity(parseFloat(e.target.value))}
                                    className="w-full accent-cyan-500"
                                  />
                                </div>
                              </div>
                            </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'backup' && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <Database className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Backup e Restauração</h3>
                  <p className="text-sm text-slate-500">Mantenha seus dados seguros exportando para Excel ou restaurando de um backup.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Export Card */}
                <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center group">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 text-blue-600 group-hover:scale-110 transition-transform">
                    <Download className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-xl mb-3">Exportar para Excel</h4>
                  <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                    Gere uma planilha com todos os seus eventos da agenda. Use isso como um backup local ou para abrir em programas como Excel e Google Sheets.
                  </p>
                  <button 
                    onClick={handleExportBackup}
                    disabled={isBackupLoading}
                    className="w-full py-4 px-6 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl text-base font-bold shadow-xl shadow-slate-900/20 hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isBackupLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
                    Fazer Backup Agora
                  </button>
                </div>

                {/* Import Card */}
                <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center group">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 text-emerald-600 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-xl mb-3">Restaurar de Planilha</h4>
                  <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                    Selecione um arquivo de backup (.xlsx) para importar seus dados de volta para o sistema. 
                    <span className="block mt-2 text-amber-600 font-medium">⚠️ Isso adicionará os eventos como novos registros.</span>
                  </p>
                  <label className={`w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-base font-bold shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 cursor-pointer ${isBackupLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {isBackupLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <HardDrive className="w-5 h-5" />}
                    Importar Planilha Backup
                    <input 
                      type="file" 
                      accept=".xlsx, .xls"
                      onChange={handleImportBackup}
                      disabled={isBackupLoading}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'church' && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-cyan-50 dark:bg-cyan-500/10 rounded-xl flex items-center justify-center">
                  <Church className="w-6 h-6 text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Dados da Igreja</h3>
                  <p className="text-sm text-slate-500">Configure as informações oficiais da sua instituição.</p>
                </div>
              </div>

              <form onSubmit={handleSaveChurchData} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Layout className="w-4 h-4" /> Informações Gerais
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Razão Social</label>
                        <input 
                          type="text" 
                          value={churchData.socialName}
                          onChange={(e) => setChurchData({...churchData, socialName: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                          placeholder="Nome oficial da igreja"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Nome do Ministério</label>
                        <input 
                          type="text" 
                          value={churchData.ministry}
                          onChange={(e) => setChurchData({...churchData, ministry: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                          placeholder="Ex: Ministério Madureira"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">CNPJ</label>
                        <div className="relative">
                          <input 
                            type="text" 
                            value={churchData.cnpj}
                            onChange={(e) => handleChurchDataChange('cnpj', e.target.value)}
                            onBlur={() => lookupChurchCNPJ()}
                            maxLength={18}
                            className="w-full px-3 h-[22px] pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                            placeholder="00.000.000/0000-00"
                          />
                          <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                            {lookupLoading ? <RefreshCw className="w-3 h-3 text-cyan-500 animate-spin" /> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Phone className="w-4 h-4" /> Contato e Web
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Telefone Principal</label>
                        <input 
                          type="text" 
                          value={churchData.phone}
                          onChange={(e) => handleChurchDataChange('phone', e.target.value)}
                          maxLength={15}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                          placeholder="(00) 0000-0000"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">E-mail para Contato</label>
                        <input 
                          type="email" 
                          value={churchData.email}
                          onChange={(e) => setChurchData({...churchData, email: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                          placeholder="contato@igreja.org"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Leadership Info */}
                  <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Liderança e Diretoria
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Pastor Presidente</label>
                        <input 
                          type="text" 
                          value={churchData.pastorPresident}
                          onChange={(e) => setChurchData({...churchData, pastorPresident: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Vice Presidente</label>
                        <input 
                          type="text" 
                          value={churchData.vicePresident}
                          onChange={(e) => setChurchData({...churchData, vicePresident: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">1° Secretário</label>
                        <input 
                          type="text" 
                          value={churchData.secretary1}
                          onChange={(e) => setChurchData({...churchData, secretary1: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">2° Secretário</label>
                        <input 
                          type="text" 
                          value={churchData.secretary2}
                          onChange={(e) => setChurchData({...churchData, secretary2: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">1° Tesoureiro</label>
                        <input 
                          type="text" 
                          value={churchData.treasurer1}
                          onChange={(e) => setChurchData({...churchData, treasurer1: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">2° Tesoureiro</label>
                        <input 
                          type="text" 
                          value={churchData.treasurer2}
                          onChange={(e) => setChurchData({...churchData, treasurer2: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">1° Fiscal</label>
                        <input 
                          type="text" 
                          value={churchData.auditor1}
                          onChange={(e) => setChurchData({...churchData, auditor1: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">2° Fiscal</label>
                        <input 
                          type="text" 
                          value={churchData.auditor2}
                          onChange={(e) => setChurchData({...churchData, auditor2: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Diretoria (Outros Membros)</label>
                        <input 
                          type="text" 
                          value={churchData.board}
                          onChange={(e) => setChurchData({...churchData, board: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                          placeholder="Ex: Vogais, Conselheiros, etc."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Localização
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Endereço Completo</label>
                        <input 
                          type="text" 
                          value={churchData.address}
                          onChange={(e) => setChurchData({...churchData, address: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                          placeholder="Rua, Número, Complemento..."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">CEP</label>
                        <div className="relative">
                          <input 
                            type="text" 
                            value={churchData.zipCode}
                            onChange={(e) => handleChurchDataChange('zipCode', e.target.value)}
                            onBlur={() => lookupChurchCEP()}
                            maxLength={9}
                            className="w-full px-3 h-[22px] pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                            placeholder="00000-000"
                          />
                          <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                            {lookupLoading ? <RefreshCw className="w-3 h-3 text-cyan-500 animate-spin" /> : null}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Cidade</label>
                        <input 
                          type="text" 
                          value={churchData.city}
                          onChange={(e) => setChurchData({...churchData, city: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">UF</label>
                        <input 
                          type="text" 
                          value={churchData.state}
                          onChange={(e) => setChurchData({...churchData, state: e.target.value})}
                          className="w-full px-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Site Oficial</label>
                        <div className="relative">
                          <Globe className="absolute left-2.5 top-1 w-3 h-3 text-slate-400" />
                          <input 
                            type="text" 
                            value={churchData.website}
                            onChange={(e) => setChurchData({...churchData, website: e.target.value})}
                            className="w-full pl-8 pr-3 h-[22px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px]"
                            placeholder="www.igreja.org"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Logos management */}
                  <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> Logotipos da Igreja
                    </h4>
                    <p className="text-xs text-slate-500 mb-4 italic">Clique no botão abaixo para buscar as imagens de logo (1, 2 e 3) no seu computador.</p>
                    
                    <div className="flex flex-wrap gap-4">
                      <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all group min-w-[200px]">
                        <ImagePlus className="w-10 h-10 text-slate-400 group-hover:text-cyan-500 group-hover:scale-110 transition-all mb-2" />
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Selecionar do Computador</span>
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>

                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                        {churchData.logos.map((url, idx) => (
                          <div key={idx} className="relative group aspect-square rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                            <img 
                              src={url} 
                              alt={`Logo ${idx}`} 
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                type="button"
                                onClick={() => removeLogo(idx)}
                                className="p-2 bg-red-600 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                                title="Remover Logo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-slate-900/80 text-[10px] text-white rounded font-bold">
                              Logo {idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Observações / Descrição</label>
                    <textarea 
                      value={churchData.description}
                      onChange={(e) => setChurchData({...churchData, description: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] min-h-[80px]"
                      placeholder="Breve história ou informações adicionais..."
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-6">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-10 py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-2xl"
                  >
                    {isSaving ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                    Salvar Dados da Igreja
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeTab === 'api' && (
            <div className="space-y-6">
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-6">
                <h4 className="font-semibold text-amber-900 dark:text-amber-400 flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  Configuração de Chaves de API
                </h4>
                <p className="text-sm text-amber-800 dark:text-amber-500/80 leading-relaxed mb-6">
                  Insira as credenciais do Google Cloud Console para habilitar as integrações de calendário e mapas.
                </p>

                <form onSubmit={handleSaveKeys} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Google Inputs */}
                    <div className="space-y-4">
                      <h5 className="font-bold flex items-center gap-2 text-red-600">
                        <Key className="w-4 h-4" /> Google Calendar API
                      </h5>
                      <div className="space-y-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-amber-200/50">
                        <div className="p-4 bg-amber-50 dark:bg-amber-500/5 rounded-xl border border-amber-100 dark:border-amber-900/30">
                          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Checklist de Configuração (5 Minutos)
                          </p>
                          <ul className="text-[10px] text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside">
                            <li>Vá no <b>Google Cloud Console</b> e clique em <b>Credenciais</b>.</li>
                            <li>Em <b>IDs do cliente OAuth 2.0</b>, clique no ícone de lápis ✏️ do seu cliente.</li>
                            <li>Verifique o <b>Tipo de aplicativo</b>: deve ser <b>"Aplicativo da Web"</b>.</li>
                            <li>Role até <b>URIs de redirecionamento autorizados</b> e cole a URL abaixo.</li>
                          </ul>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-red-500 uppercase flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" /> URI de Redirecionamento 
                          </span>
                          <div className="flex items-center gap-2 bg-slate-50 dark:bg-black/20 p-2 rounded-lg border border-red-100">
                            <code className="text-[10px] font-mono text-red-700 dark:text-red-400 truncate flex-1 font-bold">
                              {`${window.location.protocol}//${window.location.hostname}/auth/google/callback`}
                            </code>
                            <button 
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.protocol}//${window.location.hostname}/auth/google/callback`);
                                showSuccess('Copiado!', 'URL principal copiada.');
                              }}
                              className="p-1 px-2 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700"
                            >
                              Copiar
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">OAuth Client ID</label>
                          <input 
                            type="text" 
                            value={googleId}
                            onChange={(e) => setGoogleId(e.target.value)}
                            placeholder="Ex: 57766...apps.googleusercontent.com"
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none text-sm transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">OAuth Client Secret</label>
                          <div className="relative">
                            <input 
                              type={showGoogleSecret ? "text" : "password"}
                              value={googleSecret}
                              onChange={(e) => setGoogleSecret(e.target.value)}
                              placeholder="..."
                              className="w-full pl-4 pr-12 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none text-sm transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowGoogleSecret(!showGoogleSecret)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-500 transition-colors p-1"
                            >
                              {showGoogleSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="font-bold flex items-center gap-2 text-cyan-600">
                        <MapPin className="w-4 h-4" /> Google Maps Platform
                      </h5>
                      <div className="space-y-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-amber-200/50">
                        <div className="p-4 bg-cyan-50 dark:bg-cyan-500/5 rounded-xl border border-cyan-100 dark:border-cyan-900/30">
                          <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Erros de Faturamento (Billing)?
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed italic">
                            Se você vir o erro <b>"BillingNotEnabled"</b> ou <b>"ApiNotActivated"</b>, ative o faturamento no Google Cloud Console e ative a <b>"Places API"</b> e <b>"Geocoding API"</b>.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Google Maps API Key</label>
                          <div className="relative">
                            <input 
                              type={showMapsKey ? "text" : "password"}
                              value={mapsKey}
                              onChange={(e) => setMapsKey(e.target.value)}
                              placeholder="AIzaSy..."
                              className="w-full pl-4 pr-12 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none text-sm transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowMapsKey(!showMapsKey)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-500 transition-colors p-1"
                            >
                              {showMapsKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        <div className="pt-2">
                           <a 
                            href="https://console.cloud.google.com/google/maps-apis/credentials" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-cyan-600 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> Gerenciar chaves no Google Cloud
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex items-center gap-2 px-8 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-xl"
                    >
                      {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      Salvar Todas as Configurações
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
