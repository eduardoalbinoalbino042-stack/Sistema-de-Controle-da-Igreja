import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Contact, 
  Search, 
  Printer, 
  Palette, 
  Upload, 
  Check, 
  X,
  Loader2,
  Image as ImageIcon,
  ChevronRight,
  User,
  Settings2,
  Save,
  Hexagon
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  doc,
  getDoc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { useAuth } from '../../context/AuthContext';
import { Member } from '../../lib/member-types';
import jsPDF from 'jspdf';
import { showSuccess, showError } from '../../lib/alerts';
import { format, parseISO } from 'date-fns';

interface CrachaConfig {
  frontBg: string;
  backBg: string;
  validityYears: number;
  presidentName: string;
  cornerRadius: number;
  // Front specific
  textColor: string;
  churchNameColor: string;
  labelColor: string;
  fontSize: number;
  cargoFontSize: number;
  overlayOpacity: number;
  overlayColor: string;
  showPhoto: boolean;
  signatureUrl: string;
  // Back specific
  backTextColor: string;
  backLabelColor: string;
  backFontSize: number;
  backOverlayColor: string;
  backOverlayOpacity: number;
  backBorderColor: string;
  backBorderOpacity: number;
}

export default function Cracha() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'front' | 'back'>('front');
  const [churchInfo, setChurchInfo] = useState<any>({});
  const [churchLogos, setChurchLogos] = useState<string[]>([]);

  const [config, setConfig] = useState<CrachaConfig>(() => {
    const saved = localStorage.getItem('church_cracha_config_v2');
    const defaultVals = {
      frontBg: '',
      backBg: '',
      textColor: '#000000',
      churchNameColor: '#1e3a8a',
      labelColor: '#475569',
      fontSize: 10,
      cargoFontSize: 8,
      showPhoto: true,
      validityYears: 2,
      presidentName: 'Eduardo Albino',
      overlayOpacity: 0.8,
      overlayColor: '#ffffff',
      cornerRadius: 3,
      signatureUrl: '',
      // Back defaults
      backTextColor: '#000000',
      backLabelColor: '#000000',
      backFontSize: 11,
      backOverlayColor: '#ffffff',
      backOverlayOpacity: 0.8,
      backBorderColor: '#000000',
      backBorderOpacity: 0.2
    };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultVals, ...parsed };
      } catch (e) {
        return defaultVals;
      }
    }
    return defaultVals;
  });

  useEffect(() => {
    localStorage.setItem('church_cracha_config_v2', JSON.stringify(config));
  }, [config]);

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
      setMembers(docs.sort((a, b) => a.nome.localeCompare(b.nome)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
    });

    const fetchChurch = async () => {
      const docRef = doc(db, 'church_data', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChurchInfo(data);
        setChurchLogos(data.logos || []);
      }
    };
    fetchChurch();

    return () => unsubscribe();
  }, [user]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => 
      m.nome.toLowerCase().includes(search.toLowerCase()) ||
      m.cpf?.includes(search) ||
      m.cargo?.toLowerCase().includes(search.toLowerCase())
    );
  }, [members, search]);

  const handleToggleSelect = (id: string) => {
    setSelectedMembers(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedMembers.length === filteredMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(filteredMembers.map(m => m.id!));
    }
  };

  const handleBgUpload = (type: 'front' | 'back' | 'signature') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showError("Arquivo muito grande", "A imagem deve ter no máximo 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'signature') {
          setConfig(prev => ({ ...prev, signatureUrl: reader.result as string }));
        } else {
          setConfig(prev => ({ 
            ...prev, 
            [type === 'front' ? 'frontBg' : 'backBg']: reader.result as string 
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };
  const generatePDF = () => {
    if (selectedMembers.length === 0) {
      showError("Selecione os membros", "Você precisa selecionar pelo menos um membro para imprimir.");
      return;
    }

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const selectedData = members.filter(m => selectedMembers.includes(m.id!));
      const logo = churchLogos[0];

      const cardW = 54;
      const cardH = 86;
      const cornerRadius = config.cornerRadius || 3;
      const colGap = 8;
      const marginX = (210 - (cardW * 2 + colGap)) / 2;
      const marginY = 15;
      const rowGap = 5;

      const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return '---';
        try {
          return format(parseISO(dateStr), 'dd/MM/yyyy');
        } catch (e) {
          return '---';
        }
      };

      selectedData.forEach((member, index) => {
        const slotInPage = index % 3;
        if (index > 0 && slotInPage === 0) {
          doc.addPage();
        }

        const y = marginY + (slotInPage * (cardH + rowGap));
        const xFront = marginX;
        const xBack = marginX + cardW + colGap;

        // Helper for transparency
        const setOpacity = (opacity: number) => {
          try {
            // @ts-ignore
            const GState = (doc as any).GState || (jsPDF as any).GState;
            if (GState) {
              doc.setGState(new GState({ opacity }));
            }
          } catch (e) {
            console.warn("Transparency not supported", e);
          }
        };

        // --- FRONT ---
        doc.saveGraphicsState();
        if (config.frontBg) {
          doc.roundedRect(xFront, y, cardW, cardH, cornerRadius, cornerRadius, 'F');
          doc.clip();
          doc.addImage(config.frontBg, 'JPEG', xFront, y, cardW, cardH);
        } else {
          doc.setDrawColor(200);
          doc.roundedRect(xFront, y, cardW, cardH, cornerRadius, cornerRadius, 'D');
        }
        doc.restoreGraphicsState();

        // Church Logo
        if (logo) {
          try {
            doc.addImage(logo, 'PNG', xFront + (cardW / 2) - 8, y + 4, 16, 16);
          } catch (e) {}
        }

        // Church Name
        doc.setFontSize(8);
        doc.setTextColor(config.churchNameColor);
        doc.setFont('helvetica', 'bold');
        const churchName = (churchInfo.ministry || churchInfo.socialName || churchInfo.churchName || 'NOME DA IGREJA').toUpperCase();
        doc.text(churchName, xFront + (cardW / 2), y + 25, { align: 'center', maxWidth: cardW - 6 });

        // Member Photo
        if (config.showPhoto && member.fotoUrl) {
          const photoW = 26;
          const photoH = 32;
          const photoX = xFront + (cardW / 2) - (photoW / 2);
          const photoY = y + 30;
          
          try {
            doc.saveGraphicsState();
            doc.roundedRect(photoX, photoY, photoW, photoH, 1, 1, 'F');
            doc.clip();
            doc.addImage(member.fotoUrl, 'JPEG', photoX, photoY, photoW, photoH);
            doc.restoreGraphicsState();
          } catch(e) { 
            doc.setDrawColor(200);
            doc.roundedRect(photoX, photoY, photoW, photoH, 1, 1, 'D');
          }
        }

        // Data Overlay Logic
        const drawFrontOverlay = (oy: number, oh: number) => {
          doc.saveGraphicsState();
          setOpacity(config.overlayOpacity);
          doc.setFillColor(config.overlayColor);
          doc.roundedRect(xFront + 4, oy, cardW - 8, oh, 1, 1, 'F');
          doc.restoreGraphicsState();
        };

        // Name
        const nameY = y + 66;
        drawFrontOverlay(nameY, 8);
        doc.setFontSize(5);
        doc.setTextColor(config.labelColor);
        doc.setFont('helvetica', 'normal');
        doc.text("NOME", xFront + 5, nameY + 2.5);
        doc.setFontSize(config.fontSize || 9);
        doc.setTextColor(config.textColor);
        doc.setFont('helvetica', 'bold');
        doc.text((member.nome || '').toUpperCase(), xFront + (cardW / 2), nameY + 6.5, { align: 'center', maxWidth: cardW - 10 });

        // Cargo
        const cargoY = y + 75;
        drawFrontOverlay(cargoY, 8);
        doc.setFontSize(5);
        doc.setTextColor(config.labelColor);
        doc.setFont('helvetica', 'normal');
        doc.text("CARGO", xFront + 5, cargoY + 2.5);
        doc.setFontSize(config.cargoFontSize || 8);
        doc.setTextColor(config.textColor);
        doc.setFont('helvetica', 'bold');
        doc.text((member.cargo || 'Membro').toUpperCase(), xFront + (cardW / 2), cargoY + 6.5, { align: 'center', maxWidth: cardW - 10 });

        // --- BACK ---
        doc.saveGraphicsState();
        if (config.backBg) {
          doc.roundedRect(xBack, y, cardW, cardH, cornerRadius, cornerRadius, 'F');
          doc.clip();
          doc.addImage(config.backBg, 'JPEG', xBack, y, cardW, cardH);
        } else {
          doc.setDrawColor(200);
          doc.roundedRect(xBack, y, cardW, cardH, cornerRadius, cornerRadius, 'D');
        }
        doc.restoreGraphicsState();

        const backFieldW = cardW - 10;
        const backFieldH = 7;
        const startBackY = y + 10;

        const drawBackBox = (fy: number) => {
          // Overlay
          doc.saveGraphicsState();
          setOpacity(config.backOverlayOpacity);
          doc.setFillColor(config.backOverlayColor);
          doc.roundedRect(xBack + 5, fy, backFieldW, backFieldH, 1, 1, 'F');
          doc.restoreGraphicsState();

          // Border
          if (config.backBorderOpacity > 0) {
            doc.saveGraphicsState();
            setOpacity(config.backBorderOpacity);
            doc.setDrawColor(config.backBorderColor);
            doc.setLineWidth(0.1);
            doc.roundedRect(xBack + 5, fy, backFieldW, backFieldH, 1, 1, 'S');
            doc.restoreGraphicsState();
          }
        };

        const addBackRow = (label: string, value: string, fy: number) => {
          drawBackBox(fy);
          doc.setFontSize((config.backFontSize || 11) * 0.6);
          doc.setTextColor(config.backLabelColor);
          doc.setFont('helvetica', 'normal');
          doc.text(label, xBack + 6, fy + 4.5);

          doc.setFontSize((config.backFontSize || 11) * 0.8);
          doc.setTextColor(config.backTextColor);
          doc.setFont('helvetica', 'bold');
          doc.text(value, xBack + cardW - 6, fy + 4.8, { align: 'right' });
        };

        addBackRow("MATRÍCULA", String(member.idPlanilha || '000').padStart(4, '0'), startBackY);
        addBackRow("RG", member.rg || '---', startBackY + 8);
        addBackRow("NASCIMENTO", formatDate(member.dataNascimento), startBackY + 16);
        addBackRow("MEMBRO DESDE", formatDate(member.dataRecebimento), startBackY + 24);
        addBackRow("VALIDADE", format(new Date(new Date().getFullYear() + config.validityYears, 11, 31), 'dd/MM/yyyy'), startBackY + 32);

        // Signature area
        if (config.signatureUrl) {
          try {
            doc.addImage(config.signatureUrl, 'PNG', xBack + (cardW / 2) - 15, y + 55, 30, 8);
          } catch(e) {}
        }
        
        doc.setDrawColor(config.backTextColor);
        doc.setLineWidth(0.1);
        doc.line(xBack + 10, y + 64, xBack + cardW - 10, y + 64);

        doc.setFontSize((config.backFontSize || 11) * 0.7);
        doc.setTextColor(config.backTextColor);
        doc.setFont('helvetica', 'normal');
        doc.text(config.presidentName || '', xBack + cardW / 2, y + 68, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize((config.backFontSize || 11) * 0.5);
        doc.text("Pastor Presidente", xBack + cardW / 2, y + 71, { align: 'center' });

        // Address
        doc.setFontSize(5);
        doc.setTextColor(config.backTextColor);
        const addr = `${churchInfo.address || ''} - ${churchInfo.city || ''}/${churchInfo.state || ''}`;
        doc.text(addr, xBack + cardW / 2, y + 80, { align: 'center', maxWidth: cardW - 8 });
      });

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      showSuccess("PDF gerado com sucesso!");
    } catch (e) {
      console.error(e);
      showError("Erro ao gerar PDF", "Ocorreu um problema ao gerar o arquivo.");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-transparent overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-8 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-600/20">
            <Hexagon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Emissor de Crachás</h2>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Identificações Verticais Personalizadas</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsConfigOpen(true)}
            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-all text-sm shadow-sm border border-slate-200 dark:border-slate-700"
          >
            <Settings2 className="w-4 h-4" />
            Configurar Modelo
          </button>
          <button 
            onClick={generatePDF}
            className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-orange-600/20 text-sm"
          >
            <Printer className="w-5 h-5" />
            Imprimir Selecionados ({selectedMembers.length})
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-8 px-8 pb-8 overflow-hidden">
        {/* Members List */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-3xl shadow-sm overflow-hidden min-h-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar membro..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-medium"
              />
            </div>
            <button 
              onClick={handleSelectAll}
              className="text-xs font-black text-orange-600 uppercase tracking-widest hover:text-orange-700 transition-colors"
            >
              {selectedMembers.length === filteredMembers.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                <p className="text-slate-500 font-medium font-bold uppercase text-[10px]">Carregando...</p>
              </div>
            ) : filteredMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <User className="w-12 h-12 text-slate-200 mb-4" />
                    <p className="text-slate-400 font-black uppercase text-xs">Nenhum membro encontrado</p>
                </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredMembers.map(member => (
                  <label 
                    key={member.id}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer group ${
                      selectedMembers.includes(member.id!) 
                        ? 'bg-orange-50 dark:bg-orange-600/10 border-orange-600 shadow-md' 
                        : 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800/50'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={selectedMembers.includes(member.id!)}
                      onChange={() => handleToggleSelect(member.id!)}
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-slate-900 flex items-center justify-center text-orange-600 font-bold overflow-hidden border border-slate-100 dark:border-slate-800">
                        {member.fotoUrl ? (
                          <img src={member.fotoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : member.nome[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{member.nome}</p>
                        <p className="text-[10px] text-slate-400 truncate uppercase font-medium">{member.cargo || 'Membro'}</p>
                      </div>
                      {selectedMembers.includes(member.id!) && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-orange-600 rounded-full flex items-center justify-center text-white shadow-lg">
                          <Check className="w-3 h-3" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Configuration Modal */}
        <AnimatePresence>
          {isConfigOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsConfigOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
              >
                <div className="p-8">
                  <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-600/10 rounded-xl">
                        <Palette className="w-5 h-5 text-orange-600" />
                      </div>
                      <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Configuração do Modelo</h3>
                    </div>
                    <button 
                      onClick={() => setIsConfigOpen(false)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  <div className="flex flex-col lg:flex-row gap-12 max-h-[70vh] overflow-hidden">
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden pr-2">
                      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6 shrink-0">
                        <button 
                          onClick={() => setActiveTab('front')}
                          className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                            activeTab === 'front' 
                              ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm' 
                              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                          }`}
                        >
                          Configuração Frente
                        </button>
                        <button 
                          onClick={() => setActiveTab('back')}
                          className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                            activeTab === 'back' 
                              ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm' 
                              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                          }`}
                        >
                          Configuração Verso
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                        {/* Configurações Gerais - Always visible at top */}
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest border-b border-orange-100 dark:border-orange-900/30 pb-2">Configurações Gerais</h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Anos Validade</label>
                              <input 
                                type="number"
                                value={config.validityYears}
                                onChange={(e) => setConfig(prev => ({ ...prev, validityYears: parseInt(e.target.value) }))}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Canto Arredondado ({config.cornerRadius}mm)</label>
                              <input 
                                type="range"
                                min="0"
                                max="10"
                                step="0.5"
                                value={config.cornerRadius}
                                onChange={(e) => setConfig(prev => ({ ...prev, cornerRadius: parseFloat(e.target.value) }))}
                                className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-600"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Nome do Presidente (Verso)</label>
                            <input 
                              type="text"
                              value={config.presidentName}
                              onChange={(e) => setConfig(prev => ({ ...prev, presidentName: e.target.value }))}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-bold"
                            />
                          </div>
                        </div>

                        {/* Configurações FRENTE - Tab Front */}
                        {activeTab === 'front' && (
                          <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-4 pt-2"
                          >
                            <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest border-b border-orange-100 dark:border-orange-900/30 pb-2">Configurações da Frente</h4>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Fundo Frente</label>
                                <div className="relative h-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden group">
                                  {config.frontBg ? (
                                    <>
                                      <img src={config.frontBg} className="w-full h-full object-cover" alt="Front Preview" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <label className="cursor-pointer bg-white text-slate-800 px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-lg transition-all">
                                          Trocar
                                          <input type="file" className="hidden" accept="image/*" onChange={handleBgUpload('front')} />
                                        </label>
                                      </div>
                                    </>
                                  ) : (
                                    <label className="cursor-pointer flex flex-col items-center gap-1">
                                      <Upload className="w-4 h-4 text-slate-300" />
                                      <span className="text-[9px] font-bold text-slate-400 uppercase">Upload</span>
                                      <input type="file" className="hidden" accept="image/*" onChange={handleBgUpload('front')} />
                                    </label>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col justify-center">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    checked={config.showPhoto}
                                    onChange={(e) => setConfig(prev => ({ ...prev, showPhoto: e.target.checked }))}
                                    className="w-3.5 h-3.5 rounded text-orange-600"
                                  />
                                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Exibir Foto</span>
                                </label>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-600 uppercase">Cor Igreja</label>
                                <input 
                                  type="color" 
                                  value={config.churchNameColor}
                                  onChange={(e) => setConfig(prev => ({ ...prev, churchNameColor: e.target.value }))}
                                  className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                                />
                              </div>
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-600 uppercase">Cor Títulos</label>
                                <input 
                                  type="color" 
                                  value={config.labelColor}
                                  onChange={(e) => setConfig(prev => ({ ...prev, labelColor: e.target.value }))}
                                  className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-600 uppercase">Cor Dados</label>
                                <input 
                                  type="color" 
                                  value={config.textColor}
                                  onChange={(e) => setConfig(prev => ({ ...prev, textColor: e.target.value }))}
                                  className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                                />
                              </div>
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-600 uppercase">Fundo Dados</label>
                                <input 
                                  type="color" 
                                  value={config.overlayColor}
                                  onChange={(e) => setConfig(prev => ({ ...prev, overlayColor: e.target.value }))}
                                  className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Fonte Nome ({config.fontSize}pt)</label>
                                <input 
                                  type="range"
                                  min="6"
                                  max="14"
                                  step="0.5"
                                  value={config.fontSize}
                                  onChange={(e) => setConfig(prev => ({ ...prev, fontSize: parseFloat(e.target.value) }))}
                                  className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-600"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Fonte Cargo ({config.cargoFontSize}pt)</label>
                                <input 
                                  type="range"
                                  min="5"
                                  max="12"
                                  step="0.5"
                                  value={config.cargoFontSize}
                                  onChange={(e) => setConfig(prev => ({ ...prev, cargoFontSize: parseFloat(e.target.value) }))}
                                  className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-600"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Opacidade ({Math.round(config.overlayOpacity * 100)}%)</label>
                                <input 
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={config.overlayOpacity}
                                  onChange={(e) => setConfig(prev => ({ ...prev, overlayOpacity: parseFloat(e.target.value) }))}
                                  className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-600"
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Configurações VERSO - Tab Back */}
                        {activeTab === 'back' && (
                          <motion.div 
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-4 pt-2"
                          >
                            <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest border-b border-orange-100 dark:border-orange-900/30 pb-2">Configurações do Verso</h4>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Fundo Verso</label>
                                <div className="relative h-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden group">
                                  {config.backBg ? (
                                    <>
                                      <img src={config.backBg} className="w-full h-full object-cover" alt="Back Preview" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <label className="cursor-pointer bg-white text-slate-800 px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-lg transition-all">
                                          Trocar
                                          <input type="file" className="hidden" accept="image/*" onChange={handleBgUpload('back')} />
                                        </label>
                                      </div>
                                    </>
                                  ) : (
                                    <label className="cursor-pointer flex flex-col items-center gap-1">
                                      <Upload className="w-4 h-4 text-slate-300" />
                                      <span className="text-[9px] font-bold text-slate-400 uppercase">Upload</span>
                                      <input type="file" className="hidden" accept="image/*" onChange={handleBgUpload('back')} />
                                    </label>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Assinatura Presidente</label>
                                <div className="relative h-14 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden group">
                                  {config.signatureUrl ? (
                                    <img src={config.signatureUrl} className="h-full object-contain" alt="Signature" />
                                  ) : (
                                    <label className="cursor-pointer flex flex-col items-center gap-1">
                                      <Upload className="w-4 h-4 text-slate-300" />
                                      <input type="file" className="hidden" accept="image/*" onChange={handleBgUpload('signature')} />
                                    </label>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-600 uppercase">Texto Verso</label>
                                <input 
                                  type="color" 
                                  value={config.backTextColor}
                                  onChange={(e) => setConfig(prev => ({ ...prev, backTextColor: e.target.value }))}
                                  className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                                />
                              </div>
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-600 uppercase">Títulos Verso</label>
                                <input 
                                  type="color" 
                                  value={config.backLabelColor}
                                  onChange={(e) => setConfig(prev => ({ ...prev, backLabelColor: e.target.value }))}
                                  className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-600 uppercase">Fundo Campos</label>
                                <input 
                                  type="color" 
                                  value={config.backOverlayColor}
                                  onChange={(e) => setConfig(prev => ({ ...prev, backOverlayColor: e.target.value }))}
                                  className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                                />
                              </div>
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-600 uppercase">Bordas Campos</label>
                                <input 
                                  type="color" 
                                  value={config.backBorderColor}
                                  onChange={(e) => setConfig(prev => ({ ...prev, backBorderColor: e.target.value }))}
                                  className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Fonte Verso ({config.backFontSize}pt)</label>
                                <input 
                                  type="range"
                                  min="6"
                                  max="14"
                                  step="0.5"
                                  value={config.backFontSize}
                                  onChange={(e) => setConfig(prev => ({ ...prev, backFontSize: parseFloat(e.target.value) }))}
                                  className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-600"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Opacidade Fundo ({Math.round(config.backOverlayOpacity * 100)}%)</label>
                                <input 
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={config.backOverlayOpacity}
                                  onChange={(e) => setConfig(prev => ({ ...prev, backOverlayOpacity: parseFloat(e.target.value) }))}
                                  className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-600"
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* Preview Column */}
                    <div className="w-[300px] shrink-0 flex flex-col min-h-0 overflow-hidden">
                      <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest border-b border-orange-100 dark:border-orange-900/30 pb-2 mb-4">Pré-visualização</h4>
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8 flex flex-col items-center">
                        {/* Front Preview */}
                        <div className="space-y-2 w-full">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Frente</p>
                          <div 
                            className="w-[180px] aspect-[54/86] mx-auto bg-white shadow-2xl relative overflow-hidden flex flex-col"
                            style={{ borderRadius: `${config.cornerRadius * 3}px` }}
                          >
                            {config.frontBg && <img src={config.frontBg} className="absolute inset-0 w-full h-full object-cover" alt="bg" />}
                            <div className="relative z-10 p-3 h-full flex flex-col items-center">
                              {churchLogos[0] && <img src={churchLogos[0]} className="w-8 h-8 mb-1 object-contain" alt="logo" />}
                              <p className="text-[6px] font-black text-center leading-tight mb-2" style={{ color: config.churchNameColor }}>
                                {(churchInfo.ministry || churchInfo.socialName || churchInfo.churchName || 'NOME DA IGREJA').toUpperCase()}
                              </p>
                              
                              {config.showPhoto && (
                                <div className="w-20 h-24 bg-slate-100/50 rounded-lg border border-slate-200/50 flex items-center justify-center mb-2">
                                  <User className="w-6 h-6 text-slate-400" />
                                </div>
                              )}

                              <div className="mt-auto w-full space-y-1.5 pb-1">
                                <div 
                                  className="p-1 px-2 h-7 rounded-md flex flex-col items-center justify-center" 
                                  style={{ backgroundColor: `${config.overlayColor}${Math.round(config.overlayOpacity * 255).toString(16).padStart(2, '0')}` }}
                                >
                                  <span className="text-[4px] font-bold opacity-70" style={{ color: config.labelColor }}>NOME</span>
                                  <span className="text-[7px] font-black whitespace-nowrap overflow-hidden" style={{ color: config.textColor }}>JOÃO DA SILVA</span>
                                </div>
                                <div 
                                  className="p-1 px-2 h-7 rounded-md flex flex-col items-center justify-center" 
                                  style={{ backgroundColor: `${config.overlayColor}${Math.round(config.overlayOpacity * 255).toString(16).padStart(2, '0')}` }}
                                >
                                  <span className="text-[4px] font-bold opacity-70" style={{ color: config.labelColor }}>CARGO</span>
                                  <span className="text-[6px] font-black" style={{ color: config.textColor, fontSize: `${(config.cargoFontSize / 8) * 6}px` }}>MEMBRO</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Back Preview */}
                        <div className="space-y-2 w-full">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Verso</p>
                          <div 
                            className="w-[180px] aspect-[54/86] mx-auto bg-white shadow-2xl relative overflow-hidden flex flex-col"
                            style={{ borderRadius: `${config.cornerRadius * 3}px` }}
                          >
                            {config.backBg && <img src={config.backBg} className="absolute inset-0 w-full h-full object-cover" alt="bg" />}
                            <div className="relative z-10 p-4 h-full flex flex-col">
                              <div className="space-y-1.5 pt-2">
                                {[1,2,3,4].map(i => (
                                  <div 
                                    key={i} 
                                    className="p-1 px-2 rounded-md flex justify-between items-center" 
                                    style={{ 
                                      backgroundColor: `${config.backOverlayColor}${Math.round(config.backOverlayOpacity * 255).toString(16).padStart(2, '0')}`,
                                      borderColor: config.backBorderColor,
                                      borderWidth: config.backBorderOpacity > 0 ? '0.5px' : '0'
                                    }}
                                  >
                                    <span className="text-[4px] font-bold" style={{ color: config.backLabelColor }}>CAMPO</span>
                                    <span className="text-[6px] font-black" style={{ color: config.backTextColor }}>DADO</span>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-auto flex flex-col items-center gap-1 pb-2">
                                {config.signatureUrl && <img src={config.signatureUrl} className="h-6 object-contain" alt="sign" />}
                                <div className="w-full border-t border-slate-300 mt-1" />
                                <p className="text-[6px] font-black mt-1 uppercase" style={{ color: config.backTextColor }}>{config.presidentName}</p>
                                <p className="text-[4px] font-bold opacity-60 uppercase" style={{ color: config.backTextColor }}>Pastor Presidente</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          localStorage.setItem('church_cracha_config_v2', JSON.stringify(config));
                          showSuccess("Modelo salvo com sucesso!");
                          setIsConfigOpen(false);
                        }}
                        className="mt-6 w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-600/20 text-xs uppercase tracking-widest"
                      >
                        <Save className="w-4 h-4" />
                        Salvar Modelo
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
