import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Truck, 
  Building2, 
  User, 
  Search, 
  MapPin, 
  Phone, 
  Smartphone, 
  Mail, 
  Globe,
  Loader2,
  AlertCircle,
  Hash,
  Save
} from 'lucide-react';
import axios from 'axios';
import { Supplier } from '../lib/supplier-types';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: Supplier) => Promise<void>;
  supplier: Supplier | null;
}

export default function SupplierModal({ isOpen, onClose, onSave, supplier }: SupplierModalProps) {
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [tipo, setTipo] = useState<'Física' | 'Jurídica'>('Jurídica');
  
  const [activeTab, setActiveTab] = useState<'dados' | 'contato' | 'localizacao'>('dados');
  
  const [formData, setFormData] = useState<Partial<Supplier>>({
    tipo: 'Jurídica',
    nome: '',
    cpf: '',
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    inscricaoEstadual: '',
    inscricaoMunicipal: '',
    email: '',
    telefone: '',
    celular: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
  });

  useEffect(() => {
    if (supplier) {
      setFormData(supplier);
      setTipo(supplier.tipo);
    } else {
      setFormData({
        tipo: 'Jurídica',
        nome: '',
        cpf: '',
        razaoSocial: '',
        nomeFantasia: '',
        cnpj: '',
        inscricaoEstadual: '',
        inscricaoMunicipal: '',
        email: '',
        telefone: '',
        celular: '',
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: '',
      });
      setTipo('Jurídica');
    }
    setActiveTab('dados');
  }, [supplier, isOpen]);

  const handleTipoChange = (newTipo: 'Física' | 'Jurídica') => {
    setTipo(newTipo);
    setFormData(prev => ({ ...prev, tipo: newTipo }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    let formattedValue = value;
    
    if (name === 'cnpj') {
      formattedValue = value.replace(/\D/g, '');
      if (formattedValue.length > 14) formattedValue = formattedValue.slice(0, 14);
      formattedValue = formattedValue.replace(/^(\d{2})(\d)/, '$1.$2');
      formattedValue = formattedValue.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
      formattedValue = formattedValue.replace(/\.(\d{3})(\d)/, '.$1/$2');
      formattedValue = formattedValue.replace(/(\d{4})(\d)/, '$1-$2');
      
      // Auto-fetch if reached 14 digits
      const digits = formattedValue.replace(/\D/g, '');
      if (digits.length === 14) {
        setTimeout(() => lookupCNPJ(digits), 100);
      }
    } else if (name === 'cpf') {
      formattedValue = value.replace(/\D/g, '');
      if (formattedValue.length > 11) formattedValue = formattedValue.slice(0, 11);
      formattedValue = formattedValue.replace(/^(\d{3})(\d)/, '$1.$2');
      formattedValue = formattedValue.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
      formattedValue = formattedValue.replace(/\.(\d{3})(\d)/, '.$1-$2');
    } else if (name === 'cep') {
      formattedValue = value.replace(/\D/g, '');
      if (formattedValue.length > 8) formattedValue = formattedValue.slice(0, 8);
      formattedValue = formattedValue.replace(/^(\d{5})(\d)/, '$1-$2');
      
      // Auto-fetch if reached 8 digits
      const digits = formattedValue.replace(/\D/g, '');
      if (digits.length === 8) {
        setTimeout(() => lookupCEP(digits), 100);
      }
    } else if (name === 'telefone' || name === 'celular') {
      formattedValue = value.replace(/\D/g, '');
      if (formattedValue.length > 11) formattedValue = formattedValue.slice(0, 11);
      
      if (formattedValue.length > 10) {
        // Celular: (XX) XXXXX-XXXX
        formattedValue = formattedValue.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      } else if (formattedValue.length > 2) {
        // Fixo ou digitando: (XX) XXXX-XXXX
        formattedValue = formattedValue.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
      } else if (formattedValue.length > 0) {
        formattedValue = formattedValue.replace(/^(\d*)/, '($1');
      }
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const lookupCNPJ = async (cnpjParam?: string) => {
    const cnpj = (cnpjParam || formData.cnpj)?.replace(/\D/g, '');
    if (!cnpj || cnpj.length !== 14) return;

    setLookupLoading(true);
    try {
      const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      const data = response.data;
      
      setFormData(prev => ({
        ...prev,
        razaoSocial: data.razao_social || '',
        nomeFantasia: data.nome_fantasia || data.razao_social || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cidade: data.municipio || '',
        uf: data.uf || '',
        cep: data.cep || '',
        telefone: data.ddd_telefone_1 || '',
        email: data.email || '',
      }));
    } catch (error) {
      console.error("Error looking up CNPJ:", error);
    } finally {
      setLookupLoading(false);
    }
  };

  const lookupCEP = async (cepParam?: string) => {
    const cep = (cepParam || formData.cep)?.replace(/\D/g, '');
    if (!cep || cep.length !== 8) return;

    setLookupLoading(true);
    try {
      const response = await axios.get(`https://brasilapi.com.br/api/cep/v1/${cep}`);
      const data = response.data;
      
      setFormData(prev => ({
        ...prev,
        logradouro: data.street || '',
        bairro: data.neighborhood || '',
        cidade: data.city || '',
        uf: data.state || '',
      }));
    } catch (error) {
      console.error("Error looking up CEP:", error);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData as Supplier);
    } catch (error) {
      console.error("Error saving supplier:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'dados', label: 'Dados Básicos', icon: Building2 },
    { id: 'localizacao', label: 'Endereço', icon: MapPin },
    { id: 'contato', label: 'Contato', icon: Phone },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-slate-950 w-full max-w-4xl h-[600px] overflow-hidden rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-100 dark:border-cyan-800/30">
                <Building2 className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-[#1e293b] dark:text-white">
                {supplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="w-64 border-r border-slate-100 dark:border-slate-800 p-4 space-y-2 bg-white dark:bg-slate-950">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
                      isActive 
                        ? 'bg-slate-50 dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 border border-slate-100 dark:border-slate-800 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content Area */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950">
              <div className="flex-1 overflow-y-auto p-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {activeTab === 'dados' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">Tipo de Fornecedor</label>
                            <select
                              name="tipo"
                              value={formData.tipo}
                              onChange={(e) => handleTipoChange(e.target.value as any)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                            >
                              <option value="Jurídica">Pessoa Jurídica</option>
                              <option value="Física">Pessoa Física</option>
                            </select>
                          </div>
                          
                          {formData.tipo === 'Jurídica' ? (
                            <div className="space-y-1">
                              <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">CNPJ</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  name="cnpj"
                                  value={formData.cnpj}
                                  onChange={handleInputChange}
                                  onBlur={() => lookupCNPJ()}
                                  placeholder="00.000.000/0000-00"
                                  maxLength={18}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all pr-10 text-slate-700 dark:text-slate-200"
                                />
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                  {lookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" /> : <Search className="w-3.5 h-3.5 text-slate-300" />}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">CPF</label>
                              <input
                                type="text"
                                name="cpf"
                                value={formData.cpf}
                                onChange={handleInputChange}
                                placeholder="000.000.000-00"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                              />
                            </div>
                          )}
                        </div>

                        {formData.tipo === 'Jurídica' ? (
                          <>
                            <div className="space-y-1">
                              <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">Razão Social</label>
                              <input
                                type="text"
                                name="razaoSocial"
                                value={formData.razaoSocial}
                                onChange={handleInputChange}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200 font-medium"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">Nome Fantasia</label>
                                <input
                                  type="text"
                                  name="nomeFantasia"
                                  value={formData.nomeFantasia}
                                  onChange={handleInputChange}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200 font-medium"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">Inscrição Estadual</label>
                                <input
                                  type="text"
                                  name="inscricaoEstadual"
                                  value={formData.inscricaoEstadual}
                                  onChange={handleInputChange}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200 font-medium"
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-1">
                            <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">Nome Completo</label>
                            <input
                              type="text"
                              name="nome"
                              value={formData.nome}
                              onChange={handleInputChange}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200 font-medium"
                            />
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1 mt-2">
                            <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">Inscrição Municipal</label>
                            <input
                              type="text"
                              name="inscricaoMunicipal"
                              value={formData.inscricaoMunicipal}
                              onChange={handleInputChange}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200 font-medium"
                            />
                          </div>
                          <div className="space-y-1 mt-2">
                            <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">O que Fornece? (Serviços/Produtos)</label>
                            <input
                              type="text"
                              name="servicosProdutos"
                              value={formData.servicosProdutos || ''}
                              onChange={handleInputChange}
                              placeholder="Ex: Materiais elétricos, Internet, Pintura..."
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'localizacao' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">CEP</label>
                            <div className="relative">
                              <input
                                type="text"
                                name="cep"
                                value={formData.cep}
                                onChange={handleInputChange}
                                onBlur={() => lookupCEP()}
                                placeholder="00000-000"
                                maxLength={9}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                              />
                              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                {lookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" /> : <Search className="w-3.5 h-3.5 text-slate-300" />}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">UF</label>
                            <input
                              type="text"
                              name="uf"
                              value={formData.uf}
                              onChange={handleInputChange}
                              maxLength={2}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all uppercase text-slate-700 dark:text-slate-200"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">Logradouro</label>
                          <input
                            type="text"
                            name="logradouro"
                            value={formData.logradouro}
                            onChange={handleInputChange}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">Número</label>
                            <input
                              type="text"
                              name="numero"
                              value={formData.numero}
                              onChange={handleInputChange}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">Bairro</label>
                            <input
                              type="text"
                              name="bairro"
                              value={formData.bairro}
                              onChange={handleInputChange}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">Cidade</label>
                            <input
                              type="text"
                              name="cidade"
                              value={formData.cidade}
                              onChange={handleInputChange}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">Complemento</label>
                            <input
                              type="text"
                              name="complemento"
                              value={formData.complemento}
                              onChange={handleInputChange}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'contato' && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">E-mail</label>
                          <div className="relative">
                            <input
                              type="email"
                              name="email"
                              value={formData.email}
                              onChange={handleInputChange}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                            />
                            <Mail className="absolute left-3 top-2 w-4 h-4 text-slate-300" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">Telefone Fixo</label>
                            <div className="relative">
                              <input
                                type="text"
                                name="telefone"
                                value={formData.telefone}
                                onChange={handleInputChange}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                              />
                              <Phone className="absolute left-3 top-2 w-4 h-4 text-slate-300" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[13px] font-semibold text-[#334155] dark:text-slate-300">Celular / WhatsApp</label>
                            <div className="relative">
                              <input
                                type="text"
                                name="celular"
                                value={formData.celular}
                                onChange={handleInputChange}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-3 h-6 text-[11px] focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all text-slate-700 dark:text-slate-200"
                              />
                              <Smartphone className="absolute left-3 top-2 w-4 h-4 text-slate-300" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer / Actions */}
              <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-4 bg-white dark:bg-slate-950">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#00BFD8] hover:bg-[#00ADC4] disabled:opacity-50 text-white px-6 h-10 rounded-xl font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {supplier ? 'Salvar Alterações' : 'Salvar Fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
