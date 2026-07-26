import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Search, 
  Printer, 
  FileText, 
  ChevronRight, 
  Loader2,
  Users as UsersIcon,
  Church,
  Calendar,
  User,
  MapPin,
  CheckCircle2,
  Download,
  Building2,
  Phone,
  Globe
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  doc
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Member } from '../../lib/member-types';
import { showSuccess, showError } from '../../lib/alerts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChurchData {
  socialName: string;
  ministry: string;
  cnpj: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  website: string;
  pastorPresident: string;
  secretary1: string;
  logos: string[];
}

export default function Carta() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [churchData, setChurchData] = useState<ChurchData | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [step, setStep] = useState<'select' | 'details' | 'preview'>('select');
  
  // Letter Details
  const [destinatario, setDestinatario] = useState('');
  const [cidadeDestino, setCidadeDestino] = useState('');
  const [ufDestino, setUfDestino] = useState('');
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().split('T')[0]);
  const [validadeMeses, setValidadeMeses] = useState('3');
  const [tipoCarta, setTipoCarta] = useState<'apresentacao' | 'recomendacao' | 'transferencia'>('apresentacao');
  const [observacoes, setObservacoes] = useState('');
  const [corpoTexto, setCorpoTexto] = useState('');

  // Update default body text when member or letter type changes
  useEffect(() => {
    if (!selectedMember) return;

    const isMasculino = selectedMember.genero !== 'Feminino';
    const batizadoStr = isMasculino ? 'batizado' : 'batizada';
    const assiduoStr = isMasculino ? 'assíduo' : 'assídua';
    const recebidoStr = isMasculino ? 'recebido' : 'recebida';
    const acolhidoStr = isMasculino ? 'acolhido' : 'acolhida';
    const articulado = isMasculino ? 'o' : 'a';
    const mesmoStr = isMasculino ? 'mesmo' : 'mesma';
    const irmaoStr = isMasculino ? 'irmão' : 'irmã';

    let text = `Informamos que o referido membro encontra-se em plena comunhão com esta igreja, sendo${selectedMember.eBatizado ? ` ${batizadoStr} nas águas,` : ''} ${assiduoStr} aos trabalhos e contribuinte fiel. `;
    
    if (tipoCarta === 'transferencia') {
      text += `Solicitamos que ${articulado} ${mesmoStr} seja ${recebidoStr} no rol de membros desta amada igreja.`;
    } else {
      text += `Recomendamos que seja ${recebidoStr} e ${acolhidoStr} como ${irmaoStr} em Cristo durante sua estada por esta localidade.`;
    }

    setCorpoTexto(text);
  }, [selectedMember, tipoCarta]);

  useEffect(() => {
    if (!user) return;

    // Load Members
    const qMembers = query(
      collection(db, 'members'),
      where('userId', '==', user.uid)
    );

    const unsubscribeMembers = onSnapshot(qMembers, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Member[];
      
      setMembers(docs.sort((a, b) => a.nome.localeCompare(b.nome)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
      setLoading(false);
    });

    // Load Church Data
    const churchRef = doc(db, 'church_data', user.uid);
    const unsubscribeChurch = onSnapshot(churchRef, (docSnap) => {
      if (docSnap.exists()) {
        setChurchData(docSnap.data() as ChurchData);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'church_data');
    });

    return () => {
      unsubscribeMembers();
      unsubscribeChurch();
    };
  }, [user]);

  const filteredMembers = useMemo(() => {
    return members.filter(member => 
      member.nome.toLowerCase().includes(search.toLowerCase()) ||
      member.cpf?.includes(search)
    );
  }, [members, search]);

  const handlePrint = () => {
    window.print();
  };

  const renderLetterContent = () => {
    if (!selectedMember) return null;

    const dataFormatada = format(new Date(dataEmissao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const vigencia = format(new Date(new Date(dataEmissao).setMonth(new Date(dataEmissao).getMonth() + parseInt(validadeMeses))), "dd/MM/yyyy");

    const isMasculino = selectedMember.genero !== 'Feminino';
    const irmaoStr = isMasculino ? 'o irmão' : 'a irmã';
    const portadorStr = isMasculino ? 'portador' : 'portadora';
    const batizadoStr = isMasculino ? 'batizado' : 'batizada';
    const assiduoStr = isMasculino ? 'assíduo' : 'assídua';
    const recebidoStr = isMasculino ? 'recebido' : 'recebida';
    const acolhidoStr = isMasculino ? 'acolhido' : 'acolhida';
    const articulado = isMasculino ? 'o' : 'a';
    const mesmoStr = isMasculino ? 'mesmo' : 'mesma';

    // Helper to sanitize labels with (a)
    const sanitizeLabel = (label: string | undefined) => {
      if (!label) return '';
      return label.replace(/\(a\)/g, isMasculino ? '' : 'a');
    };

    const estadoCivil = sanitizeLabel(selectedMember.estadoCivil);
    const cargo = sanitizeLabel(selectedMember.cargo);

    return (
      <div className="bg-white text-black p-8 md:p-12 shadow-2xl mx-auto w-[210mm] min-h-[297mm] font-sans leading-tight print:shadow-none print:p-0 print:m-0 relative overflow-hidden" id="printable-letter">
        {/* Watermark Logo 3 */}
        {churchData?.logos?.[2] && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.08] z-0">
            <img src={churchData.logos[2]} alt="Watermark" className="w-[450px] object-contain" />
          </div>
        )}

        <div className="relative z-10 w-full h-full flex flex-col">
          {/* Header */}
          <div className="text-center mb-8 border-b-2 border-black pb-4 mx-auto max-w-[70%]">
            {churchData?.logos?.[0] ? (
              <img src={churchData.logos[0]} alt="Logo" className="h-20 mx-auto mb-3 object-contain" />
            ) : (
              <Church className="w-12 h-12 mx-auto mb-2 text-black" />
            )}
            <h1 className="text-xl font-bold uppercase tracking-widest text-black">
              {churchData?.socialName || 'Igreja Evangélica'}
            </h1>
            <div className="text-[10pt] text-black mt-2 flex flex-wrap justify-center gap-x-3">
              {churchData?.address && <span>{churchData.address}, {churchData.city} - {churchData.state}</span>}
              {churchData?.cnpj && <span>CNPJ: {churchData.cnpj}</span>}
              {churchData?.phone && <span>Tel: {churchData.phone}</span>}
            </div>
          </div>

        {/* Content */}
        <div className="space-y-4 text-justify text-[12pt] leading-relaxed">
          <p>À amada igreja <strong>{destinatario || '________________'}</strong>,</p>
          <p>A/C: Ministério Pastoral e Secretaria</p>
          
          <p className="mt-4">
            Saudamos a paz do Senhor Jesus.
          </p>

          <p>
            Vimos por meio desta apresentar {irmaoStr} 
            <strong> {selectedMember.nome}</strong>, {estadoCivil.toLowerCase() || 'membro'}, 
            {portadorStr} do RG nº {selectedMember.rg || '____________'} e CPF nº {selectedMember.cpf || '____________'}, 
            que atualmente ocupa o cargo de <strong>{cargo || 'Membro'}</strong> em nossa instituição.
          </p>

          <p>
            {corpoTexto}
          </p>

          {observacoes && (
            <div className="mt-2 p-3 border border-dashed border-black rounded">
              <p className="text-[10pt] italic"><strong>Obs:</strong> {observacoes}</p>
            </div>
          )}

          <p className="mt-6">
            A presente carta tem validade até o dia <strong>{vigencia}</strong>.
          </p>

          <p className="mt-4">
            Sem mais para o momento, despedimo-nos com a paz do Senhor.
          </p>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-right text-[12pt]">
          <p>{churchData?.city || cidadeDestino || '________________'}, {dataFormatada}.</p>
        </div>

        {/* Signatures */}
        <div className="mt-12 grid grid-cols-2 gap-10">
          <div className="text-center flex flex-col items-center">
            {churchData?.logos?.[1] ? (
              <img 
                src={churchData.logos[1]} 
                alt="Assinatura Pastor" 
                className="h-24 mb-[-12px] object-contain mix-blend-multiply" 
              />
            ) : (
              <div className="h-18"></div>
            )}
            <div className="border-t border-black pt-1 w-full">
              <p className="font-bold text-[11pt]">{churchData?.pastorPresident || '_________________________'}</p>
              <p className="text-[9pt] uppercase">Pastor Presidente</p>
            </div>
          </div>
          <div className="text-center flex flex-col items-center justify-end">
            <div className="h-18"></div>
            <div className="border-t border-black pt-1 w-full">
              <p className="font-bold text-[11pt]">{churchData?.secretary1 || '_________________________'}</p>
              <p className="text-[9pt] uppercase">Secretário(a)</p>
            </div>
          </div>
        </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-transparent overflow-hidden">
      {/* Header Area */}
      <div className="px-8 py-4 shrink-0 bg-white/50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800/50">
        <div className="flex flex-wrap items-center gap-4">
          {/* Pesquisa no Cabeçalho */}
          {step === 'select' && (
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Pesquisar membro..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none shadow-sm"
              />
            </div>
          )}

          {/* Progress Steps */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button 
              onClick={() => setStep('select')}
              className={`flex items-center gap-2 p-1.5 px-3 rounded-lg transition-all outline-none ${step === 'select' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">1 Membro</span>
            </button>
            
            <button 
              onClick={() => {
                if (!selectedMember) {
                  showError('Selecione um membro primeiro.');
                  return;
                }
                setStep('details');
              }}
              className={`flex items-center gap-2 p-1.5 px-3 rounded-lg transition-all outline-none ${step === 'details' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">2 Destino</span>
            </button>
            
            <button 
              onClick={() => {
                if (!selectedMember) {
                  showError('Selecione um membro primeiro.');
                  return;
                }
                if (!destinatario || !cidadeDestino || !ufDestino) {
                  showError('Preencha os campos de destino para visualizar.');
                  return;
                }
                setStep('preview');
              }}
              className={`flex items-center gap-2 p-1.5 px-3 rounded-lg transition-all outline-none ${step === 'preview' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">3 Visualização</span>
            </button>
          </div>

          {step === 'preview' && (
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-2 px-4 rounded-xl transition-all shadow-lg text-[10px] uppercase tracking-widest"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <AnimatePresence mode="wait">
          {step === 'select' && (
            <motion.div 
              key="select"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full flex flex-col gap-6"
            >
              <div className="flex-1 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-2xl shadow-sm overflow-auto scrollbar-hide">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                    <p className="text-slate-500 font-medium">Carregando lista de membros...</p>
                  </div>
                ) : filteredMembers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                    {filteredMembers.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => {
                          setSelectedMember(member);
                          setStep('details');
                        }}
                        className={`group relative flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                          selectedMember?.id === member.id 
                            ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30' 
                            : 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/50 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-600">
                          {member.fotoUrl ? (
                            <img src={member.fotoUrl} alt={member.nome} className="w-full h-full object-cover" />
                          ) : member.nome.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate">{member.nome}</h3>
                          <p className="text-xs text-slate-500 font-medium">{member.cargo || 'Membro'}</p>
                        </div>
                        {selectedMember?.id === member.id && (
                          <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        )}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <UsersIcon className="w-12 h-12 text-slate-300" />
                    <p className="text-slate-500 font-medium">Nenhum membro encontrado.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 'details' && (
            <motion.div 
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto w-full"
            >
              <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-2xl shadow-sm overflow-hidden p-8">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  Detalhes do Documento
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Selected Member Info */}
                  <div className="md:col-span-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white dark:border-slate-700">
                      {selectedMember?.fotoUrl ? <img src={selectedMember.fotoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600">{selectedMember?.nome.charAt(0)}</div>}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Membro Selecionado</p>
                      <p className="font-bold text-slate-800 dark:text-white">{selectedMember?.nome}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 ml-1">
                      <Church className="w-3 h-3" /> Igreja de Destino
                    </label>
                    <input 
                      type="text" 
                      value={destinatario}
                      onChange={(e) => setDestinatario(e.target.value)}
                      placeholder="Ex: Assembleia de Deus"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-1 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 ml-1">
                        <MapPin className="w-3 h-3" /> Cidade
                      </label>
                      <input 
                        type="text" 
                        value={cidadeDestino}
                        onChange={(e) => setCidadeDestino(e.target.value)}
                        placeholder="Nome da cidade"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-1 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 ml-1">UF</label>
                      <input 
                        type="text" 
                        maxLength={2}
                        value={ufDestino}
                        onChange={(e) => setUfDestino(e.target.value.toUpperCase())}
                        placeholder="UF"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-1 text-center text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 ml-1">
                      <Calendar className="w-3 h-3" /> Data de Emissão
                    </label>
                    <input 
                      type="date" 
                      value={dataEmissao}
                      onChange={(e) => setDataEmissao(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-1 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 ml-1">Validade (Meses)</label>
                    <select 
                      value={validadeMeses}
                      onChange={(e) => setValidadeMeses(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-1 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none cursor-pointer"
                    >
                      <option value="1">1 mês</option>
                      <option value="3">3 meses</option>
                      <option value="6">6 meses</option>
                      <option value="12">12 meses</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 ml-1">Tipo de Carta</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['apresentacao', 'recomendacao', 'transferencia'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setTipoCarta(type)}
                          className={`py-1 px-4 rounded-xl text-[10px] uppercase tracking-wider font-bold border transition-all ${
                            tipoCarta === type 
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
                          }`}
                        >
                          {type === 'apresentacao' ? 'Apresentação' : type === 'recomendacao' ? 'Recomendação' : 'Transferência'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 ml-1">Corpo do Texto</label>
                    <textarea 
                      value={corpoTexto}
                      onChange={(e) => setCorpoTexto(e.target.value)}
                      placeholder="Editar o corpo da carta..."
                      rows={4}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none resize-y"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 ml-1">Observações (Opcional)</label>
                    <textarea 
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Informações adicionais para constar na carta..."
                      rows={3}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button 
                    onClick={() => {
                      if (!destinatario || !cidadeDestino || !ufDestino) {
                        showError('Preencha os campos de destino obrigatórios.');
                        return;
                      }
                      setStep('preview');
                    }}
                    className="flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-10 rounded-xl transition-all shadow-lg shadow-indigo-600/20 w-full md:w-auto"
                  >
                    Gerar Prévia
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'preview' && (
            <motion.div 
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full flex flex-col gap-6 overflow-hidden"
            >
              <div className="flex-1 overflow-auto scrollbar-hide bg-slate-900/5 dark:bg-slate-900/20 rounded-2xl p-4 md:p-8 flex justify-center">
                {renderLetterContent()}
              </div>

              {/* Mobile Print Button Floating */}
              <div className="md:hidden fixed bottom-6 right-6 z-50">
                <button 
                  onClick={handlePrint}
                  className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-indigo-600/40"
                >
                  <Printer className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-letter, #printable-letter * {
            visibility: visible !important;
          }
          #printable-letter {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 1.5cm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
            z-index: 9999 !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
