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
  Save
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

interface CredencialConfig {
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

export default function Credencial() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'front' | 'back'>('front');
  const [churchInfo, setChurchInfo] = useState<any>({});
  const [churchLogos, setChurchLogos] = useState<string[]>([]);

  const [config, setConfig] = useState<CredencialConfig>(() => {
    const saved = localStorage.getItem('church_credencial_config');
    const defaultVals = {
      frontBg: '',
      backBg: '',
      textColor: '#000000',
      churchNameColor: '#1e3a8a',
      labelColor: '#475569',
      fontSize: 10,
      showPhoto: true,
      validityYears: 2,
      presidentName: 'Eduardo Albino',
      overlayOpacity: 0.6,
      overlayColor: '#ffffff',
      cornerRadius: 2,
      signatureUrl: '',
      // Back defaults
      backTextColor: '#000000',
      backLabelColor: '#000000',
      backFontSize: 11,
      backOverlayColor: '#f8fafc',
      backOverlayOpacity: 1,
      backBorderColor: '#e2e8f0',
      backBorderOpacity: 1
    };

    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultVals, ...parsed };
    }
    return defaultVals;
  });

  useEffect(() => {
    localStorage.setItem('church_credencial_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    if (!user) return;

    // Fetch members
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

    // Fetch church info for header
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

      // Vertical layout: 5 cards per page
      const scale = 1.05;
      const fontScale = (config.fontSize / 10) * scale;
      const cardW = 86 * scale;
      const cardH = 54 * scale;
      const cornerRadius = config.cornerRadius * scale;
      const colGap = 5 * scale; // Spacing between front and back
      const marginX = (210 - (cardW * 2 + colGap)) / 2; // Centers horizontally
      
      // Vertical distribution: 297mm total height, 5 cards.
      // Total cards height = 5 * cardH
      // Remaining space = 297 - (5 * cardH)
      // We divide this space by 6 to have equal margins at top/bottom and between cards.
      const totalSpaceHeight = 297 - (5 * cardH);
      const spaceSegment = totalSpaceHeight / 6;
      const marginY = spaceSegment;
      const rowGap = spaceSegment;

      selectedData.forEach((member, index) => {
        const pageIndex = Math.floor(index / 5);
        const slotInPage = index % 5;
        
        if (index > 0 && slotInPage === 0) {
          doc.addPage();
        }

        const y = marginY + (slotInPage * (cardH + rowGap));
        const xFront = marginX;
        const xBack = marginX + cardW + colGap;

        // --- FRONT ---
        // Clip rounded corners for background
        doc.saveGraphicsState();
        
        // Background with rounded corners
        if (config.frontBg) {
          doc.roundedRect(xFront, y, cardW, cardH, cornerRadius, cornerRadius, 'F'); // Invisible base
          doc.clip();
          doc.addImage(config.frontBg, 'JPEG', xFront, y, cardW, cardH);
        } else {
          doc.setDrawColor(200);
          doc.roundedRect(xFront, y, cardW, cardH, cornerRadius, cornerRadius, 'D');
        }
        doc.restoreGraphicsState();

        // Logo
        if (logo) {
          doc.addImage(logo, 'PNG', xFront + (5 * scale), y + (5 * scale), 12 * scale, 12 * scale);
        }

        // Church Name
        doc.setFontSize(7 * fontScale);
        doc.setTextColor(config.churchNameColor);
        doc.setFont('helvetica', 'bold');
        const churchName = (churchInfo.socialName || churchInfo.churchName || 'Igreja Assembleia de Deus').toUpperCase();
        doc.text(churchName, xFront + (20 * scale), y + (9 * scale), { maxWidth: cardW - (40 * scale) });

        // Member Photo
        if (config.showPhoto && member.fotoUrl) {
          try {
            const photoW = 18 * scale;
            const photoH = 22 * scale;
            const photoX = xFront + cardW - (24 * scale);
            const photoY = y + (12 * scale);
            
            doc.saveGraphicsState();
            doc.roundedRect(photoX, photoY, photoW, photoH, 0.5 * scale, 0.5 * scale, 'F');
            doc.clip();
            doc.addImage(member.fotoUrl, 'JPEG', photoX, photoY, photoW, photoH);
            doc.restoreGraphicsState();
          } catch (e) {
            doc.setDrawColor(230);
            doc.roundedRect(xFront + cardW - (24 * scale), y + (12 * scale), 18 * scale, 22 * scale, 0.5 * scale, 0.5 * scale, 'D');
          }
        }

        // Overlay for Data Fields
        const drawOverlay = (ox: number, oy: number, ow: number, oh: number) => {
          try {
            doc.saveGraphicsState();
            // @ts-ignore - GState might be on jsPDF or constructor
            const GState = (doc as any).GState || (jsPDF as any).GState;
            if (GState) {
              const gState = new GState({ opacity: config.overlayOpacity });
              doc.setGState(gState);
            }
            doc.setFillColor(config.overlayColor);
            doc.roundedRect(ox, oy, ow, oh, config.cornerRadius * 0.3 * scale, config.cornerRadius * 0.3 * scale, 'F');
            doc.restoreGraphicsState();
          } catch (e) {
            // Fallback if GState fails
            doc.setFillColor(config.overlayColor);
            doc.roundedRect(ox, oy, ow, oh, config.cornerRadius * 0.3 * scale, config.cornerRadius * 0.3 * scale, 'F');
          }
        };

        // ID Overlay & Label - MOVED TO HORIZONTAL CENTER
        const idBoxW = 18 * scale;
        const idBoxX = xFront + (cardW / 2) - (idBoxW / 2);
        const idBoxY = y + (31 * scale); 
        
        drawOverlay(idBoxX, idBoxY, idBoxW, 5 * scale);
        doc.setFontSize(5 * fontScale);
        doc.setTextColor(config.labelColor);
        doc.setFont('helvetica', 'normal');
        doc.text("Membro Nº", idBoxX + scale, idBoxY - (0.5 * scale));
        
        doc.setFontSize(7 * fontScale);
        doc.setTextColor(config.textColor);
        doc.setFont('helvetica', 'bold');
        doc.text(String(member.idPlanilha || '000').padStart(4, '0'), idBoxX + (idBoxW / 2), idBoxY + (3.5 * scale), { align: 'center' });

        // Name Overlay & Label
        drawOverlay(xFront + (5 * scale), y + (37 * scale), cardW - (10 * scale), 6 * scale);
        doc.setFontSize(5 * fontScale);
        doc.setTextColor(config.labelColor);
        doc.setFont('helvetica', 'normal');
        doc.text("NOME", xFront + (6 * scale), y + (36.5 * scale));
        
        doc.setFontSize(8 * fontScale);
        doc.setTextColor(config.textColor);
        doc.setFont('helvetica', 'bold');
        doc.text(member.nome.toUpperCase(), xFront + (7 * scale), y + (41.5 * scale));

        // Cargo Overlay & Label
        drawOverlay(xFront + (5 * scale), y + (45 * scale), cardW - (10 * scale), 5 * scale);
        doc.setFontSize(5 * fontScale);
        doc.setTextColor(config.labelColor);
        doc.setFont('helvetica', 'normal');
        doc.text("CARGO", xFront + (6 * scale), y + (44.5 * scale));
        
        doc.setFontSize(7 * fontScale);
        doc.setTextColor(config.textColor);
        doc.setFont('helvetica', 'bold');
        doc.text((member.cargo || 'Membro').toUpperCase(), xFront + (7 * scale), y + (49 * scale));


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

        doc.setFontSize(6 * fontScale);
        doc.setTextColor(config.labelColor);
        doc.setFont('helvetica', 'normal');

        const detailsX = xBack + (5 * scale);
        const fieldH = 5.2 * scale; // Increased by ~2px (0.7mm)
        const startDetailY = y + (8 * scale);

        const drawField = (label: string, value: string, fy: number) => {
          doc.saveGraphicsState();
          
          // Background Overlay with transparency
          try {
            // @ts-ignore
            const GState = (doc as any).GState || (jsPDF as any).GState;
            if (GState) {
              const gs = new GState({ opacity: config.backOverlayOpacity });
              doc.setGState(gs);
            }
            doc.setFillColor(config.backOverlayColor);
            doc.roundedRect(detailsX, fy, cardW - (10 * scale), fieldH, scale, scale, 'F');
          } catch (e) {
            doc.setFillColor(config.backOverlayColor);
            doc.roundedRect(detailsX, fy, cardW - (10 * scale), fieldH, scale, scale, 'F');
          }
          doc.restoreGraphicsState();

          // Border with transparency
          doc.saveGraphicsState();
          try {
            // @ts-ignore
            const GState = (doc as any).GState || (jsPDF as any).GState;
            if (GState) {
              const gs = new GState({ opacity: config.backBorderOpacity });
              doc.setGState(gs);
            }
            doc.setDrawColor(config.backBorderColor);
            doc.setLineWidth(0.1);
            doc.roundedRect(detailsX, fy, cardW - (10 * scale), fieldH, scale, scale, 'S');
          } catch (e) {
            doc.setDrawColor(config.backBorderColor);
            doc.roundedRect(detailsX, fy, cardW - (10 * scale), fieldH, scale, scale, 'S');
          }
          doc.restoreGraphicsState();
          
          doc.setFontSize((config.backFontSize / 1.33) * scale); // Convert px to pt approx and scale
          doc.setTextColor(config.backLabelColor);
          doc.setFont('helvetica', 'normal');
          doc.text(label, detailsX + (2 * scale), fy + (3.2 * scale + (0.35 * scale))); 

          doc.setFontSize((config.backFontSize / 1.33) * scale);
          doc.setTextColor(config.backTextColor);
          doc.setFont('helvetica', 'bold');
          doc.text(value, xBack + cardW - (7 * scale), fy + (3.2 * scale + (0.35 * scale)), { align: 'right' });
        };

        drawField("RG", member.rg || '---', startDetailY);
        drawField("Data de Nascimento", member.dataNascimento ? format(parseISO(member.dataNascimento), 'dd/MM/yyyy') : '---', startDetailY + fieldH + scale);
        drawField("Membro desde", member.dataRecebimento ? format(parseISO(member.dataRecebimento), 'dd/MM/yyyy') : '---', startDetailY + (fieldH + scale) * 2);
        drawField("Data de Validade", format(new Date(new Date().getFullYear() + config.validityYears, 11, 31), 'dd/MM/yyyy'), startDetailY + (fieldH + scale) * 3);

        // Signature area
        if (config.signatureUrl) {
          try {
            doc.addImage(config.signatureUrl, 'PNG', xBack + (cardW / 2) - (15 * scale), y + (33 * scale), 30 * scale, 8 * scale);
          } catch (e) {
            console.error("Erro ao adicionar assinatura:", e);
          }
        }
        doc.setDrawColor(config.backTextColor);
        doc.line(xBack + (15 * scale), y + (41 * scale), xBack + cardW - (15 * scale), y + (41 * scale));
        
        const backFontScale = (config.backFontSize / 11) * scale;
        doc.setFontSize(5 * backFontScale);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(config.backTextColor);
        doc.text(config.presidentName, xBack + cardW/2, y + (44 * scale), { align: 'center' });
        doc.text("Pastor Presidente", xBack + cardW/2, y + (47 * scale), { align: 'center' });

        // Address
        doc.setFontSize(5 * fontScale);
        doc.setTextColor('#000000');
        const addr = `${churchInfo.address || ''}, ${churchInfo.number || ''} ${churchInfo.neighborhood || ''} - ${churchInfo.city || ''}/${churchInfo.state || ''}`;
        doc.text(addr, xBack + cardW/2, y + (49 * scale), { align: 'center', maxWidth: cardW - (10 * scale) });
      });

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      showSuccess("Credenciais geradas com sucesso!");
    } catch (e) {
      console.error(e);
      showError("Erro ao gerar PDF", "Ocorreu um problema ao gerar o arquivo das credenciais.");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-transparent overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-8 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Contact className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Emissor de Credenciais</h2>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Imprima identificações oficiais para seus membros</p>
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
            className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 text-sm"
          >
            <Printer className="w-5 h-5" />
            Imprimir Selecionadas ({selectedMembers.length})
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
                placeholder="Buscar membro por nome ou cargo..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
              />
            </div>
            <button 
              onClick={handleSelectAll}
              className="text-xs font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-600 transition-colors"
            >
              {selectedMembers.length === filteredMembers.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                <p className="text-slate-500 font-medium">Carregando membros...</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <User className="w-12 h-12 text-slate-200 dark:text-slate-800 mb-2" />
                <p className="text-slate-400 font-bold">Nenhum membro encontrado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredMembers.map(member => (
                  <label 
                    key={member.id}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer group ${
                      selectedMembers.includes(member.id!) 
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 shadow-md' 
                        : 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800/50 hover:border-indigo-200 dark:hover:border-indigo-500/30'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={selectedMembers.includes(member.id!)}
                      onChange={() => handleToggleSelect(member.id!)}
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-bold text-indigo-500 border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0 transition-transform group-hover:scale-105">
                        {member.fotoUrl ? (
                          <img src={member.fotoUrl} alt={member.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : member.nome.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">{member.nome}</p>
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter truncate">{member.cargo || 'Membro'}</p>
                      </div>
                      {selectedMembers.includes(member.id!) && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-white scale-110 shadow-lg">
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
                      <div className="p-2 bg-indigo-500/10 rounded-xl">
                        <Palette className="w-5 h-5 text-indigo-500" />
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
                              ? 'bg-white dark:bg-slate-700 text-indigo-500 shadow-sm' 
                              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                          }`}
                        >
                          Configuração Frente
                        </button>
                        <button 
                          onClick={() => setActiveTab('back')}
                          className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                            activeTab === 'back' 
                              ? 'bg-white dark:bg-slate-700 text-indigo-500 shadow-sm' 
                              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                          }`}
                        >
                          Configuração Verso
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                        {/* Configurações Gerais - Always visible at top */}
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest border-b border-indigo-100 dark:border-indigo-900/30 pb-2">Configurações Gerais</h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Anos Validade</label>
                              <input 
                                type="number"
                                value={config.validityYears}
                                onChange={(e) => setConfig(prev => ({ ...prev, validityYears: parseInt(e.target.value) }))}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold"
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
                                className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Nome do Presidente (Verso)</label>
                            <input 
                              type="text"
                              value={config.presidentName}
                              onChange={(e) => setConfig(prev => ({ ...prev, presidentName: e.target.value }))}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold"
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
                            <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest border-b border-indigo-100 dark:border-indigo-900/30 pb-2">Configurações da Frente</h4>
                            
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
                                      <span className="text-[9px] font-bold text-slate-400 uppercase">Upload Frente</span>
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
                                    className="w-3.5 h-3.5 rounded text-indigo-500"
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
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Fonte ({config.fontSize}pt)</label>
                                <input 
                                  type="range"
                                  min="6"
                                  max="18"
                                  step="0.5"
                                  value={config.fontSize}
                                  onChange={(e) => setConfig(prev => ({ ...prev, fontSize: parseFloat(e.target.value) }))}
                                  className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Opacidade ({Math.round(config.overlayOpacity * 100)}%)</label>
                                <input 
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.1"
                                  value={config.overlayOpacity}
                                  onChange={(e) => setConfig(prev => ({ ...prev, overlayOpacity: parseFloat(e.target.value) }))}
                                  className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
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
                            <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest border-b border-indigo-100 dark:border-indigo-900/30 pb-2">Configurações do Verso</h4>
                            
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
                                      <span className="text-[9px] font-bold text-slate-400 uppercase">Upload Verso</span>
                                      <input type="file" className="hidden" accept="image/*" onChange={handleBgUpload('back')} />
                                    </label>
                                  )}
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Fonte ({config.backFontSize}px)</label>
                                <input 
                                  type="range"
                                  min="8"
                                  max="20"
                                  step="1"
                                  value={config.backFontSize}
                                  onChange={(e) => setConfig(prev => ({ ...prev, backFontSize: parseInt(e.target.value) }))}
                                  className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-600 uppercase">Cor Títulos</label>
                                <input 
                                  type="color" 
                                  value={config.backLabelColor}
                                  onChange={(e) => setConfig(prev => ({ ...prev, backLabelColor: e.target.value }))}
                                  className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                                />
                              </div>
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-600 uppercase">Cor Dados</label>
                                <input 
                                  type="color" 
                                  value={config.backTextColor}
                                  onChange={(e) => setConfig(prev => ({ ...prev, backTextColor: e.target.value }))}
                                  className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-600 uppercase">Cor Fundo</label>
                                <input 
                                  type="color" 
                                  value={config.backOverlayColor}
                                  onChange={(e) => setConfig(prev => ({ ...prev, backOverlayColor: e.target.value }))}
                                  className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                                />
                              </div>
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-600 uppercase">Cor Borda</label>
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
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Opacidade Fundo ({Math.round(config.backOverlayOpacity * 100)}%)</label>
                                <input 
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.1"
                                  value={config.backOverlayOpacity}
                                  onChange={(e) => setConfig(prev => ({ ...prev, backOverlayOpacity: parseFloat(e.target.value) }))}
                                  className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Opacidade Borda ({Math.round(config.backBorderOpacity * 100)}%)</label>
                                <input 
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.1"
                                  value={config.backBorderOpacity}
                                  onChange={(e) => setConfig(prev => ({ ...prev, backBorderOpacity: parseFloat(e.target.value) }))}
                                  className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tight">Assinatura (PNG)</label>
                                <div className="relative h-10 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden group">
                                  {config.signatureUrl ? (
                                    <>
                                      <img src={config.signatureUrl} className="h-full object-contain" alt="Signature Preview" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <label className="cursor-pointer bg-white text-slate-800 px-3 py-1 rounded-full text-[8px] font-black uppercase shadow-lg transition-all">
                                          Trocar
                                          <input type="file" className="hidden" accept="image/png" onChange={handleBgUpload('signature')} />
                                        </label>
                                      </div>
                                    </>
                                  ) : (
                                    <label className="cursor-pointer flex flex-col items-center gap-1">
                                      <Upload className="w-3 h-3 text-slate-300" />
                                      <span className="text-[8px] font-bold text-slate-400 uppercase">Upload Assinatura</span>
                                      <input type="file" className="hidden" accept="image/png" onChange={handleBgUpload('signature')} />
                                    </label>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    <div className="w-[340px] shrink-0 space-y-6">
                      <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest border-b border-indigo-100 dark:border-indigo-900/30 pb-2">Pré-visualização</h4>
                      
                      <div className="space-y-4">
                        {/* Front Preview Card */}
                        <div className="space-y-2">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Frente</span>
                           <div 
                             className="relative aspect-[86/54] shadow-xl border border-slate-200 dark:border-slate-800 bg-white overflow-hidden transition-all duration-300"
                             style={{ borderRadius: `${config.cornerRadius * 3.95}px` }}
                           >
                             {config.frontBg && <img src={config.frontBg} className="absolute inset-0 w-full h-full object-cover" alt="" />}
                             
                             {/* Preview Content Mask */}
                             <div className="absolute inset-0 p-[5mm] flex flex-col pointer-events-none">
                               <div className="flex items-start gap-[2mm]">
                                 <div className="w-[10mm] h-[10mm] bg-slate-200 rounded-lg overflow-hidden shrink-0">
                                   {churchLogos[0] && <img src={churchLogos[0]} className="w-full h-full object-contain" alt="" />}
                                 </div>
                                 <div 
                                   className="font-bold leading-tight uppercase"
                                   style={{ 
                                     fontSize: `${(7 * config.fontSize) / 10}pt`, 
                                     color: config.churchNameColor 
                                   }}
                                 >
                                    {(churchInfo.churchName || 'NOME DA IGREJA').toUpperCase()}
                                 </div>
                               </div>

                               {config.showPhoto && (
                                <div 
                                  className="absolute top-[12mm] right-[6mm] w-[18mm] h-[22mm] bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden"
                                >
                                   <User className="w-8 h-8 text-slate-300" />
                                </div>
                               )}

                               <div className="mt-auto space-y-[2mm]">
                                 {/* ID */}
                                 <div className="flex justify-center">
                                    <div 
                                      className="px-2 py-0.5 rounded flex flex-col items-center"
                                      style={{ 
                                        backgroundColor: `${config.overlayColor}${Math.round(config.overlayOpacity * 255).toString(16).padStart(2, '0')}`,
                                        backdropFilter: 'blur(2px)'
                                      }}
                                    >
                                      <span style={{ fontSize: `${(5 * config.fontSize) / 10}pt`, color: config.labelColor }}>Membro Nº</span>
                                      <span style={{ fontSize: `${(7 * config.fontSize) / 10}pt`, color: config.textColor }} className="font-bold">0042</span>
                                    </div>
                                 </div>

                                 {/* Name */}
                                 <div 
                                   className="p-1 rounded"
                                   style={{ 
                                     backgroundColor: `${config.overlayColor}${Math.round(config.overlayOpacity * 255).toString(16).padStart(2, '0')}`
                                   }}
                                 >
                                   <div style={{ fontSize: `${(5 * config.fontSize) / 10}pt`, color: config.labelColor }}>NOME</div>
                                   <div style={{ fontSize: `${(8 * config.fontSize) / 10}pt`, color: config.textColor }} className="font-bold">MEMBRO DE EXEMPLO</div>
                                 </div>

                                 {/* Cargo */}
                                 <div 
                                   className="p-1 rounded w-3/4"
                                   style={{ 
                                     backgroundColor: `${config.overlayColor}${Math.round(config.overlayOpacity * 255).toString(16).padStart(2, '0')}`
                                   }}
                                 >
                                   <div style={{ fontSize: `${(5 * config.fontSize) / 10}pt`, color: config.labelColor }}>CARGO</div>
                                   <div style={{ fontSize: `${(7 * config.fontSize) / 10}pt`, color: config.textColor }} className="font-bold uppercase">DIÁCONO</div>
                                 </div>
                               </div>
                             </div>
                           </div>
                        </div>

                        {/* Back Preview Card */}
                        <div className="space-y-2">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Verso</span>
                           <div 
                             className="relative aspect-[86/54] shadow-xl border border-slate-200 dark:border-slate-800 bg-white overflow-hidden"
                             style={{ borderRadius: `${config.cornerRadius * 3.95}px` }}
                           >
                             {config.backBg && <img src={config.backBg} className="absolute inset-0 w-full h-full object-cover" alt="" />}
                             
                             <div className="absolute inset-0 p-[5mm] flex flex-col pointer-events-none">
                               <div className="space-y-[1.5mm]">
                                 {[1, 2, 3, 4].map(i => (
                                   <div 
                                     key={i}
                                     className="p-1 px-2 rounded border flex justify-between items-center h-[6mm]"
                                     style={{ 
                                        backgroundColor: `${config.backOverlayColor}${Math.round(config.backOverlayOpacity * 255).toString(16).padStart(2, '0')}`,
                                        borderColor: `${config.backBorderColor}${Math.round(config.backBorderOpacity * 255).toString(16).padStart(2, '0')}`
                                     }}
                                   >
                                     <div style={{ fontSize: `${config.backFontSize}px`, color: config.backLabelColor }}>CAMPO {i}</div>
                                     <div style={{ fontSize: `${config.backFontSize}px`, color: config.backTextColor }} className="font-bold uppercase">VALOR EXEMPLO</div>
                                   </div>
                                 ))}
                               </div>

                               <div className="mt-auto flex flex-col items-center">
                                 {config.signatureUrl && (
                                   <div className="h-[8mm] w-1/2 flex items-center justify-center mb-[-2mm]">
                                     <img src={config.signatureUrl} className="h-full object-contain" alt="" />
                                   </div>
                                 )}
                                 <div 
                                   className="w-1/2 h-[0.5pt] mb-1" 
                                   style={{ backgroundColor: config.backTextColor }}
                                 />
                                 <div style={{ fontSize: `${(5 * config.backFontSize) / 11}pt`, color: config.backTextColor }}>{config.presidentName}</div>
                                 <div style={{ fontSize: `${(4 * config.backFontSize) / 11}pt`, color: config.backTextColor }} className="opacity-60 uppercase">Pastor Presidente</div>
                               </div>
                             </div>
                           </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          localStorage.setItem('church_credencial_config', JSON.stringify(config));
                          showSuccess("Configurações salvas!");
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 active:scale-95"
                      >
                        <Save className="w-5 h-5" />
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
