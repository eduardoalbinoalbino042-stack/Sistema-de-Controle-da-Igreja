import React, { useState, useEffect } from 'react';
import { X, Save, User, Phone, Mail, MapPin, Calendar, Briefcase, Camera, ChevronRight, ChevronLeft, CreditCard, Heart, Users as UsersIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Member, ESCOLARIDADES, ESTADOS_CIVIS, FORMAS_RECEBIMENTO, CARGOS } from '../lib/member-types';
import { format, parseISO } from 'date-fns';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: Member) => void;
  member?: Member | null;
}

const TABS = [
  { id: 'pessoal', label: 'Dados Pessoais', icon: User },
  { id: 'domiciliar', label: 'Dados Domiciliares', icon: MapPin },
  { id: 'familiar', label: 'Dados Familiares', icon: Heart },
  { id: 'eclesiastico', label: 'Dados Eclesiásticos', icon: Briefcase },
];

export default function MemberModal({ isOpen, onClose, onSave, member }: MemberModalProps) {
  const [activeTab, setActiveTab] = useState('pessoal');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<Member>>({
    nome: '',
    status: 'Ativo',
    genero: 'Masculino',
    eBatizado: false,
    temCartao: false,
    estadoCivil: 'Solteiro(a)',
    escolaridade: 'Médio Completo',
    formaRecebimento: 'Batismo',
    cargo: 'Membro',
  });

  useEffect(() => {
    if (member) {
      setFormData(member);
    } else {
      setFormData({
        nome: '',
        status: 'Ativo',
        genero: 'Masculino',
        eBatizado: false,
        temCartao: false,
        estadoCivil: 'Solteiro(a)',
        escolaridade: 'Médio Completo',
        formaRecebimento: 'Batismo',
        cargo: 'Membro',
        dataRegistro: new Date().toISOString().split('T')[0],
      });
    }
  }, [member, isOpen]);

  useEffect(() => {
    const fetchAddress = async () => {
      const cep = formData.cep?.replace(/\D/g, '');
      if (cep?.length === 8) {
        try {
          const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const data = await response.json();
          if (!data.erro) {
            setFormData(prev => ({
              ...prev,
              endereco: data.logradouro,
              bairro: data.bairro,
              cidade: data.localidade,
              uf: data.uf,
            }));
          }
        } catch (error) {
          console.error("Erro ao buscar CEP:", error);
        }
      }
    };

    fetchAddress();
  }, [formData.cep]);

  useEffect(() => {
    if (formData.dataNascimento) {
      const birthDate = new Date(formData.dataNascimento);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age >= 0 && age !== formData.idade) {
        setFormData(prev => ({ ...prev, idade: age }));
      }
    }
  }, [formData.dataNascimento]);

  const applyMask = (name: string, value: string) => {
    const rawValue = value.replace(/\D/g, '');
    
    switch (name) {
      case 'cep':
        return rawValue.replace(/(\d{5})(\d)/, '$1-$2').slice(0, 9);
      case 'cpf':
        return rawValue
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d{1,2})/, '$1-$2')
          .slice(0, 14);
      case 'celular':
        return rawValue
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{5})(\d)/, '$1-$2')
          .slice(0, 15);
      case 'telefone':
        return rawValue
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d)/, '$1-$2')
          .slice(0, 14);
      case 'rg':
        return rawValue
          .replace(/(\d{2})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d{1})/, '$1-$2')
          .slice(0, 12);
      default:
        return value;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    if (['cep', 'cpf', 'rg', 'celular', 'telefone'].includes(name)) {
      val = applyMask(name, value);
    }

    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, fotoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Member);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
              <User className="w-6 h-6 text-cyan-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {member ? 'Editar Membro' : 'Novo Cadastro de Membro'}
                </h2>
                {formData.idPlanilha && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-500">
                    ID {formData.idPlanilha}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Preencha os dados conforme a ficha cadastral.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-900/50 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-bold transition-all relative whitespace-nowrap ${
                activeTab === tab.id ? 'text-cyan-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />
              )}
            </button>
          ))}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto min-h-[500px] p-8 bg-white dark:bg-slate-900">
          <form id="member-form" onSubmit={handleSubmit} className="space-y-8" autoComplete="off">
            {activeTab === 'pessoal' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 flex flex-col items-center gap-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div 
                    onClick={handlePhotoClick}
                    className="w-40 h-40 rounded-3xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center gap-2 relative overflow-hidden group cursor-pointer"
                  >
                    {formData.fotoUrl ? (
                      <img src={formData.fotoUrl} alt="Foto" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Foto do Membro</span>
                      </>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-bold">Alterar Foto</span>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">ID / REGISTRO</label>
                      <input disabled type="text" placeholder="Automático" value={formData.idPlanilha || ''} className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium text-slate-500 outline-none" />
                    </div>
                    <div className="md:col-span-6">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Nome Completo</label>
                      <input required type="text" name="nome" value={formData.nome || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Data Registro</label>
                      <input type="date" name="dataRegistro" value={formData.dataRegistro || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Data Nascimento</label>
                      <input type="date" name="dataNascimento" value={formData.dataNascimento || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                    </div>
                    <div className="md:col-span-2">
                       <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Idade</label>
                       <input 
                        type="number" 
                        name="idade" 
                        value={formData.idade || ''} 
                        readOnly
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium text-slate-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Gênero</label>
                      <select name="genero" value={formData.genero || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none">
                        <option value="Masculino">Masculino</option>
                        <option value="Feminino">Feminino</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Escolaridade</label>
                      <select name="escolaridade" value={formData.escolaridade || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none">
                        {ESCOLARIDADES.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">CPF</label>
                      <input type="text" name="cpf" value={formData.cpf || ''} onChange={handleChange} placeholder="000.000.000-00" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">RG</label>
                      <input type="text" name="rg" value={formData.rg || ''} onChange={handleChange} placeholder="00.000.000-0" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Natural De</label>
                      <input type="text" name="naturalidade" value={formData.naturalidade || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">UF NASCI</label>
                      <input type="text" name="ufNascimento" value={formData.ufNascimento || ''} onChange={handleChange} maxLength={2} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all uppercase outline-none" />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Celular</label>
                      <input type="text" name="celular" value={formData.celular || ''} onChange={handleChange} placeholder="(00) 00000-0000" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                    </div>
                    <div className="md:col-span-6">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Telefone</label>
                      <input type="text" name="telefone" value={formData.telefone || ''} onChange={handleChange} placeholder="(00) 0000-0000" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                    </div>

                    <div className="md:col-span-6">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">E-mail</label>
                      <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'domiciliar' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">CEP</label>
                  <input type="text" name="cep" value={formData.cep || ''} onChange={handleChange} placeholder="00000-000" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                </div>
                <div className="md:col-span-8">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Endereço</label>
                  <input type="text" name="endereco" value={formData.endereco || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Nº</label>
                  <input type="text" name="numero" value={formData.numero || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Bairro</label>
                  <input type="text" name="bairro" value={formData.bairro || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Complemento</label>
                  <input type="text" name="complemento" value={formData.complemento || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Cidade</label>
                  <input type="text" name="cidade" value={formData.cidade || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">UF</label>
                  <input type="text" name="uf" value={formData.uf || ''} onChange={handleChange} maxLength={2} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all uppercase outline-none" />
                </div>
              </div>
            )}

            {activeTab === 'familiar' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Nome do Pai</label>
                  <input type="text" name="nomePai" value={formData.nomePai || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Nome da Mãe</label>
                  <input type="text" name="nomeMae" value={formData.nomeMae || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Estado Civil</label>
                  <select name="estadoCivil" value={formData.estadoCivil || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none">
                    {ESTADOS_CIVIS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Nome do Cônjuge</label>
                  <input type="text" name="conjuge" value={formData.conjuge || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                </div>
                {formData.estadoCivil === 'Casado(a)' && (
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Data do Casamento</label>
                    <input type="date" name="dataCasamento" value={formData.dataCasamento || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                  </motion.div>
                )}
              </div>
            )}

            {activeTab === 'eclesiastico' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">É Batizado?</label>
                    <select name="eBatizado" value={formData.eBatizado ? 'true' : 'false'} onChange={(e) => setFormData(prev => ({ ...prev, eBatizado: e.target.value === 'true' }))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none">
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Data de Batismo</label>
                    <input type="date" name="dataBatismo" value={formData.dataBatismo || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Nome Pastor Que Batizou</label>
                    <input type="text" name="pastorBatismo" value={formData.pastorBatismo || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Nome da Igreja Que Batizou</label>
                    <input type="text" name="igrejaBatismo" value={formData.igrejaBatismo || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Tinha Cargo? Qual?</label>
                    <select name="cargoAnterior" value={formData.cargoAnterior || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none">
                      <option value="">Nenhum / Não possuía</option>
                      {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Recebido Por:</label>
                    <select name="formaRecebimento" value={formData.formaRecebimento || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none">
                      <option value="">Selecionar</option>
                      {FORMAS_RECEBIMENTO.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Data de Recebido</label>
                    <input type="date" name="dataRecebimento" value={formData.dataRecebimento || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Exerce Cargo De:</label>
                    <select name="cargo" value={formData.cargo || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none">
                      <option value="Membro">Membro</option>
                      {CARGOS.filter(c => c !== 'Membro').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Status</label>
                    <select name="status" value={formData.status || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg h-[22px] px-2 text-[11px] font-medium focus:ring-1 focus:ring-cyan-500 transition-all outline-none">
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                      <option value="Afastado">Afastado</option>
                      <option value="Falecido">Falecido</option>
                      <option value="Transferido">Transferido</option>
                      <option value="Visitante">Visitante</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all">
            Cancelar
          </button>
          <button 
            form="member-form"
            type="submit"
            className="bg-cyan-500 hover:bg-cyan-400 text-white font-bold py-2.5 px-8 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
          >
            <Save className="w-5 h-5" />
            Salvar Membro
          </button>
        </div>
      </motion.div>
    </div>
  );
}
