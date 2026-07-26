import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, 
  Search, 
  Edit2, 
  Trash2, 
  MapPin, 
  Phone,
  Building2,
  User,
  Loader2,
  AlertTriangle,
  Plus,
  X
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Supplier } from '../../lib/supplier-types';
import SupplierModal from '../SupplierModal';
import { confirmAction, showSuccess, showError } from '../../lib/alerts';

export default function Fornecedor() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [saveConfirmation, setSaveConfirmation] = useState<Supplier | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string, name: string } | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'suppliers'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Supplier[];
      
      const sorted = docs.sort((a, b) => {
        const nameA = a.tipo === 'Jurídica' ? a.nomeFantasia || a.razaoSocial : a.nome;
        const nameB = b.tipo === 'Jurídica' ? b.nomeFantasia || b.razaoSocial : b.nome;
        return (nameA || '').localeCompare(nameB || '');
      });
      
      setSuppliers(sorted);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'suppliers');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(supplier => {
      const searchLower = search.toLowerCase();
      const n1 = supplier.nome?.toLowerCase() || '';
      const n2 = supplier.razaoSocial?.toLowerCase() || '';
      const n3 = supplier.nomeFantasia?.toLowerCase() || '';
      const d1 = supplier.cpf || '';
      const d2 = supplier.cnpj || '';
      
      return n1.includes(searchLower) || 
             n2.includes(searchLower) || 
             n3.includes(searchLower) ||
             d1.includes(search) ||
             d2.includes(search);
    });
  }, [suppliers, search]);

  const handleSaveSupplier = async (supplierData: Supplier) => {
    if (!user) return;

    if (!saveConfirmation) {
      setSaveConfirmation(supplierData);
      return;
    }

    try {
      if (editingSupplier?.id) {
        const ref = doc(db, 'suppliers', editingSupplier.id);
        await updateDoc(ref, {
          ...supplierData,
          updatedAt: new Date().toISOString()
        });
        showSuccess('Fornecedor atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...supplierData,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });
        showSuccess('Fornecedor cadastrado com sucesso!');
      }
      setIsModalOpen(false);
      setEditingSupplier(null);
    } catch (error) {
      console.error("Error saving supplier:", error);
      showError('Erro ao salvar fornecedor.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setDeleteConfirmation({ id, name });
  };

  const executeDeletion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'suppliers', id));
      showSuccess('Fornecedor excluído com sucesso!');
    } catch (error) {
      console.error("Error deleting supplier:", error);
      showError('Erro ao excluir fornecedor.');
    }
  };

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-end mb-8 pt-4">
        <button
          onClick={() => {
            setEditingSupplier(null);
            setIsModalOpen(true);
          }}
          className="bg-cyan-500 hover:bg-cyan-400 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/25 shrink-0"
        >
          <Truck className="w-5 h-5" />
          Novo Fornecedor
        </button>
      </div>

      <div className="bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-800/50 p-2 mb-6 flex items-center gap-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por Nome, Razão Social ou Documento..."
            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 h-6 text-[11px] text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all placeholder:text-slate-400 font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800/50 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
              <Truck className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Nenhum fornecedor encontrado</h3>
            <p className="text-slate-500 max-w-sm">
              {search ? 'Nenhum fornecedor corresponde à sua busca.' : 'Você ainda não possui fornecedores cadastrados.'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/30">
                  <th className="py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Identificação</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Documento</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contato</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Localização</th>
                  <th className="py-4 px-6 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center shrink-0">
                          {supplier.tipo === 'Jurídica' ? (
                            <Building2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                          ) : (
                            <User className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white capitalize">
                            {supplier.tipo === 'Jurídica' ? supplier.nomeFantasia || supplier.razaoSocial : supplier.nome}
                          </p>
                          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                            {supplier.tipo}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {supplier.tipo === 'Jurídica' ? supplier.cnpj : supplier.cpf}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        {(supplier.telefone || supplier.celular) && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {supplier.celular || supplier.telefone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 max-w-[200px]">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-2 leading-relaxed">
                          {supplier.cidade ? `${supplier.cidade} - ${supplier.uf || ''}` : 'Não informado'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingSupplier(supplier);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const name = supplier.tipo === 'Jurídica' ? supplier.nomeFantasia || supplier.razaoSocial : supplier.nome;
                            handleDelete(supplier.id!, name || '');
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SupplierModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSupplier(null);
        }}
        onSave={handleSaveSupplier}
        supplier={editingSupplier}
      />

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
                    Excluir Fornecedor
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
                      Deseja apagar esse fornecedor?
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
                editingSupplier?.id 
                  ? "bg-blue-50 dark:bg-blue-500/10" 
                  : "bg-emerald-50 dark:bg-emerald-500/10"
              }`}>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-1">
                    <div className={`p-2 rounded-xl shadow-lg transition-colors duration-200 ${
                      editingSupplier?.id 
                        ? "bg-blue-500 shadow-blue-200 dark:shadow-none" 
                        : "bg-emerald-500 shadow-emerald-200 dark:shadow-none"
                    }`}>
                      {editingSupplier?.id ? (
                        <Edit2 className="w-5 h-5 text-white" />
                      ) : (
                        <Truck className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex gap-1">
                      <div className={`w-1 h-3 rounded-full transition-colors duration-200 ${editingSupplier?.id ? "bg-blue-300/60" : "bg-emerald-300/60"}`} />
                      <div className={`w-1 h-3 rounded-full transition-colors duration-200 ${editingSupplier?.id ? "bg-blue-400/80" : "bg-emerald-400/80"}`} />
                      <div className={`w-1 h-3 rounded-full transition-colors duration-200 ${editingSupplier?.id ? "bg-blue-500" : "bg-emerald-500"}`} />
                    </div>
                  </div>
                  <h3 className={`text-3xl font-black tracking-tight leading-none pt-2 transition-colors duration-200 ${
                    editingSupplier?.id 
                      ? "text-blue-900 dark:text-blue-100" 
                      : "text-emerald-900 dark:text-emerald-100"
                  }`}>
                    {editingSupplier?.id ? "Editar Fornecedor" : "Novo Fornecedor"}
                  </h3>
                </div>
                <div className={`absolute top-6 right-6 opacity-20 pointer-events-none transition-colors duration-200 ${
                  editingSupplier?.id ? "text-blue-500" : "text-emerald-500"
                }`}>
                  {editingSupplier?.id ? (
                    <Edit2 className="w-20 h-20 rotate-12" />
                  ) : (
                    <Plus className="w-20 h-20 rotate-45" />
                  )}
                </div>
                <button 
                  onClick={() => setSaveConfirmation(null)}
                  className={`absolute top-4 right-4 p-2 text-slate-400 transition-colors z-20 ${
                    editingSupplier?.id ? "hover:text-blue-500" : "hover:text-emerald-500"
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 bg-white dark:bg-[#0b1120]">
                <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 p-8 text-center space-y-6 shadow-sm">
                  <div className="space-y-2">
                    <h4 className={`text-xl font-black uppercase tracking-wider ${
                      editingSupplier?.id ? "text-blue-500" : "text-emerald-500"
                    }`}>
                      {editingSupplier?.id ? "Confirmar Alterações?" : "Deseja salvar esse fornecedor?"}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                      {editingSupplier?.id 
                        ? "Esta ação registrará as alterações permanentemente no banco de dados de fornecedores." 
                        : "Esta ação registrará os dados permanentemente no banco de dados de fornecedores."}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button
                      onClick={() => {
                        const data = saveConfirmation;
                        setSaveConfirmation(null);
                        handleSaveSupplier(data);
                      }}
                      className={`flex-1 py-4 text-white font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg dark:shadow-none ${
                        editingSupplier?.id 
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
    </div>
  );
}
