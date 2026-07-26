
import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Plus, 
  Calendar as CalendarIcon, 
  Calendar,
  DollarSign, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Settings, 
  CheckCircle2, 
  AlertCircle,
  TrendingDown,
  PieChart as PieChartIcon,
  ChartPie,
  Wallet,
  FileText,
  Trash2,
  Edit3,
  ListFilter,
  ArrowUp,
  ArrowDown,
  LayoutDashboard,
  Users,
  LineChart as LineChartIcon,
  Search,
  MoreHorizontal,
  PlusCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Wifi,
  Zap,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from 'recharts';
import { format, addMonths, setDate, isAfter, parseISO, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs, Timestamp, orderBy, deleteDoc, getDoc, increment } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { CreditCardConfig, Transaction, Invoice, CATEGORIES, InvoiceStatus, PixContact } from '../../lib/financas-types';
import { showSuccess, showError, showInfo, confirmDeleteAction, confirmRecurrentDeleteAction, confirmSaveAction, confirmInstallmentAction, confirmPayAction, confirmAction } from '../../lib/alerts';

const BANK_VARIANTS: Record<string, { color: string; secondary: string; name: string; gradient: string; sparkle?: boolean; logoPos?: 'top-right' | 'top-left' }> = {
  'Digio': { color: 'bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-800', secondary: 'bg-white/20', name: 'digio', gradient: '', sparkle: true, logoPos: 'top-right' },
  'Bradesco': { color: 'bg-gradient-to-br from-rose-700 to-rose-900', secondary: 'bg-white/10', name: 'Bradesco', gradient: '', logoPos: 'top-left' },
  'Nubank': { color: 'bg-gradient-to-br from-purple-600 to-purple-800', secondary: 'bg-white/10', name: 'Nubank', gradient: '', logoPos: 'top-right' },
  'Inter': { color: 'bg-gradient-to-br from-orange-400 to-orange-600', secondary: 'bg-white/20', name: 'Inter', gradient: '', logoPos: 'top-right' },
  'Itau': { color: 'bg-gradient-to-br from-blue-700 to-blue-900', secondary: 'bg-orange-500/20', name: 'Itaú', gradient: '', logoPos: 'top-left' },
  'Santander': { color: 'bg-gradient-to-br from-red-600 to-red-800', secondary: 'bg-white/10', name: 'Santander', gradient: '', logoPos: 'top-left' },
  'C6 Bank': { color: 'bg-gradient-to-br from-zinc-800 to-black', secondary: 'bg-white/5', name: 'C6 Bank', gradient: '', logoPos: 'top-right' },
  'Outro': { color: 'bg-gradient-to-br from-slate-700 to-slate-900', secondary: 'bg-white/10', name: 'Cartão', gradient: '', logoPos: 'top-right' }
};

const CreditCardChip = () => (
  <div className="w-10 h-7 bg-gradient-to-br from-yellow-200 via-yellow-400 to-yellow-600 rounded-md relative overflow-hidden shadow-inner border border-yellow-700/30">
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-3 gap-px opacity-30">
      <div className="border border-yellow-900/20"></div>
      <div className="border border-yellow-900/20"></div>
      <div className="border border-yellow-900/20"></div>
      <div className="border border-yellow-900/20"></div>
      <div className="border border-yellow-900/20"></div>
      <div className="border border-yellow-900/20"></div>
    </div>
    <div className="absolute inset-2 border border-yellow-900/20 rounded-sm"></div>
  </div>
);

export default function Financas() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<CreditCardConfig[]>([]);
  const [activeConfig, setActiveConfig] = useState<CreditCardConfig | null>(null);
  const [tempBgImage, setTempBgImage] = useState<string | null>(null);
  const [selectedCardIdForTransaction, setSelectedCardIdForTransaction] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'invoices'>('overview');
  const [chartMonth, setChartMonth] = useState(new Date().getMonth());
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [expandedInvoices, setExpandedInvoices] = useState<string[]>([]);
  const [pixContacts, setPixContacts] = useState<PixContact[]>([]);
  const [isPixTransaction, setIsPixTransaction] = useState(false);
  const [isPixContactModalOpen, setIsPixContactModalOpen] = useState(false);
  const isInitialLoad = React.useRef(true);

  // Sync chart year/month with active invoice when it changes
  useEffect(() => {
    if (activeInvoice && activeTab === 'overview' && !isInitialLoad.current) {
      setChartYear(activeInvoice.year);
      setChartMonth(activeInvoice.month);
    }
  }, [activeInvoice?.id, activeTab]);

  // Load All Transactions for global trend chart and search
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'financial_transactions'), 
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    });
    return unsubscribe;
  }, [user]);

  // Load Configs
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'credit_cards'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreditCardConfig));
      // Sort so the main config is always first naturally in the UI
      data.sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0));
      setConfigs(data);
      if (data.length > 0) {
        if (!activeConfig) {
          setActiveConfig(data[0]);
        } else {
          // Sync active config if it was updated
          const updatedActive = data.find(c => c.id === activeConfig.id);
          if (updatedActive) setActiveConfig(updatedActive);
        }
      } else {
        setIsConfigModalOpen(true);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'credit_cards');
    });
    return unsubscribe;
  }, [user]);

  // Load PIX Contacts
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'pix_contacts'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PixContact));
      setPixContacts(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'pix_contacts');
    });
    return unsubscribe;
  }, [user]);

  // Load Invoices for active card
  useEffect(() => {
    if (!user || !activeConfig?.id) {
      setInvoices([]);
      return;
    }
    const q = query(
      collection(db, 'invoices'), 
      where('userId', '==', user.uid), 
      where('cardId', '==', activeConfig.id),
      orderBy('year', 'desc'), 
      orderBy('month', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
      setInvoices(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'invoices');
    });
    return unsubscribe;
  }, [user, activeConfig]);

  // Initial selection logic (Combined)
  useEffect(() => {
    if (!user || invoices.length === 0 || !isInitialLoad.current) return;

    const now = new Date();
    let targetMonth = now.getMonth();
    let targetYear = now.getFullYear();

    // Se temos a configuração, determinamos se a "próxima fatura" já é a do mês seguinte
    if (activeConfig) {
      if (now.getDate() > activeConfig.closingDay) {
        targetMonth += 1;
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear += 1;
        }
      }
    }

    const openInvoices = invoices.filter(i => i.status === 'Aberta');
    const targetInvoice = invoices.find(i => i.month === targetMonth && i.year === targetYear);
    
    // Selecionar: Aberta que bate com o mês alvo > Qualquer Aberta > Mês Alvo > Calendário > Qualquer
    const foundActive = openInvoices.find(i => i.month === targetMonth && i.year === targetYear)
      || openInvoices[0]
      || targetInvoice
      || invoices.find(i => i.month === now.getMonth() && i.year === now.getFullYear())
      || invoices[0];

    if (foundActive) {
      setActiveInvoice(foundActive);
      setChartMonth(foundActive.month);
      setChartYear(foundActive.year);
      
      // Permitir futuras sincronizações automáticas após a seleção inicial
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 100);
    }
  }, [invoices, activeConfig, user]);

  // Load Transactions for active invoice
  useEffect(() => {
    if (!user || !activeInvoice?.id || !activeConfig?.id) return;
    const q = query(
      collection(db, 'financial_transactions'), 
      where('userId', '==', user.uid), 
      where('cardId', '==', activeConfig.id),
      where('invoiceId', '==', activeInvoice.id),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'financial_transactions');
    });
    return unsubscribe;
  }, [user, activeInvoice]);

  const totalUnpaid = invoices
    .filter(i => i.status !== 'Paga')
    .reduce((sum, inv) => sum + inv.totalAmount, 0);

  const availableLimit = activeConfig ? activeConfig.limit - totalUnpaid : 0;
  const limitPercentage = activeConfig ? (totalUnpaid / activeConfig.limit) * 100 : 0;
  const activeInvoiceTotal = activeInvoice?.totalAmount || 0;

  // Variáveis para cálculos dinâmicos de tendência
  const currentMonthIdx = activeInvoice?.month ?? new Date().getMonth();
  const currentYearIdx = activeInvoice?.year ?? new Date().getFullYear();
  const prevMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
  const prevYearIdx = currentMonthIdx === 0 ? currentYearIdx - 1 : currentYearIdx;

  const prevInvoice = invoices.find(i => i.month === prevMonthIdx && i.year === prevYearIdx);
  const prevTotal = prevInvoice?.totalAmount || 0;
  
  // 1. Tendência de Saldo Total (Baseado na diferença de gastos do mês anterior)
  const saldoTrend = prevTotal - activeInvoiceTotal;
  const saldoTrendText = (saldoTrend >= 0 ? '+' : '') + saldoTrend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
  const saldoIsPositive = saldoTrend >= 0; // Gastar menos = Saldo melhor

  // 2. Tendência de Fatura Aberta (%)
  const invTrendVal = prevTotal > 0 ? ((activeInvoiceTotal - prevTotal) / prevTotal) * 100 : 0;
  const invTrendText = (invTrendVal >= 0 ? '+' : '') + invTrendVal.toFixed(2) + '%';
  const invIsPositive = invTrendVal <= 0; // Fatura menor = Bom

  // 3. Tendência de Limite Comprometido (%)
  // Comparando total atual vs total que seria se o mês anterior fosse o único gasto
  const committedPrev = totalUnpaid - activeInvoiceTotal + prevTotal;
  const commitmentTrendVal = committedPrev > 0 ? ((totalUnpaid - committedPrev) / committedPrev) * 100 : 0;
  const commitmentTrendText = (commitmentTrendVal >= 0 ? '+' : '') + commitmentTrendVal.toFixed(2) + '%';
  const commitmentIsPositive = commitmentTrendVal <= 0; // Comprometer menos limite = Bom

  // 4. Despesas do Mês Atual (Calendário Civil) e Tendência
  const today = new Date();
  const currentMonthStart = startOfMonth(today);
  const currentMonthEnd = endOfMonth(today);
  const lastMonthStart = startOfMonth(addMonths(today, -1));
  const lastMonthEnd = endOfMonth(addMonths(today, -1));

  const monthExpenses = allTransactions
    .filter(t => {
      const d = parseISO(t.date);
      return d >= currentMonthStart && d <= currentMonthEnd;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const lastMonthExpenses = allTransactions
    .filter(t => {
      const d = parseISO(t.date);
      return d >= lastMonthStart && d <= lastMonthEnd;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const expTrendDiffVal = monthExpenses - lastMonthExpenses;
  const expTrendText = (expTrendDiffVal >= 0 ? '+' : '') + expTrendDiffVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
  const expIsPositive = expTrendDiffVal <= 0; // Despesas menores = Bom

  const stats = [
    { label: 'Saldo Total', value: availableLimit, color: 'border-indigo-600', trend: saldoTrendText, positive: saldoIsPositive },
    { label: 'Fatura Aberta', value: activeInvoiceTotal, color: 'border-emerald-500', trend: invTrendText, positive: invIsPositive },
    { label: 'Limite Comprometido', value: totalUnpaid, color: 'border-amber-500', trend: commitmentTrendText, positive: commitmentIsPositive },
    { label: 'Despesas Mês', value: monthExpenses, color: 'border-rose-500', trend: expTrendText, positive: expIsPositive },
  ];

  const handleSaveConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const cardId = formData.get('cardId') as string;
    const isMain = formData.get('isMain') === 'on';
    
    const confirmed = await confirmSaveAction(!!cardId);
    if (!confirmed) return;
    
    const newConfig = {
      userId: user!.uid,
      limit: Number(formData.get('limit')),
      closingDay: Number(formData.get('closingDay')),
      dueDay: Number(formData.get('dueDay')),
      label: formData.get('label') as string,
      bank: formData.get('bank') as string,
      bgImage: tempBgImage || (formData.get('bgImage') as string),
      isMain
    };

    try {
      // If this card is set as main, reset all others
      if (isMain) {
        const qOther = query(collection(db, 'credit_cards'), where('userId', '==', user!.uid), where('isMain', '==', true));
        const snap = await getDocs(qOther);
        const updates = snap.docs.map(d => {
          if (d.id !== cardId) {
            return updateDoc(doc(db, 'credit_cards', d.id), { isMain: false });
          }
          return Promise.resolve();
        });
        await Promise.all(updates);
      }

      if (cardId) {
        await updateDoc(doc(db, 'credit_cards', cardId), newConfig);
      } else {
        const docRef = await addDoc(collection(db, 'credit_cards'), newConfig);
        setActiveConfig({ id: docRef.id, ...newConfig } as CreditCardConfig);
      }
      setIsConfigModalOpen(false);
      showSuccess('Configuração salva!');
    } catch (error) {
      console.error(error);
      showError('Erro ao salvar configuração');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showError('A imagem deve ter menos de 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempBgImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPixContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const pixKey = formData.get('pixKey') as string;
    
    try {
      const newContact = {
        userId: user!.uid,
        name,
        pixKey,
        avatarSeed: Math.random().toString(36).substring(7)
      };
      
      const docRef = await addDoc(collection(db, 'pix_contacts'), newContact);
      setIsPixContactModalOpen(false);
      showSuccess('Contato adicionado com sucesso!');
    } catch (error) {
      console.error(error);
      showError('Erro ao adicionar contato PIX.');
    }
  };

  const getTargetInvoiceId = async (purchaseDate: Date, cardId: string): Promise<string> => {
    const card = configs.find(c => c.id === cardId);
    if (!card) throw new Error("Card not found");
    
    const day = purchaseDate.getDate();
    let month = purchaseDate.getMonth();
    let year = purchaseDate.getFullYear();

    // If purchase day > closing day, it goes to the next month's invoice
    if (day > card.closingDay) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }

    // Check if invoice exists, if not create it
    const q = query(
      collection(db, 'invoices'), 
      where('userId', '==', user!.uid), 
      where('cardId', '==', cardId),
      where('month', '==', month), 
      where('year', '==', year)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    } else {
      const closingDate = setDate(new Date(year, month, 1), card.closingDay).toISOString();
      let dueDate = setDate(new Date(year, month, 1), card.dueDay).toISOString();
      
      // If dueDay < closingDay, it's usually next month
      if (card.dueDay <= card.closingDay) {
        dueDate = setDate(addMonths(new Date(year, month, 1), 1), card.dueDay).toISOString();
      }

      const newInvoice = {
        userId: user!.uid,
        cardId,
        month,
        year,
        status: 'Aberta' as InvoiceStatus,
        totalAmount: 0,
        paidAmount: 0,
        closingDate,
        dueDate
      };
      const docRef = await addDoc(collection(db, 'invoices'), newInvoice);
      return docRef.id;
    }
  };

  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const confirmed = await confirmSaveAction(false);
    if (!confirmed) return;

    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const dateStr = formData.get('date') as string;
    const installments = Number(formData.get('installments')) || 1;
    const cardId = formData.get('cardId') as string;
    const date = parseISO(dateStr);
    const purchaseGroupId = `pg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let txDescription = formData.get('description') as string;
    let txCategory = formData.get('category') as string;
    let txDetails = formData.get('details') as string;

    if (isPixTransaction) {
      const contactId = formData.get('pixContactId') as string;
      const contact = pixContacts.find(c => c.id === contactId);
      if (contact) {
        txDescription = `PIX p/ ${contact.name}`;
      }
      txCategory = 'Transferências';
      txDetails = formData.get('pixDetails') as string || `PIX via Crédito. Chave: ${contact?.pixKey || ''}`;
    }

    try {
      let firstInvoiceId = '';
      for (let i = 0; i < installments; i++) {
        const currentPlateDate = addMonths(date, i);
        const invoiceId = await getTargetInvoiceId(currentPlateDate, cardId);
        if (i === 0) firstInvoiceId = invoiceId;
        
        const installmentAmount = Number((amount / installments).toFixed(2));

        const transaction = {
          userId: user!.uid,
          description: txDescription + (installments > 1 && !isPixTransaction ? ` (${i + 1}/${installments})` : ''),
          amount: installmentAmount,
          category: txCategory,
          costCenter: formData.get('costCenter') as string,
          details: txDetails,
          date: currentPlateDate.toISOString(),
          installments: isPixTransaction ? 1 : installments,
          currentInstallment: isPixTransaction ? 1 : (i + 1),
          totalInstallments: isPixTransaction ? 1 : installments,
          purchaseGroupId,
          invoiceId,
          cardId
        };

        await addDoc(collection(db, 'financial_transactions'), transaction);
        
        // Update invoice total
        const invRef = doc(db, 'invoices', invoiceId);
        await updateDoc(invRef, { totalAmount: increment(installmentAmount) });
      }

      setIsTransactionModalOpen(false);
      setIsPixTransaction(false);
      showSuccess(isPixTransaction ? 'PIX lançado!' : 'Compra lançada!');

      // If the first installment is in a different invoice, warn the user
      if (activeInvoice?.id && firstInvoiceId !== activeInvoice.id) {
        showInfo(`O valor foi lançado em uma fatura futura devido à data.`);
      }
    } catch (error) {
      console.error(error);
      showError('Erro ao lançar transação');
    }
  };

  const handlePayInvoice = async (invoiceToPay?: Invoice) => {
    const targetInvoice = invoiceToPay || activeInvoice;
    if (!targetInvoice?.id) return;
    
    const formattedAmount = targetInvoice.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const confirmed = await confirmPayAction(formattedAmount);
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'invoices', targetInvoice.id), { status: 'Paga', paidAmount: targetInvoice.totalAmount });
      showSuccess('Fatura paga!');
    } catch (error) {
      console.error(error);
      showError('Erro ao pagar fatura');
    }
  };

  const handleDeleteTransaction = async (transaction: Transaction) => {
    const isGroup = transaction.totalInstallments > 1 && transaction.purchaseGroupId;
    
    let deleteMode: 'single' | 'series' | null = 'single';

    if (isGroup) {
      deleteMode = await confirmInstallmentAction('delete');
      if (!deleteMode) return;
    } else {
      const confirmed = await confirmDeleteAction();
      if (!confirmed) return;
    }

    try {
      let toDelete: Transaction[] = [];
      if (deleteMode === 'single') {
        toDelete = [transaction];
      } else {
        const q = query(collection(db, 'financial_transactions'), where('purchaseGroupId', '==', transaction.purchaseGroupId));
        const snapshot = await getDocs(q);
        toDelete = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      }

      for (const item of toDelete) {
        if (!item.id) continue;
        await deleteDoc(doc(db, 'financial_transactions', item.id));
        
        // Update invoice total
        const invRef = doc(db, 'invoices', item.invoiceId);
        await updateDoc(invRef, { 
          totalAmount: increment(-item.amount) 
        });

        // Check if invoice is now empty and not the current month's invoice
        // If it's empty, we should ideally remove it, but only if it's not the current billing cycle
        const invSnap = await getDoc(invRef);
        if (invSnap.exists()) {
          const invData = invSnap.data() as Invoice;
          const isCurrentMonth = invData.month === new Date().getMonth() && invData.year === new Date().getFullYear();
          if (invData.totalAmount <= 0.01 && !isCurrentMonth && invData.status !== 'Paga') {
            await deleteDoc(invRef);
          }
        }
      }

      showSuccess('Excluído com sucesso!');
    } catch (error) {
      console.error(error);
      showError('Erro ao excluir');
    }
  };

  const handleEditTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTransaction?.id) return;

    const formData = new FormData(e.currentTarget);
    const newAmount = Number(formData.get('amount'));
    const newDescription = formData.get('description') as string;
    const newCategory = formData.get('category') as string;
    const newCostCenter = formData.get('costCenter') as string;
    const newDetails = formData.get('details') as string;
    
    const isGroup = editingTransaction.totalInstallments > 1 && editingTransaction.purchaseGroupId;
    let editMode: 'single' | 'series' | null = 'single';

    if (isGroup) {
      editMode = await confirmInstallmentAction('edit');
      if (!editMode) return;
    } else {
      const confirmed = await confirmSaveAction(true);
      if (!confirmed) return;
    }

    try {
      if (editMode === 'single') {
        const diff = newAmount - editingTransaction.amount;
        await updateDoc(doc(db, 'financial_transactions', editingTransaction.id), {
          amount: newAmount,
          description: newDescription,
          category: newCategory,
          costCenter: newCostCenter,
          details: newDetails
        });
        await updateDoc(doc(db, 'invoices', editingTransaction.invoiceId), {
          totalAmount: increment(diff)
        });
      } else {
        const q = query(collection(db, 'financial_transactions'), where('purchaseGroupId', '==', editingTransaction.purchaseGroupId));
        const snapshot = await getDocs(q);
        const allItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
        
        for (const item of allItems) {
          if (!item.id) continue;
          const diff = newAmount - item.amount;
          await updateDoc(doc(db, 'financial_transactions', item.id), {
            amount: newAmount,
            description: newDescription,
            category: newCategory,
            costCenter: newCostCenter,
            details: newDetails
          });
          await updateDoc(doc(db, 'invoices', item.invoiceId), {
            totalAmount: increment(diff)
          });
        }
      }

      setEditingTransaction(null);
      showSuccess('Alterado com sucesso!');
    } catch (error) {
      console.error(error);
      showError('Erro ao editar');
    }
  };

  const handleResetData = async (mode: 'card' | 'all') => {
    // First confirmation
    const title = mode === 'all' ? 'Resetar Tudo?' : 'Resetar Cartão?';
    const text = mode === 'all' 
      ? 'Isso apagará TODOS os cartões, compras e faturas do seu banco de dados.'
      : `Isso apagará todas as compras e faturas do cartão selecionado (${activeConfig?.label}).`;
      
    const confirmed = await confirmAction(title, text, 'Sim, quero apagar', 'Cancelar', '#ef4444');
    if (!confirmed) return;

    // Double confirmation for full wipe
    if (mode === 'all') {
      const doubleConfirmed = await confirmAction(
        'Você tem certeza absoluta?', 
        'Essa ação não pode ser desfeita e você perderá todo o histórico financeiro.', 
        'Apagar tudo irreversivelmente!', 
        'Cancelar', 
        '#ef4444'
      );
      if (!doubleConfirmed) return;
    }
    
    try {
      if (mode === 'card' && activeConfig?.id) {
        // Delete transactions for this card
        const tSnapshot = await getDocs(query(collection(db, 'financial_transactions'), where('cardId', '==', activeConfig.id)));
        for (const d of tSnapshot.docs) await deleteDoc(doc(db, 'financial_transactions', d.id));

        // Delete invoices for this card
        const iSnapshot = await getDocs(query(collection(db, 'invoices'), where('cardId', '==', activeConfig.id)));
        for (const d of iSnapshot.docs) await deleteDoc(doc(db, 'invoices', d.id));

        // Delete the config itself
        await deleteDoc(doc(db, 'credit_cards', activeConfig.id));
        
        showSuccess('Dados do cartão foram resetados com sucesso.');
      } 
      else if (mode === 'all') {
        // Delete ALL transactions
        const tSnapshot = await getDocs(query(collection(db, 'financial_transactions'), where('userId', '==', user!.uid)));
        for (const d of tSnapshot.docs) await deleteDoc(doc(db, 'financial_transactions', d.id));

        // Delete ALL invoices
        const iSnapshot = await getDocs(query(collection(db, 'invoices'), where('userId', '==', user!.uid)));
        for (const d of iSnapshot.docs) await deleteDoc(doc(db, 'invoices', d.id));

        // Delete ALL configs
        const cSnapshot = await getDocs(query(collection(db, 'credit_cards'), where('userId', '==', user!.uid)));
        for (const d of cSnapshot.docs) await deleteDoc(doc(db, 'credit_cards', d.id));
        
        showSuccess('Todos os dados foram completamente resetados.');
      }
      
      window.location.reload();
    } catch (error) {
      console.error(error);
      showError('Erro ao resetar dados.');
    }
  };

  const categoryData = CATEGORIES.map(cat => ({
    name: cat,
    value: transactions.filter(t => t.category === cat).reduce((sum, t) => sum + t.amount, 0)
  })).filter(d => d.value > 0);

  const COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#6366f1', '#f97316', '#a855f7'];

  // Trend data for "Money Flow" based on selected month
  const chartData = Array.from({ length: 31 }, (_, i) => {
    const d = new Date(chartYear, chartMonth, i + 1);
    // Only show up to current day if it's the current month/year
    if (isAfter(d, new Date()) && chartMonth === new Date().getMonth() && chartYear === new Date().getFullYear()) return null;
    if (d.getMonth() !== chartMonth) return null;

    const dateFormatted = format(d, 'dd');
    const dayTotal = allTransactions
      .filter(t => {
        const transDate = parseISO(t.date);
        return transDate.getDate() === d.getDate() && 
               transDate.getMonth() === d.getMonth() && 
               transDate.getFullYear() === d.getFullYear();
      })
      .reduce((sum, t) => sum + t.amount, 0);
      
    return { name: dateFormatted, value: dayTotal };
  }).filter(Boolean) as { name: string, value: number }[];

  // Filter transactions based on search query
  // If searching, we show results from ALL transactions to make search useful
  const displayTransactions = (searchQuery.trim() !== '' || activeTab === 'transactions') 
    ? allTransactions 
    : transactions;
  
  const filteredTransactions = displayTransactions.filter(t => 
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Month selection for charts
  const availableMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(chartYear, i, 1);
    return { value: i, label: format(d, 'MMMM yyyy', { locale: ptBR }) };
  });

  const monthCategoryData = CATEGORIES.map(cat => ({
    name: cat,
    value: allTransactions
      .filter(t => {
        const d = parseISO(t.date);
        return d.getMonth() === chartMonth && d.getFullYear() === chartYear && t.category === cat;
      })
      .reduce((sum, t) => sum + t.amount, 0)
  })).filter(d => d.value > 0);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Top Navigation - UXLab Style */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 h-14 flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center gap-8 h-full">
          <nav className="hidden md:flex items-center gap-8 h-full pt-4">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 font-bold text-sm uppercase tracking-widest pb-4 border-b-2 transition-all ${
                activeTab === 'overview' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-indigo-500'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" /> Visão Geral
            </button>
            <button 
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center gap-2 font-bold text-sm uppercase tracking-widest pb-4 border-b transition-all ${
                activeTab === 'transactions' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-indigo-500'
              }`}
            >
              <ArrowUpRight className="w-5 h-5" /> Transações
            </button>
            <button 
              onClick={() => setActiveTab('invoices')}
              className={`flex items-center gap-2 font-bold text-sm uppercase tracking-widest pb-4 border-b transition-all ${
                activeTab === 'invoices' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-indigo-500'
              }`}
            >
              <FileText className="w-5 h-5" /> Faturas
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..." 
              className="bg-slate-100 dark:bg-slate-800 border-none rounded-full py-1.5 pl-10 pr-4 text-xs font-medium w-48 focus:ring-2 focus:ring-indigo-500/20" 
            />
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} alt="Avatar" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pt-2 pb-24 space-y-4 max-w-[1600px] w-full mx-auto px-4">
        
        {activeTab === 'overview' && (
          <>
            {/* YEAR INVOICES SELECTOR - High Density Top Bar */}
            <div className="flex items-center gap-1 sticky top-0 z-30 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-sm pt-1 pb-1">
              <div className="grid grid-cols-[repeat(12,1fr)_80px] gap-1 flex-1 h-[48px]">
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date(chartYear, i, 1);
                  const inv = invoices.find(invoice => invoice.month === i && invoice.year === chartYear);
                  const isActive = activeInvoice?.month === i && activeInvoice?.year === chartYear;
                  
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        isInitialLoad.current = false;
                        if (inv) setActiveInvoice(inv);
                        else showInfo('Nenhuma fatura para este mês');
                      }}
                      className={`flex flex-col items-center justify-center rounded-lg transition-all border relative ${
                        isActive 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm scale-[1.02]' 
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-400'
                      }`}
                    >
                      {inv && (
                        <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${inv.status === 'Paga' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      )}
                      <span className="text-[10px] font-black uppercase tracking-[0.05em] leading-none mb-1">
                        {format(date, 'MMM yy', { locale: ptBR })}
                      </span>
                      <span className="text-[10px] font-bold leading-none truncate w-full px-1 text-center">
                        {inv ? inv.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }) : 'R$ 0,00'}
                      </span>
                    </button>
                  );
                })}

                {/* Year Selector Filter */}
                <div className="relative">
                  <select 
                    value={chartYear}
                    onChange={(e) => setChartYear(Number(e.target.value))}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  >
                    {[2023, 2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <div className="flex flex-col items-center justify-center w-full h-full rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 font-black text-[10px] uppercase">
                    <Filter className="w-3 h-3 mb-0.5" />
                    {chartYear}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: My Card & Quick Actions */}
            <div className="lg:col-span-3 space-y-6">
            <div className="space-y-4">
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center justify-between px-2">
                <span>Meus Detalhes</span>
                <div className="flex items-center gap-2">
                  <select 
                    value={activeConfig?.id || ''} 
                    onChange={(e) => {
                      const selected = configs.find(c => c.id === e.target.value);
                      if (selected) setActiveConfig(selected);
                    }}
                    className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {configs.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  <button onClick={() => {
                    // Open modal for a new card by default when clicking plus
                    setIsConfigModalOpen(true);
                  }} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-lg">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => setIsConfigModalOpen(true)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-lg">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </h2>
              
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className={`relative w-full aspect-[1.586/1] rounded-xl overflow-hidden shadow-2xl shadow-slate-200 dark:shadow-none p-6 transition-all duration-500`}
                style={(activeConfig?.bgImage || tempBgImage) ? {
                  backgroundImage: `url(${tempBgImage || activeConfig?.bgImage})`,
                  backgroundSize: '100% 100%',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                } : {}}
              >
                {/* Fallback styling or Overlay for readability */}
                {(!activeConfig?.bgImage && !tempBgImage) ? (
                  <div className={`absolute inset-0 ${activeConfig?.bank ? BANK_VARIANTS[activeConfig.bank]?.color || 'bg-indigo-600' : 'bg-indigo-600'} transition-colors duration-500`} />
                ) : (
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                )}

                {/* Overlays and Textures */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Digital/Digio Sparkle fallback */}
                  {(!activeConfig?.bgImage && !tempBgImage) && activeConfig?.bank === 'Digio' && (
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, white 0.5px, transparent 0.5px)', backgroundSize: '4px 4px' }} />
                  )}
                  
                  {/* General Lighting Effects */}
                  {(!activeConfig?.bgImage && !tempBgImage) && (
                    <>
                      <div className={`absolute top-0 right-0 w-48 h-48 ${activeConfig?.bank ? BANK_VARIANTS[activeConfig.bank]?.secondary || 'bg-white/10' : 'bg-white/10'} rounded-full -mr-24 -mt-24 blur-3xl opacity-30`} />
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16 blur-2xl" />
                    </>
                  )}
                </div>
                
                <div className="relative h-full flex flex-col justify-between z-10 text-white">
                  {/* Top: Logo Positioning */}
                  {(!activeConfig?.bgImage && !tempBgImage) && (
                    <div className={`flex items-start ${activeConfig?.bank && BANK_VARIANTS[activeConfig.bank]?.logoPos === 'top-left' ? 'flex-row' : 'flex-row-reverse justify-between'}`}>
                      <div className="flex flex-col items-end">
                        {activeConfig?.bank === 'Digio' ? (
                          <span className="text-2xl font-black italic tracking-tighter leading-none lowercase drop-shadow-xl text-white">digio</span>
                        ) : (
                          <span className="text-sm font-black uppercase tracking-[0.2em] opacity-90 drop-shadow-xl text-white">{activeConfig?.bank || 'Card'}</span>
                        )}
                      </div>
                      {(!activeConfig?.bank || BANK_VARIANTS[activeConfig.bank]?.logoPos !== 'top-left') && <div className="flex-1" />}
                    </div>
                  )}

                  {/* Middle: Chip and Contactless */}
                  {(!activeConfig?.bgImage && !tempBgImage) && (
                    <div className="flex items-center gap-3">
                      <CreditCardChip />
                      <Wifi className="w-5 h-5 text-white/70 rotate-90 drop-shadow-md" />
                    </div>
                  )}

                  {/* Bottom: Limit and Brand Logo */}
                  <div className={`space-y-1 ${(!activeConfig?.bgImage && !tempBgImage) ? '' : 'mt-auto'}`}>
                    <div className="flex items-end justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[8px] uppercase opacity-90 tracking-[0.2em] font-black drop-shadow-sm text-white">Limite Disponível</p>
                        <p className="text-2xl font-black tracking-tighter leading-none drop-shadow-2xl text-white">
                          {availableLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      {(!activeConfig?.bgImage && !tempBgImage) && (
                        <div className="flex flex-col items-end">
                          <img 
                            src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" 
                            alt="Visa" 
                            className="h-5 brightness-0 invert opacity-100 mb-1 drop-shadow-xl" 
                            referrerPolicy="no-referrer" 
                          />
                          <p className="text-[10px] font-mono tracking-widest opacity-90 drop-shadow-xl text-white">**** 4026</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">
                      Fatura {activeInvoice ? format(new Date(activeInvoice.year, activeInvoice.month, 1), 'MMM/yy', { locale: ptBR }) : 'Atual'}
                    </p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                      {activeInvoiceTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex items-center gap-1 text-[10px] font-bold ${invIsPositive ? 'text-emerald-500 bg-emerald-50' : 'text-rose-500 bg-rose-50'} px-2 py-1 rounded-full`}>
                      {invTrendVal >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      {Math.abs(invTrendVal).toFixed(2)}%
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Moeda</p>
                    <p className="text-xs font-black text-slate-900 dark:text-white uppercase">BRL / Real</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                    <p className={`text-xs font-black uppercase ${activeInvoice?.status === 'Paga' ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {activeInvoice?.status || 'Ativo'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsTransactionModalOpen(true)}
                  className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" /> Lançar Compra
                </button>
              </div>
            </div>
          </div>

          {/* Right Section: Content */}
          <div className="lg:col-span-9 space-y-4">
            {/* Top Stat Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, i) => (
                <div key={i} className={`bg-white dark:bg-slate-900 rounded-xl p-4 border-l-2 ${stat.color} shadow-sm flex flex-col justify-between h-20`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stat.label}</span>
                    <span className={`text-[9px] font-black rounded-full px-1.5 py-0.5 ${stat.positive ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600'}`}>
                      {stat.trend}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white leading-none">
                    {stat.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}
                  </h3>
                </div>
              ))}
            </div>

            {/* Money Flow Chart */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden h-[280px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Fluxo de Caixa</h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select 
                      value={chartMonth}
                      onChange={(e) => setChartMonth(Number(e.target.value))}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    >
                      {availableMonths.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
                      {format(new Date(chartYear, chartMonth, 1), 'MMMM yyyy', { locale: ptBR })} <CalendarIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button onClick={() => showInfo('Opções extras')} className="p-1.5 text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex-1 mt-2 -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid-color)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 8, fontWeight: 700, fill: '#94a3b8' }} 
                    />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '10px', color: '#fff', padding: '6px' }}
                      itemStyle={{ color: '#fff', fontWeight: 700 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#7c3aed" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Grid: Expenses & History */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* All Expenses */}
              <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[300px]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Despesas</h2>
                  <select 
                    value={chartMonth}
                    onChange={(e) => setChartMonth(Number(e.target.value))}
                    className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-[9px] font-bold py-1 px-2 focus:ring-2 focus:ring-indigo-500/20 uppercase tracking-widest text-slate-600 dark:text-slate-400"
                  >
                    {availableMonths.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-6 flex-1 overflow-hidden">
                  <div className="w-32 h-32 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={monthCategoryData}
                          innerRadius={35}
                          outerRadius={55}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {monthCategoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 w-full space-y-2.5 overflow-y-auto scrollbar-hide pr-1">
                    {monthCategoryData.slice(0, 5).map((cat, i) => (
                      <div key={i} className="flex flex-col gap-1 w-full">
                        <div className="flex items-center justify-between text-[9px] font-black uppercase">
                          <span className="text-slate-400 flex items-center gap-1.5 truncate max-w-[90px]">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            {cat.name}
                          </span>
                          <span className="text-slate-900 dark:text-white">{cat.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 dark:bg-slate-800 rounded-full">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (cat.value / (monthCategoryData.reduce((s, c) => s + c.value, 0) || 1)) * 100)}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transaction History */}
              <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden h-[300px] flex flex-col">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Histórico</h2>
                  <button 
                    onClick={() => setActiveTab('transactions')}
                    className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                  >
                    Ver Tudo
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide pr-0.5 space-y-2">
                  {filteredTransactions.slice(0, 8).map((t) => (
                    <div key={t.id} className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800/10 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all px-2 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0">
                          {t.category === 'Lazer' ? <PieChartIcon className="w-4 h-4" /> : 
                           t.category === 'Alimentação' ? <ArrowUpRight className="w-4 h-4" /> :
                           <DollarSign className="w-4 h-4" />}
                        </div>
                        <div className="flex items-center gap-4">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white w-40 truncate">{t.description}</h4>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{format(parseISO(t.date), 'dd/MM', { locale: ptBR })}</p>
                          <span className="text-[9px] font-black text-slate-300 uppercase px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded-md">{t.category}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <p className={`text-xs font-black min-w-[90px] text-right ${t.amount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}
                        </p>
                        <div className="flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingTransaction(t)} className="p-1 text-slate-400 hover:text-indigo-500"><Edit3 className="w-2.5 h-2.5" /></button>
                          <button onClick={() => handleDeleteTransaction(t)} className="p-1 text-slate-400 hover:text-rose-500"><Trash2 className="w-2.5 h-2.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">Histórico de Transações</h2>
                <div className="relative">
                  <select 
                    value={chartYear}
                    onChange={(e) => setChartYear(Number(e.target.value))}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  >
                    {[2023, 2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <button className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] font-black text-indigo-600 border border-slate-100 dark:border-slate-800 uppercase tracking-tighter">
                    Ano: {chartYear} <Filter className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('overview')}
                className="text-xs font-black text-indigo-600 hover:underline uppercase"
              >
                Voltar
              </button>
            </div>
            <div className="space-y-1">
              {(() => {
                // Filter by selected year
                const yearFiltered = filteredTransactions.filter(t => parseISO(t.date).getFullYear() === chartYear);
                
                // Group transactions by purchaseGroupId if it exists and totalInstallments > 1
                const groupedMap = new Map<string, Transaction[]>();
                const singles: Transaction[] = [];

                yearFiltered.forEach(t => {
                  if (t.purchaseGroupId && t.totalInstallments && t.totalInstallments > 1) {
                    if (!groupedMap.has(t.purchaseGroupId)) {
                      groupedMap.set(t.purchaseGroupId, []);
                    }
                    groupedMap.get(t.purchaseGroupId)!.push(t);
                  } else {
                    singles.push(t);
                  }
                });

                // Convert map to array of grouped summaries
                const groups = Array.from(groupedMap.entries()).map(([groupId, items]) => {
                  // Sort installments (1st to last)
                  const sorted = [...items].sort((a,b) => (a.currentInstallment || 0) - (b.currentInstallment || 0));
                  return { groupId, items: sorted, representative: sorted[0] };
                });

                // Combine and sort by date desc
                const allDisplayItems = [
                  ...singles.map(s => ({ type: 'single' as const, data: s, date: s.date })),
                  ...groups.map(g => ({ type: 'group' as const, data: g, date: g.representative.date }))
                ].sort((a,b) => b.date.localeCompare(a.date));

                return allDisplayItems.map((item, idx) => {
                  if (item.type === 'single') {
                    const t = item.data as Transaction;
                    return (
                      <div key={t.id} className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800/10 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 px-3 rounded-xl transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0">
                            {t.category === 'Lazer' ? <PieChartIcon className="w-4 h-4" /> : 
                             t.category === 'Alimentação' ? <ArrowUpRight className="w-4 h-4" /> :
                             <DollarSign className="w-4 h-4" />}
                          </div>
                          <div className="flex items-center gap-6">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white w-64 truncate">{t.description}</h4>
                            <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-md min-w-[80px] text-center">{t.category}</span>
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-tight">{format(parseISO(t.date), 'dd/MM/yy', { locale: ptBR })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <p className={`text-sm font-black min-w-[100px] text-right ${t.amount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}
                          </p>
                          <div className="flex items-center gap-2 justify-end opacity-40 hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditingTransaction(t)} className="text-slate-300 hover:text-indigo-500 p-1.5"><Edit3 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteTransaction(t)} className="text-slate-300 hover:text-rose-500 p-1.5"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    const group = item.data as { groupId: string, items: Transaction[], representative: Transaction };
                    const isExpanded = expandedGroups.includes(group.groupId);
                    const totalGroupAmount = group.items.reduce((sum, i) => sum + i.amount, 0);

                    return (
                      <div key={group.groupId} className="border-b border-slate-50 dark:border-slate-800/10 rounded-xl overflow-hidden mb-1">
                        <div 
                          onClick={() => setExpandedGroups(prev => isExpanded ? prev.filter(id => id !== group.groupId) : [...prev, group.groupId])}
                          className="flex items-center justify-between py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 px-3 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-slate-900 dark:text-white w-64 truncate">{group.representative.description.split(' (')[0]}</h4>
                                <span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 text-[10px] font-black px-1.5 py-0.5 rounded leading-none">Parcelado</span>
                              </div>
                              <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-md min-w-[80px] text-center">{group.representative.category}</span>
                              <p className="text-xs font-bold text-slate-300 uppercase tracking-tight">{group.items.length} parcelas</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-8">
                            <p className="text-sm font-black min-w-[100px] text-right text-slate-900 dark:text-white">
                              {totalGroupAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}
                            </p>
                            <div className="flex items-center gap-2 w-[40px] justify-end">
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                          </div>
                        </div>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-slate-50/50 dark:bg-slate-800/20 ml-11 mr-3 rounded-b-xl border-t border-slate-100 dark:border-slate-800"
                            >
                              {group.items.map((t) => (
                                <div key={t.id} className="flex items-center justify-between py-2 px-3 border-b last:border-0 border-slate-100 dark:border-slate-800/50">
                                  <div className="flex items-center gap-4">
                                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded min-w-[35px] text-center">
                                      {t.currentInstallment}/{t.totalInstallments}
                                    </span>
                                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{format(parseISO(t.date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                                  </div>
                                  <div className="flex items-center gap-6">
                                    <p className={`text-xs font-black min-w-[80px] text-right ${t.amount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                      {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}
                                    </p>
                                    <div className="flex items-center gap-2 justify-end opacity-40 hover:opacity-100 transition-opacity">
                                      <button onClick={() => setEditingTransaction(t)} className="text-slate-300 hover:text-indigo-500 p-1"><Edit3 className="w-3 h-3" /></button>
                                      <button onClick={() => handleDeleteTransaction(t)} className="text-slate-300 hover:text-rose-500 p-1"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }
                });
              })()}
              {filteredTransactions.length === 0 && (
                <div className="py-12 text-center">
                  <Search className="w-6 h-6 text-slate-200 mx-auto mb-1" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Sem resultados</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 pt-6 border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between mb-0 px-1">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">Gestão de Faturas</h2>
                <div className="relative">
                  <select 
                    value={chartYear}
                    onChange={(e) => setChartYear(Number(e.target.value))}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  >
                    {[2023, 2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <button className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] font-black text-indigo-600 border border-slate-100 dark:border-slate-800 uppercase tracking-tighter">
                    Ano: {chartYear} <Filter className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              {Array.from({ length: 12 }).map((_, monthIndex) => {
                const inv = invoices.find(i => i.year === chartYear && i.month === monthIndex);
                const isExpanded = inv ? expandedInvoices.includes(inv.id!) : false;
                const monthlyTransactions = inv ? allTransactions.filter(t => t.invoiceId === inv.id) : [];
                
                if (!inv) {
                  return (
                    <div key={`empty-${monthIndex}`} className="bg-slate-50/50 dark:bg-slate-800/10 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm transition-all">
                      <div className="flex items-center justify-between py-2 px-6">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div className="flex items-center gap-6">
                            <div>
                              <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">
                                {format(new Date(chartYear, monthIndex, 1), 'MMMM yyyy', { locale: ptBR })}
                              </h3>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sem Lançamentos</p>
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm bg-slate-100 dark:bg-slate-800 text-slate-400">
                              Vazia
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-black text-slate-300 leading-none">
                            R$ 0,00
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={inv.id} className="bg-slate-50/50 dark:bg-slate-800/10 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm transition-all">
                    <div 
                      onClick={() => setExpandedInvoices(prev => isExpanded ? prev.filter(id => id !== inv.id) : [...prev, inv.id!])}
                      className="flex items-center justify-between py-2 px-6 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shadow-sm shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-6">
                          <div>
                            <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">
                              {format(new Date(inv.year, inv.month, 1), 'MMMM yyyy', { locale: ptBR })}
                            </h3>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Venc: {format(parseISO(inv.dueDate), 'dd/MM/yyyy')}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm ${
                              inv.status === 'Paga' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                            }`}>
                              {inv.status}
                            </span>
                            {inv.status === 'Aberta' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const now = new Date();
                                  const isPast = inv.year < now.getFullYear() || (inv.year === now.getFullYear() && inv.month < now.getMonth());
                                  const isCurrent = inv.year === now.getFullYear() && inv.month === now.getMonth();
                                  const canPay = isPast || (isCurrent && now.getDate() >= 20);

                                  if (canPay) {
                                    handlePayInvoice(inv);
                                  } else {
                                    showInfo('O pagamento só é liberado a partir do dia 20 do mês de vencimento.');
                                  }
                                }}
                                className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm transition-all ${
                                  (() => {
                                    const now = new Date();
                                    const isPast = inv.year < now.getFullYear() || (inv.year === now.getFullYear() && inv.month < now.getMonth());
                                    const isCurrent = inv.year === now.getFullYear() && inv.month === now.getMonth();
                                    const canPay = isPast || (isCurrent && now.getDate() >= 20);
                                    return canPay 
                                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95' 
                                      : 'bg-slate-200 text-slate-400 cursor-not-allowed';
                                  })()
                                }`}
                              >
                                Pagar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[11px] font-black text-indigo-600 leading-none">
                            {inv.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveInvoice(inv); setActiveTab('overview'); }}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-all"
                            title="Visão Geral"
                          >
                            <LayoutDashboard className="w-3.5 h-3.5" />
                          </button>
                          <div className="p-0.5">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50"
                        >
                          <div className="p-3 space-y-1.5">
                            {monthlyTransactions.length > 0 ? (
                              monthlyTransactions.map(t => (
                                <div key={t.id} className="flex items-center justify-between py-1.5 px-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-50 dark:border-slate-800/50 hover:border-indigo-100 transition-colors group">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${t.amount > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                      {t.description.charAt(0)}
                                    </div>
                                    <div>
                                      <h4 className="text-[10px] font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{t.description}</h4>
                                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{format(parseISO(t.date), 'dd/MM/yyyy')}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className="text-[8px] font-black text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded leading-none uppercase tracking-tighter">{t.category}</span>
                                    <p className={`text-[10px] font-black min-w-[60px] text-right ${t.amount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                      {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}
                                    </p>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => setEditingTransaction(t)} className="p-0.5 text-slate-300 hover:text-indigo-500 transition-colors"><Edit3 className="w-2.5 h-2.5" /></button>
                                      <button onClick={() => handleDeleteTransaction(t)} className="p-0.5 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-2.5 h-2.5" /></button>
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-center py-4 text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Sem gastos registrados</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Config Modal */}
      <AnimatePresence>
        {isConfigModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfigModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-white/10"
            >
              <div className="p-5 bg-indigo-600 text-white">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Settings className="w-6 h-6" />
                  </div>
                </div>
                <h2 className="text-xl font-bold tracking-tight leading-none mb-1">Configurar Cartão</h2>
                <p className="text-white/80 text-[10px] font-medium italic">Gerencie os parâmetros do seu ciclo de faturamento</p>
              </div>

              <form onSubmit={handleSaveConfig} key={activeConfig?.id || 'new'} className="p-5 space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Selecionar Cartão para Editar</label>
                  <select 
                    name="cardId"
                    value={activeConfig?.id || ''} 
                    onChange={(e) => {
                      const selected = configs.find(c => c.id === e.target.value) || null;
                      setActiveConfig(selected);
                      setTempBgImage(null);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                  >
                    <option value="">+ Adicionar Novo Cartão</option>
                    {configs.map(c => <option key={c.id} value={c.id}>{c.label} {c.isMain ? '⭐' : ''}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Nome do Cartão (Label)</label>
                  <input required name="label" defaultValue={activeConfig?.label || ''} placeholder="Ex: Meu Visa Platinum" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Imagem de Fundo (Personalizado)</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input name="bgImage" defaultValue={activeConfig?.bgImage || ''} placeholder="URL da imagem..." className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-3 text-[10px] font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" />
                    </div>
                    <label className="flex items-center justify-center h-10 w-10 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-slate-500">
                      <Upload className="w-4 h-4" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  </div>
                  {(tempBgImage || activeConfig?.bgImage) && (
                    <div className="mt-2 relative group rounded-lg overflow-hidden h-16 border border-slate-200 dark:border-slate-700">
                      <img src={tempBgImage || activeConfig?.bgImage} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                        <p className="text-[10px] text-white font-bold">Preview Ativo</p>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Estilo de Reserva (Banco)</label>
                  <select name="bank" defaultValue={activeConfig?.bank || 'Outro'} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none">
                    {Object.keys(BANK_VARIANTS).map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Limite Total (R$)</label>
                  <input required type="number" name="limit" defaultValue={activeConfig?.limit || 5000} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Dia Fechamento</label>
                    <input required type="number" name="closingDay" min="1" max="28" defaultValue={activeConfig?.closingDay || 5} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Dia Vencimento</label>
                    <input required type="number" name="dueDay" min="1" max="28" defaultValue={activeConfig?.dueDay || 15} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 mt-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-100 dark:border-slate-700">
                  <input type="checkbox" id="isMainCard" name="isMain" defaultChecked={activeConfig?.isMain} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 bg-white" />
                  <label htmlFor="isMainCard" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer flex-1 select-none">
                    Definir como cartão principal
                  </label>
                </div>
                
                <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all mt-3 uppercase text-[10px] tracking-[0.15em]">
                  {activeConfig?.id ? 'Atualizar Cartão' : 'Cadastrar Cartão'}
                </button>

                {activeConfig && (
                  <div className="grid grid-cols-2 gap-2 mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <button 
                      type="button"
                      onClick={() => handleResetData('card')}
                      title="Apaga apenas os lançamentos deste cartão selecionado"
                      className="w-full py-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg font-bold text-[9px] uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-200 dark:border-rose-500/20"
                    >
                      Resetar Este Cartão
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleResetData('all')}
                      title="Apaga absolutamente todo o seu histórico financeiro e de todos os cartões cadastrados"
                      className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[9px] uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
                    >
                      Apagar Tudo
                    </button>
                  </div>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Modal */}
      <AnimatePresence>
        {isTransactionModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTransactionModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-white/10"
            >
              {(() => {
                const selectedCard = configs.find(c => c.id === (selectedCardIdForTransaction || activeConfig?.id));
                const bankInfo = selectedCard?.bank ? BANK_VARIANTS[selectedCard.bank] : null;
                
                return (
                  <div 
                    className={`p-6 text-white transition-all duration-500 relative overflow-hidden h-36 flex items-center justify-between ${bankInfo?.color || 'bg-slate-900'}`}
                  >
                    {/* If we have a custom bgImage, show it on the right without deforming */}
                    {selectedCard?.bgImage ? (
                      <>
                        <div 
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-48 aspect-[1.586/1] rounded-xl shadow-2xl rotate-[-8deg] border border-white/20 opacity-95"
                          style={{
                            backgroundImage: `url(${selectedCard.bgImage})`,
                            backgroundSize: '100% 100%',
                            backgroundPosition: 'center',
                          }}
                        />
                        {/* Gradient to fade from left back to right so text is readable */}
                        <div className={`absolute inset-0 bg-gradient-to-r ${bankInfo?.color ? bankInfo.color.replace('bg-gradient-to-br ', '').split(' ')[0].replace('from-', '') : 'slate-900'} via-black/40 to-transparent`} />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
                      </>
                    ) : (
                      <>
                        {/* Fallbacks if no image */}
                        {selectedCard?.bank === 'Digio' && (
                          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, white 0.5px, transparent 0.5px)', backgroundSize: '4px 4px' }} />
                        )}
                        <div className={`absolute top-0 right-0 w-32 h-32 ${bankInfo?.secondary || 'bg-white/10'} rounded-full -mr-16 -mt-16 blur-2xl opacity-40`} />
                      </>
                    )}

                    <div className="relative z-10 flex flex-col justify-center w-full">
                      <div className="space-y-1">
                        {!selectedCard?.bgImage && (
                          <div className="flex items-center gap-3 mb-2">
                            <CreditCardChip />
                            <Wifi className="w-4 h-4 text-white/60 rotate-90" />
                          </div>
                        )}
                        <h2 className="text-2xl font-bold tracking-tight leading-none mb-1 drop-shadow-xl">Nova Compra</h2>
                        <p className="text-white/90 text-[10px] font-black italic opacity-90 uppercase tracking-widest drop-shadow-md">
                          {selectedCard?.bank || selectedCard?.label}
                        </p>
                      </div>
                    </div>
                    
                    {!selectedCard?.bgImage && (
                      <div className="relative z-10 flex flex-col items-end gap-2 shrink-0">
                        {selectedCard?.bank === 'Digio' ? (
                          <span className="text-xl font-black italic tracking-tighter leading-none lowercase drop-shadow-md">digio</span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 drop-shadow-md">
                            {selectedCard?.bank || 'CARD'}
                          </span>
                        )}
                        <img 
                          src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" 
                          alt="Visa" 
                          className="h-3 brightness-0 invert opacity-80" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              <form onSubmit={handleAddTransaction} className="p-6 space-y-3">
                <div className="flex items-center gap-2 mb-2 p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-100 dark:border-slate-700 cursor-pointer" onClick={() => setIsPixTransaction(!isPixTransaction)}>
                   <input type="checkbox" id="isPix" checked={isPixTransaction} onChange={e => setIsPixTransaction(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 bg-white" />
                   <label htmlFor="isPix" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer flex-1 select-none flex items-center justify-between">
                     Este lançamento é um PIX de Crédito
                     {isPixTransaction && <Zap className="w-4 h-4 text-indigo-500" />}
                   </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {isPixTransaction ? (
                    <div>
                      <label className="flex justify-between items-center block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">
                        Destinatário PIX
                        <button type="button" onClick={(e) => { e.stopPropagation(); setIsPixContactModalOpen(true); }} className="text-indigo-500 hover:text-indigo-600 flex items-center gap-0.5"><Plus className="w-3 h-3"/> Novo</button>
                      </label>
                      <select required name="pixContactId" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none">
                        <option value="">Selecione um contato...</option>
                        {pixContacts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.pixKey})</option>)}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Descrição Principal</label>
                      <input required name="description" placeholder="Ex: Supermercado" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" />
                    </div>
                  )}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Cartão de Crédito</label>
                    <select 
                      name="cardId" 
                      defaultValue={activeConfig?.id} 
                      onChange={(e) => setSelectedCardIdForTransaction(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                    >
                      {configs.map(c => <option key={c.id} value={c.id}>{c.label} {c.isMain ? '⭐' : ''}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Valor (R$)</label>
                    <input required type="number" step="0.01" name="amount" placeholder="0.00" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Parcelas</label>
                    <input type="number" name="installments" min="1" defaultValue="1" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Data</label>
                    <input required type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Categoria</label>
                    <select name="category" defaultValue={isPixTransaction ? 'Transferências' : 'Outros'} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="Transferências">Transferências</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Centro de Custo</label>
                  <input name="costCenter" placeholder="Quem comprou?" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Observação</label>
                  {isPixTransaction ? (
                    <input name="pixDetails" placeholder="Ex: Pagamento almoço" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" />
                  ) : (
                    <input name="details" placeholder="Detalhes extras..." className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" />
                  )}
                </div>

                <button type="submit" className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xl shadow-indigo-500/20 transition-all mt-2 uppercase text-[10px] tracking-widest">
                  Confirmar Lançamento
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Edit Transaction Modal */}
      <AnimatePresence>
        {editingTransaction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTransaction(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-white/10"
            >
              <div className="p-6 bg-cyan-600 text-white">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <Edit3 className="w-6 h-6" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold tracking-tight leading-none mb-1">Editar Compra</h2>
                <p className="text-white/60 text-xs font-medium">Altere os detalhes do lançamento</p>
              </div>

              <form onSubmit={handleEditTransaction} className="p-6 space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Descrição</label>
                  <input required name="description" defaultValue={editingTransaction.description} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-cyan-500 transition-all outline-none" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Valor (R$)</label>
                    <input required type="number" step="0.01" name="amount" defaultValue={editingTransaction.amount} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-cyan-500 transition-all outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Categoria</label>
                    <select name="category" defaultValue={editingTransaction.category} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-cyan-500 transition-all outline-none">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Centro de Custo</label>
                  <input name="costCenter" defaultValue={editingTransaction.costCenter} placeholder="Quem comprou?" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-cyan-500 transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Observação</label>
                  <input name="details" defaultValue={editingTransaction.details} placeholder="Detalhes extras..." className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-4 text-sm font-bold focus:ring-2 focus:ring-cyan-500 transition-all outline-none" />
                </div>

                <button type="submit" className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold shadow-xl shadow-cyan-500/20 transition-all mt-2">
                  Salvar Alterações
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Add Pix Contact Modal */}
      <AnimatePresence>
        {isPixContactModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPixContactModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-white/10"
            >
              <div className="p-5 bg-indigo-600 text-white">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Zap className="w-6 h-6" />
                  </div>
                </div>
                <h2 className="text-xl font-bold tracking-tight leading-none mb-1">Novo Contato PIX</h2>
                <p className="text-white/80 text-[10px] font-medium italic">Adicione favoritos para lançamentos super rápidos</p>
              </div>

              <form onSubmit={handleAddPixContact} className="p-5 space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Nome do Contato</label>
                  <input required name="name" placeholder="Ex: João Silva" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest ml-1">Chave PIX (CPF, E-mail, Celular)</label>
                  <input required name="pixKey" placeholder="Ex: 123.456.789-00" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-10 px-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" />
                </div>
                
                <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all mt-3 uppercase text-[10px] tracking-[0.15em]">
                  Salvar Contato
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
