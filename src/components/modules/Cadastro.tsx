import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, 
  Search, 
  Filter, 
  MoreVertical, 
  Mail, 
  Phone, 
  MapPin, 
  Edit2, 
  Trash2, 
  ExternalLink,
  Loader2,
  Users as UsersIcon,
  ChevronRight,
  ChevronLeft,
  Gift,
  AlertTriangle,
  Plus,
  X
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  serverTimestamp,
  orderBy 
} from 'firebase/firestore';
import { 
  isSameDay, 
  isSameMonth, 
  startOfWeek, 
  endOfWeek, 
  isWithinInterval, 
  parseISO,
  setYear,
  getYear
} from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { Member, MEMBER_STATUS_COLORS } from '../../lib/member-types';
import { SAMPLE_MEMBERS } from '../../lib/sample-members';
import MemberModal from '../MemberModal';
import { confirmAction, showSuccess, showError, showInfo } from '../../lib/alerts';

interface CadastroProps {
  initialView?: string;
  onClearInitialView?: () => void;
}

export default function Cadastro({ initialView, onClearInitialView }: CadastroProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'members' | 'birthdays'>('members');
  const [birthdayFilter, setBirthdayFilter] = useState<'day' | 'week' | 'month' | 'year'>('year');
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [saveConfirmation, setSaveConfirmation] = useState<Member | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string, name: string } | null>(null);
  const [importConfirmation, setImportConfirmation] = useState(false);

  useEffect(() => {
    if (initialView === 'birthday') {
      setActiveTab('birthdays');
      if (onClearInitialView) onClearInitialView();
    }
  }, [initialView]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'members'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Member[];
      
      // Sort by Spreadsheet ID
      const sorted = docs.sort((a, b) => (a.idPlanilha || 999) - (b.idPlanilha || 999));
      
      setMembers(sorted);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      const matchesSearch = member.nome.toLowerCase().includes(search.toLowerCase()) ||
                          member.cpf?.includes(search) ||
                          member.email?.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'Todos' || member.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [members, search, statusFilter]);

  const birthdayMembers = useMemo(() => {
    const today = new Date();
    const currentYear = getYear(today);

    return members.filter(member => {
      if (!member.dataNascimento) return false;
      
      // Member dob: YYYY-MM-DD
      const dobParts = member.dataNascimento.split('-');
      if (dobParts.length !== 3) return false;
      
      // Create a date for this year with member's MM and DD
      const birthdayThisYear = new Date(currentYear, parseInt(dobParts[1]) - 1, parseInt(dobParts[2]));

      if (birthdayFilter === 'day') {
        return isSameDay(birthdayThisYear, today);
      }
      if (birthdayFilter === 'week') {
        const start = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
        const end = endOfWeek(today, { weekStartsOn: 0 });
        return isWithinInterval(birthdayThisYear, { start, end });
      }
      if (birthdayFilter === 'month') {
        return isSameMonth(birthdayThisYear, today);
      }
      return true; // 'year' - return all
    }).sort((a, b) => {
      const dobA = a.dataNascimento?.split('-').slice(1).join('-'); // MM-DD
      const dobB = b.dataNascimento?.split('-').slice(1).join('-'); // MM-DD
      return (dobA || '').localeCompare(dobB || '');
    });
  }, [members, birthdayFilter]);

  const handleSaveMember = async (memberData: Member) => {
    if (!user) return;

    if (!saveConfirmation) {
      setSaveConfirmation(memberData);
      return;
    }

    try {
      if (editingMember?.id) {
        const memberRef = doc(db, 'members', editingMember.id);
        await updateDoc(memberRef, {
          ...memberData,
          updatedAt: new Date().toISOString()
        });
        showSuccess('Membro atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'members'), {
          ...memberData,
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        showSuccess('Membro cadastrado com sucesso!');
      }
      setIsModalOpen(false);
      setEditingMember(null);
    } catch (error) {
      console.error("Error saving member:", error);
      showError('Erro ao salvar membro. Tente novamente.');
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    setDeleteConfirmation({ id, name });
  };

  const executeDeletion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'members', id));
      showSuccess('Membro excluído com sucesso!');
    } catch (error) {
      console.error("Error deleting member:", error);
      showError('Erro ao excluir membro.');
    }
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setIsModalOpen(true);
  };

  const handleImportSample = async () => {
    if (!user) return;
    
    if (!importConfirmation) {
      setImportConfirmation(true);
      return;
    }
    
    setLoading(true);
      try {
        let importedCount = 0;
        let updatedCount = 0;
        
        const existingMembersMap = new Map<string, Member>(
          members.map(m => [m.nome.toLowerCase().trim(), m])
        );

        const operations = SAMPLE_MEMBERS.map(async (sampleMember) => {
          const sampleName = sampleMember.nome.toLowerCase().trim();
          const existing = existingMembersMap.get(sampleName);

          if (existing && existing.id) {
            // If exists but missing ID or has different ID, update it
            if (!existing.idPlanilha || existing.idPlanilha !== sampleMember.idPlanilha) {
              const memberRef = doc(db, 'members', existing.id);
              await updateDoc(memberRef, {
                idPlanilha: sampleMember.idPlanilha,
                updatedAt: new Date().toISOString()
              });
              updatedCount++;
            }
            return;
          }

          // If doesn't exist, create it
          await addDoc(collection(db, 'members'), {
            ...sampleMember,
            userId: user.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          importedCount++;
        });
        
        await Promise.all(operations);
        
        let message = '';
        if (importedCount > 0 && updatedCount > 0) {
          message = `${importedCount} novos e ${updatedCount} IDs atualizados!`;
        } else if (importedCount > 0) {
          message = `${importedCount} novos membros importados!`;
        } else if (updatedCount > 0) {
          message = `${updatedCount} IDs de planilha vinculados com sucesso!`;
        } else {
          message = 'Tudo pronto! Seus dados já estão sincronizados.';
        }
        
        showSuccess(message);
      } catch (error) {
        console.error("Error importing samples:", error);
        showError('Erro ao sincronizar dados. Verifique sua conexão.');
      } finally {
        setLoading(false);
      }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-50 dark:bg-transparent overflow-hidden">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] px-8 py-0.5 shrink-0">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all relative ${
            activeTab === 'members' 
              ? 'text-cyan-600 dark:text-cyan-400' 
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
          }`}
        >
          Lista de Membros
          {activeTab === 'members' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('birthdays')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all relative ${
            activeTab === 'birthdays' 
              ? 'text-fuchsia-600 dark:text-fuchsia-400' 
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
          }`}
        >
          Aniversariantes
          {activeTab === 'birthdays' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-fuchsia-500" />
          )}
        </button>
      </div>

      {/* Top Toolbar */}
      <div className="flex justify-between items-center mb-6 shrink-0 pt-6 px-8">
        <div>
          {activeTab === 'birthdays' && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button 
                onClick={() => setBirthdayFilter('day')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${birthdayFilter === 'day' ? 'bg-fuchsia-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
              >
                Hoje
              </button>
              <button 
                onClick={() => setBirthdayFilter('week')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${birthdayFilter === 'week' ? 'bg-fuchsia-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
              >
                Semana
              </button>
              <button 
                onClick={() => setBirthdayFilter('month')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${birthdayFilter === 'month' ? 'bg-fuchsia-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
              >
                Mês
              </button>
              <button 
                onClick={() => setBirthdayFilter('year')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${birthdayFilter === 'year' ? 'bg-fuchsia-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
              >
                Ano
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleImportSample}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-all text-sm shadow-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Importar Planilha
          </button>
          <button 
            onClick={() => { setEditingMember(null); setIsModalOpen(true); }}
            className="bg-cyan-500 hover:bg-cyan-400 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20 text-sm"
          >
            <UserPlus className="w-5 h-5" />
            Novo Membro
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 px-8 pb-8 gap-6 overflow-hidden">
        {activeTab === 'members' ? (
          <>
            {/* Filters/Search */}
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-2xl shadow-sm shrink-0">
          <div className="p-4 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 dark:text-slate-500" />
              <input 
                type="text" 
                placeholder="Buscar por nome, CPF ou e-mail..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-lg h-[22px] pl-8 pr-3 text-[11px] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all font-medium outline-none"
              />
            </div>
            <div className="flex gap-2">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-[11px] font-semibold rounded-lg px-3 h-[22px] text-slate-600 dark:text-slate-400 focus:outline-none transition-all cursor-pointer outline-none"
              >
                <option value="Todos">Todos os Status</option>
                {Object.keys(MEMBER_STATUS_COLORS).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <button className="h-[22px] w-[22px] flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors shadow-sm outline-none">
                <Filter className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Table Container - THE ONLY SCROLLABLE PART */}
        <div className="flex-1 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-auto scrollbar-hide">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
                <p className="text-slate-500 font-medium">Carregando membros...</p>
              </div>
            ) : filteredMembers.length > 0 ? (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 transition-colors">
                  <tr className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/10">ID</th>
                    <th className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/10">Membro</th>
                    <th className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/10">Contato / CPF</th>
                    <th className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/10">Cargo</th>
                    <th className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/10">Status</th>
                    <th className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/10 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/10">
                  {filteredMembers.map((member, i) => (
                    <motion.tr 
                      key={member.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.01 }}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/20 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-slate-400 font-bold">
                          {String(member.idPlanilha || '---').padStart(2, '0')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400 font-bold border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                            {member.fotoUrl ? (
                              <img src={member.fotoUrl} alt={member.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : member.nome.charAt(0)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{member.nome}</span>
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">{member.genero}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium truncate max-w-[200px] block">{member.email || 'Sem email'}</span>
                          <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                            <span className="flex items-center gap-1 whitespace-nowrap"><Phone className="w-3 h-3" /> {member.celular || member.telefone || '---'}</span>
                            <span className="flex items-center gap-1 whitespace-nowrap"><ExternalLink className="w-3 h-3" /> {member.cpf || '---'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{member.cargo || 'Membro'}</span>
                          {member.eBatizado && <span className="text-[10px] text-emerald-500 font-bold uppercase">Batizado</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${MEMBER_STATUS_COLORS[member.status as keyof typeof MEMBER_STATUS_COLORS]}`}>
                          {member.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1 opacity-10 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(member)}
                            className="p-2 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-lg text-slate-400 hover:text-cyan-600 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => member.id && handleDeleteMember(member.id, member.nome)}
                            className="p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
                <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto">
                  <UsersIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-slate-500 font-medium">Nenhum membro encontrado com estes filtros.</p>
              </div>
            )}
          </div>
        </div>
      </>
    ) : (
      /* Birthdays List Content */
          <div className="flex-1 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 overflow-auto scrollbar-hide">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <Loader2 className="w-10 h-10 text-fuchsia-500 animate-spin" />
                  <p className="text-slate-500 font-medium">Carregando aniversariantes...</p>
                </div>
              ) : birthdayMembers.length > 0 ? (
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <tr className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/10">Data</th>
                      <th className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/10">Membro</th>
                      <th className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/10">Idade</th>
                      <th className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/10">Cargo</th>
                      <th className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/10 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/10">
                    {birthdayMembers.map((member, i) => {
                      const dobParts = member.dataNascimento?.split('-');
                      const birthYear = dobParts ? parseInt(dobParts[0]) : 0;
                      const age = birthYear ? getYear(new Date()) - birthYear : '---';
                      const dayMonth = dobParts ? `${dobParts[2]}/${dobParts[1]}` : '---';
                      
                      return (
                        <motion.tr 
                          key={member.id}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.01 }}
                          className="hover:bg-fuchsia-50/30 dark:hover:bg-fuchsia-500/5 transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-fuchsia-600 dark:text-fuchsia-400">{dayMonth}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">{member.dataNascimento}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-fuchsia-600 dark:text-fuchsia-400 font-bold border border-slate-200 dark:border-slate-700 overflow-hidden">
                                {member.fotoUrl ? (
                                  <img src={member.fotoUrl} alt={member.nome} className="w-full h-full object-cover" />
                                ) : member.nome.charAt(0)}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{member.nome}</span>
                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">{member.genero}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{age} anos</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{member.cargo || 'Membro'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleEdit(member)}
                                className="p-2 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-500/10 rounded-lg text-slate-400 hover:text-fuchsia-600 transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
                  <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-300">
                    <Gift className="w-8 h-8" />
                  </div>
                  <p className="text-slate-500 font-medium">Nenhum aniversariante para este período.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <MemberModal 
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setEditingMember(null); }}
            onSave={handleSaveMember}
            member={editingMember}
          />
        )}
      </AnimatePresence>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {deleteConfirmation && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmation(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[480px] bg-white dark:bg-[#0b1120] rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="relative h-28 bg-red-50 dark:bg-red-500/10 p-6 flex flex-col justify-end">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-red-500 rounded-xl shadow-lg shadow-red-200 dark:shadow-none">
                      <Trash2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex gap-1">
                      <div className="w-1 h-3 bg-red-300/60 rounded-full" />
                      <div className="w-1 h-3 bg-red-400/80 rounded-full" />
                      <div className="w-1 h-3 bg-red-500 rounded-full" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-black text-red-900 dark:text-red-100 tracking-tight leading-none pt-2">
                    Excluir Registro
                  </h3>
                </div>
                <div className="absolute top-6 right-6 opacity-20 pointer-events-none text-red-500">
                  <AlertTriangle className="w-20 h-20 rotate-12" />
                </div>
                <button 
                  onClick={() => setDeleteConfirmation(null)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 transition-colors z-20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 bg-white dark:bg-[#0b1120]">
                <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 p-8 text-center space-y-6 shadow-sm">
                  <div className="space-y-2">
                    <h4 className="text-xl font-black text-red-500 uppercase tracking-wider">
                      Deseja apagar esse registro?
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                      Deseja realmente excluir o cadastro de {deleteConfirmation.name}? Esta ação não poderá ser desfeita.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button
                      onClick={async () => {
                        const { id } = deleteConfirmation;
                        setDeleteConfirmation(null);
                        await executeDeletion(id);
                        setIsModalOpen(false);
                      }}
                      className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-95"
                    >
                      Sim, Excluir
                    </button>
                    <button
                      onClick={() => setDeleteConfirmation(null)}
                      className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95 border border-slate-100 dark:border-slate-700"
                    >
                      Não, Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {saveConfirmation && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSaveConfirmation(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[480px] bg-white dark:bg-[#0b1120] rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className={`relative h-28 p-6 flex flex-col justify-end transition-colors duration-200 ${
                editingMember?.id 
                  ? "bg-blue-50 dark:bg-blue-500/10" 
                  : "bg-emerald-50 dark:bg-emerald-500/10"
              }`}>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-1">
                    <div className={`p-2 rounded-xl shadow-lg transition-colors duration-200 ${
                      editingMember?.id 
                        ? "bg-blue-500 shadow-blue-200 dark:shadow-none" 
                        : "bg-emerald-500 shadow-emerald-200 dark:shadow-none"
                    }`}>
                      {editingMember?.id ? (
                        <Edit2 className="w-5 h-5 text-white" />
                      ) : (
                        <UserPlus className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex gap-1">
                      <div className={`w-1 h-3 rounded-full transition-colors duration-200 ${editingMember?.id ? "bg-blue-300/60" : "bg-emerald-300/60"}`} />
                      <div className={`w-1 h-3 rounded-full transition-colors duration-200 ${editingMember?.id ? "bg-blue-400/80" : "bg-emerald-400/80"}`} />
                      <div className={`w-1 h-3 rounded-full transition-colors duration-200 ${editingMember?.id ? "bg-blue-500" : "bg-emerald-500"}`} />
                    </div>
                  </div>
                  <h3 className={`text-3xl font-black tracking-tight leading-none pt-2 transition-colors duration-200 ${
                    editingMember?.id 
                      ? "text-blue-900 dark:text-blue-100" 
                      : "text-emerald-900 dark:text-emerald-100"
                  }`}>
                    {editingMember?.id ? "Editar Membro" : "Novo Membro"}
                  </h3>
                </div>
                <div className={`absolute top-6 right-6 opacity-20 pointer-events-none transition-colors duration-200 ${
                  editingMember?.id ? "text-blue-500" : "text-emerald-500"
                }`}>
                  {editingMember?.id ? (
                    <Edit2 className="w-20 h-20 rotate-12" />
                  ) : (
                    <Plus className="w-20 h-20 rotate-45" />
                  )}
                </div>
                <button 
                  onClick={() => setSaveConfirmation(null)}
                  className={`absolute top-4 right-4 p-2 text-slate-400 transition-colors z-20 ${
                    editingMember?.id ? "hover:text-blue-500" : "hover:text-emerald-500"
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 bg-white dark:bg-[#0b1120]">
                <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 p-8 text-center space-y-6 shadow-sm">
                  <div className="space-y-2">
                    <h4 className={`text-xl font-black uppercase tracking-wider ${
                      editingMember?.id ? "text-blue-500" : "text-emerald-500"
                    }`}>
                      {editingMember?.id ? "Confirmar Alterações?" : "Deseja salvar esse registro?"}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                      {editingMember?.id 
                        ? "Esta ação registrará as alterações permanentemente no banco de dados de membros." 
                        : "Esta ação registrará os dados permanentemente no banco de dados de membros."}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button
                      onClick={() => {
                        const data = saveConfirmation;
                        setSaveConfirmation(null);
                        handleSaveMember(data);
                      }}
                      className={`flex-1 py-4 text-white font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg dark:shadow-none ${
                        editingMember?.id 
                          ? "bg-blue-500 hover:bg-blue-600 shadow-blue-200" 
                          : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200"
                      }`}
                    >
                      Sim, Confirmar
                    </button>
                    <button
                      onClick={() => setSaveConfirmation(null)}
                      className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95 border border-slate-100 dark:border-slate-700"
                    >
                      Não, Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {importConfirmation && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setImportConfirmation(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[480px] bg-white dark:bg-[#0b1120] rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="relative h-28 bg-cyan-50 dark:bg-cyan-500/10 p-6 flex flex-col justify-end">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-cyan-500 rounded-xl shadow-lg shadow-cyan-200 dark:shadow-none">
                      <ExternalLink className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex gap-1">
                      <div className="w-1 h-3 bg-cyan-300/60 rounded-full" />
                      <div className="w-1 h-3 bg-cyan-400/80 rounded-full" />
                      <div className="w-1 h-3 bg-cyan-500 rounded-full" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-black text-cyan-900 dark:text-cyan-100 tracking-tight leading-none pt-2">
                    Sincronizar Planilha
                  </h3>
                </div>
                <div className="absolute top-6 right-6 opacity-20 pointer-events-none text-cyan-500">
                  <ChevronRight className="w-20 h-20 rotate-45" />
                </div>
                <button 
                  onClick={() => setImportConfirmation(false)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-cyan-500 transition-colors z-20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 bg-white dark:bg-[#0b1120]">
                <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 p-8 text-center space-y-6 shadow-sm">
                  <div className="space-y-2">
                    <h4 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Confirmar Sincronização?
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                      Isso irá atualizar os IDs e dados dos membros existentes e cadastrar os novos vindos da planilha mestre.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button
                      onClick={() => {
                        setImportConfirmation(false);
                        handleImportSample();
                      }}
                      className="flex-1 py-4 bg-cyan-500 hover:bg-cyan-600 text-white font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg shadow-cyan-200 dark:shadow-none transition-all active:scale-95"
                    >
                      Sim, Sincronizar
                    </button>
                    <button
                      onClick={() => setImportConfirmation(false)}
                      className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95 border border-slate-100 dark:border-slate-700"
                    >
                      Não, Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
