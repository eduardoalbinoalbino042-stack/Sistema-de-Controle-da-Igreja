import { useState, useRef, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Trash2, 
  Plus, 
  Download, 
  FileJson, 
  FileImage,
  FileText,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Users,
  Check,
  Search,
  Loader2,
  Save
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  getDay, 
  addMonths, 
  subMonths,
  getYear,
  getMonth
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../context/AuthContext';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { Member } from '../../../lib/member-types';
import { handleFirestoreError, OperationType } from '../../../lib/firestoreUtils';
import { showSuccess, showError } from '../../../lib/alerts';

interface Deacon {
  id: string;
  name: string;
}

interface ScaleItem {
  date: Date;
  deacon1: { id: string; name: string };
  deacon2: { id: string; name: string };
}

const DAYS_OF_WEEK = [
  { id: 0, label: 'Domingo' },
  { id: 1, label: 'Segunda' },
  { id: 2, label: 'Terça' },
  { id: 3, label: 'Quarta' },
  { id: 4, label: 'Quinta' },
  { id: 5, label: 'Sexta' },
  { id: 6, label: 'Sábado' },
];

export default function EscalaDiaconos() {
  const { user } = useAuth();
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 3, 6]); // Default: Sun, Wed, Sat
  const [availableMembers, setAvailableMembers] = useState<Member[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [memberSearch, setMemberSearch] = useState('');
  const [churchData, setChurchData] = useState<any>(null);
  
  const [manualDeacons, setManualDeacons] = useState<Deacon[]>([]);
  const [newDeaconName, setNewDeaconName] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [scale, setScale] = useState<ScaleItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const scaleRef = useRef<HTMLDivElement>(null);

  // Derived list of all deacons for the scale
  const deacons = [
    ...availableMembers
      .filter(m => selectedMemberIds.includes(m.id!))
      .map(m => ({ id: m.id!, name: m.nome })),
    ...manualDeacons
  ];

  // Auto-generate scale when settings and members are ready
  useEffect(() => {
    if (!isConfigLoading && !loadingMembers && deacons.length > 0 && selectedDays.length > 0 && scale.length === 0) {
      console.log('Dados prontos. Auto-gerando escala inicial...');
      generateScale();
    }
  }, [isConfigLoading, loadingMembers, deacons.length, selectedDays.length, scale.length]);

  // Load configuration from Firestore with real-time sync
  useEffect(() => {
    if (!user?.uid) {
      setIsConfigLoading(false);
      return;
    }

    const docRef = doc(db, 'scale_configurations', user.uid);
    setIsConfigLoading(true);

    // Initial load and real-time sync
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('Dados de escala recebidos do Firestore:', data);
        
        // Only update local state if we're not currently in the middle of a save operation
        // to avoid overwriting user's unsaved changes with older DB state
        if (data.selectedDays) setSelectedDays(data.selectedDays);
        if (data.selectedMemberIds) setSelectedMemberIds(data.selectedMemberIds);
        if (data.manualDeacons) setManualDeacons(data.manualDeacons);
      } else {
        console.log('Nenhuma configuração de escala encontrada para este usuário.');
      }
      setIsConfigLoading(false);
    }, (error) => {
      console.error('Erro ao sincronizar configuração de escala:', error);
      setIsConfigLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Fetch eligible members from Firestore
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'members'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Extended list of roles for better matching
      const eligibleRoles = [
        'diácono', 'diaconisa', 'cooperador', 'cooperadora', 
        'diacono', 'diaconiza', 'ajudante', 'liderança', 'ministro'
      ];
      
      const docs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as Member)
        .filter(m => {
          if (!m.cargo) return false;
          const cargoLower = m.cargo.toLowerCase();
          return eligibleRoles.some(role => cargoLower.includes(role));
        });
      
      setAvailableMembers(docs);
      setLoadingMembers(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
      setLoadingMembers(false);
    });

    // Fetch church data
    const churchRef = doc(db, 'church_data', user.uid);
    const unsubChurch = onSnapshot(churchRef, (docSnap) => {
      if (docSnap.exists()) {
        setChurchData(docSnap.data());
      }
    });

    return () => {
      unsubscribe();
      unsubChurch();
    };
  }, [user?.uid]);

  const toggleMemberSelection = (id: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  const addDeacon = () => {
    if (!newDeaconName.trim()) return;
    const newDeacon = {
      id: Math.random().toString(36).substr(2, 9),
      name: newDeaconName.trim()
    };
    setManualDeacons([...manualDeacons, newDeacon]);
    setNewDeaconName('');
  };

  const removeManualDeacon = (id: string) => {
    setManualDeacons(manualDeacons.filter(d => d.id !== id));
  };

  const saveConfiguration = async () => {
    if (!user) {
      showError('Sessão Inválida', 'Você precisa estar logado para salvar as configurações.');
      return;
    }
    
    setIsSaving(true);
    
    const payload = {
      selectedDays,
      selectedMemberIds,
      manualDeacons: manualDeacons.map(d => ({ id: d.id, name: d.name })),
      updatedAt: new Date().toISOString()
    };
    
    console.log('Persistindo configuração no Firestore para UID:', user.uid, payload);
    
    try {
      const docRef = doc(db, 'scale_configurations', user.uid);
      await setDoc(docRef, payload, { merge: true });
      console.log('Persistência concluída com sucesso!');
      showSuccess('Configuração Salva', 'Seus parâmetros de escala agora estão sincronizados na nuvem.');
    } catch (error) {
      console.error('Falha crítica ao salvar configuração:', error);
      handleFirestoreError(error, OperationType.WRITE, `scale_configurations/${user.uid}`);
      showError('Erro de Sincronização', 'Não foi possível salvar seus dados na nuvem. Verifique sua permissão ou conexão.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter(d => d !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const generateScale = () => {
    if (deacons.length === 0) return;
    if (selectedDays.length === 0) return;

    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    const days = eachDayOfInterval({ start, end });

    const filteredDays = days.filter(day => selectedDays.includes(getDay(day)));
    
    const newScale: ScaleItem[] = filteredDays.map((date, index) => {
      // Get two deacons for each day
      const d1Index = (index * 2) % deacons.length;
      const d2Index = (index * 2 + 1) % deacons.length;
      
      const deacon1 = deacons[d1Index];
      const deacon2 = deacons[d2Index] || deacons[0]; // Fallback if only 1 deacon exists

      return {
        date,
        deacon1: { id: deacon1.id, name: deacon1.name },
        deacon2: { id: deacon2.id, name: deacon2.name }
      };
    });

    setScale(newScale);
  };

  const [isExporting, setIsExporting] = useState(false);

  const exportJPG = async () => {
    if (!scaleRef.current || isExporting) return;
    setIsExporting(true);
    
    try {
      // Pequeno delay para garantir que o layout está estável
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const element = scaleRef.current;
      
      // Captura mais robusta ignorando o estado atual de scroll do usuário
      const canvas = await (html2canvas as any)(element, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY, // Compensa o scroll da página
        onclone: (clonedDoc: any) => {
          const el = clonedDoc.getElementById('scale-document');
          if (el) {
            el.style.margin = '0px';
            el.style.boxShadow = 'none';
            el.style.transform = 'none';
            el.style.position = 'relative';
            el.style.display = 'block';
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.href = imgData;
      const fileName = `escala-diaconos-${format(selectedMonth, 'MMMM-yyyy', { locale: ptBR })}.jpg`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showSuccess('Sucesso', 'Imagem da escala baixada.');
    } catch (error: any) {
      console.error('Erro detalhado na exportação JPG:', error);
      showError('Erro de Exportação', 'Não conseguimos gerar o JPG. Use o botão PDF como alternativa.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportPDF = () => {
    if (!scaleRef.current) return;
    
    // Using the same robust printable window logic as Certificado
    const printContent = scaleRef.current;
    const windowPrint = window.open('', '', 'width=1200,height=800');
    if (!windowPrint) {
      alert('Por favor, permita pop-ups para gerar o documento.');
      return;
    }

    const churchName = churchData?.socialName || 'Igreja';
    const monthYear = format(selectedMonth, 'MMMM-yyyy', { locale: ptBR });

    windowPrint.document.write(`
      <html>
        <head>
          <title>Escala de Diáconos - ${monthYear}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              @page { size: landscape; margin: 5mm; }
              body { margin: 0; -webkit-print-color-adjust: exact; }
              .scale-container { transform: scale(1); transform-origin: top center; width: 100%; }
            }
            body { 
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              background: white !important;
            }
            #scale-document {
              box-shadow: none !important;
              border: 1px solid #e2e8f0 !important;
              border-radius: 0 !important;
              width: 100% !important;
            }
          </style>
        </head>
        <body class="bg-white">
          <div class="scale-container mx-auto py-4 px-2">
            ${printContent.outerHTML}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 800);
            };
          </script>
        </body>
      </html>
    `);
    windowPrint.document.close();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20 relative scrollbar-hide">
      <AnimatePresence>
        {isConfigLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-3xl"
          >
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Carregando sua configuração...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Configuration Column */}
      <div className="lg:col-span-4 space-y-6">
        <section className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-500" />
            Configuração da Escala
          </h2>

          <div className="space-y-4">
            {/* Month/Year Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Mês e Ano</label>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </button>
                <div className="flex-1 text-center font-medium capitalize">
                  {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                </div>
                <button 
                  onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of Week */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Dias da Semana</label>
              </div>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.id}
                    onClick={() => toggleDay(day.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedDays.includes(day.id)
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deacon List Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex justify-between">
                Lideranças Disponíveis (Cadastro)
                <span className="text-xs text-slate-400 font-normal">{deacons.length} selecionados</span>
              </label>
              
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Filtrar por nome..."
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="max-h-60 overflow-auto scrollbar-hide border border-slate-100 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 mb-4">
                {loadingMembers ? (
                  <div className="p-8 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    <span className="text-xs text-slate-400">Buscando no cadastro...</span>
                  </div>
                ) : availableMembers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 italic">
                    Nenhum diácono/cooperador encontrado no cadastro.
                  </div>
                ) : (
                  availableMembers
                    .filter(m => m.nome.toLowerCase().includes(memberSearch.toLowerCase()))
                    .map((member) => (
                      <button
                        key={member.id}
                        onClick={() => toggleMemberSelection(member.id!)}
                        className={`w-full flex items-center justify-between p-2.5 text-left transition-colors group ${
                          selectedMemberIds.includes(member.id!) 
                            ? 'bg-indigo-50 dark:bg-indigo-500/10' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${selectedMemberIds.includes(member.id!) ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                            {member.nome}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{member.cargo}</span>
                        </div>
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                          selectedMemberIds.includes(member.id!)
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                        }`}>
                          {selectedMemberIds.includes(member.id!) && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </button>
                    ))
                )}
              </div>
            </div>

            {/* Manual Deacon Entry List */}
            {manualDeacons.length > 0 && (
              <div className="space-y-1 ring-1 ring-slate-100 dark:ring-slate-800 p-2 rounded-lg">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Adicionados Manualmente</span>
                {manualDeacons.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-2 text-xs bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{d.name}</span>
                    <button onClick={() => removeManualDeacon(d.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Manual Deacon Entry (Optional now but keeping it compact) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Adicionar Diácono Manualmente</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDeaconName}
                  onChange={(e) => setNewDeaconName(e.target.value)}
                  placeholder="Nome..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && addDeacon()}
                />
                <button 
                  onClick={addDeacon}
                  className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveConfiguration}
                disabled={isSaving}
                className="flex-1 py-3 bg-white dark:bg-slate-800 text-indigo-600 border border-indigo-200 dark:border-indigo-900/50 rounded-xl font-bold text-[10px] shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/10 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                title="Salvar esta configuração para uso futuro"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                SALVAR CONFIG.
              </button>
              <button
                onClick={generateScale}
                disabled={deacons.length === 0 || selectedDays.length === 0}
                className="flex-[1.5] py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CalendarIcon className="w-4 h-4" />
                CRIAR ESCALA
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Preview/Scale Column */}
      <div className="lg:col-span-8">
        {scale.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-12 bg-slate-50/50 dark:bg-slate-800/20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-full shadow-sm mb-4">
              <CalendarIcon className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300">Nenhuma escala gerada</h3>
            <p className="text-sm text-center max-w-xs mt-1">Configure os diáconos e dias da semana ao lado para gerar a escala mensal.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 mb-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-none mb-1">Visualização da Escala</h3>
                <p className="text-[10px] text-slate-500 italic">Dica: A escala será exportada com o design abaixo.</p>
              </div>
              <div className="flex items-center gap-2">
                <AnimatePresence>
                  {isExporting && (
                    <motion.span 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-[10px] font-bold text-indigo-500 animate-pulse mr-2"
                    >
                      Exportando...
                    </motion.span>
                  )}
                </AnimatePresence>
                <button
                  onClick={exportJPG}
                  disabled={isExporting}
                  className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-black transition-all disabled:opacity-50 shadow-sm active:scale-95"
                  title="Exportar como Imagem"
                >
                  {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <FileImage className="w-3.5 h-3.5 text-orange-500" />}
                  JPG
                </button>
                <button
                  onClick={exportPDF}
                  disabled={isExporting}
                  className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-black transition-all disabled:opacity-50 shadow-sm active:scale-95"
                  title="Imprimir ou Salvar PDF"
                >
                  {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <FileText className="w-3.5 h-3.5 text-red-500" />}
                  PDF
                </button>
              </div>
            </div>

            {/* Scale Document Preview */}
            <div id="scale-document" className="bg-white px-4 py-6 mx-auto max-w-[1000px] text-[#000000]" ref={scaleRef}>
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold font-serif underline decoration-1 underline-offset-4">
                  Escala do Mês de {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                </h2>
              </div>

              <div className="overflow-hidden border border-slate-300">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#235d91] text-white">
                      <th className="py-2 px-4 text-left text-sm font-medium border-r border-[#235d91]">Data</th>
                      <th className="py-2 px-4 text-left text-sm font-medium border-r border-[#235d91]">Dia da Semana</th>
                      <th className="py-2 px-4 text-left text-sm font-medium border-r border-[#235d91]">Porta 1</th>
                      <th className="py-2 px-4 text-left text-sm font-medium">Porta 2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {scale.map((item, index) => {
                      const isSunday = getDay(item.date) === 0;
                      return (
                        <tr key={index} className={isSunday ? 'bg-[#f5cbae]' : 'bg-white'}>
                          <td className="py-1.5 px-4 text-sm border-r border-slate-200">{format(item.date, 'dd/MM/yyyy')}</td>
                          <td className="py-1.5 px-4 text-sm capitalize border-r border-slate-200">{format(item.date, 'EEEE', { locale: ptBR })}</td>
                          <td className="py-1.5 px-4 text-sm border-r border-slate-200">{item.deacon1.name}</td>
                          <td className="py-1.5 px-4 text-sm">{item.deacon2.name}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
