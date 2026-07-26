import React, { useState, useEffect, useRef } from 'react';
import { 
  Award, 
  Printer, 
  Settings2, 
  Type, 
  Image as ImageIcon,
  User,
  Calendar,
  Search,
  Check,
  ChevronRight,
  Palette,
  FileText,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../../lib/firebase';
import { collection, query, onSnapshot, getDocs, doc, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface CertificateConfig {
  fontFamily: string;
  fontSizeTitle: number;
  fontSizeBody: number;
  fontColor: string;
  backgroundImage: string;
  showBorder: boolean;
  borderColor: string;
  signature1Label: string;
  signature2Label: string;
  offsetX: number;
  offsetY: number;
}

const FONT_OPTIONS = [
  { id: 'serif', name: 'Serif (Clássico)', value: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
  { id: 'sans', name: 'Sans (Moderno)', value: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { id: 'mono', name: 'Mono (Técnico)', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' },
  { id: 'great-vibes', name: 'Great Vibes (Cursiva)', value: '"Great Vibes", cursive' },
  { id: 'cinzel', name: 'Cinzel (Decorativo)', value: '"Cinzel", serif' },
  { id: 'playfair', name: 'Playfair (Elegante)', value: '"Playfair Display", serif' },
];

const CATEGORIES = [
  { 
    id: 'apresentacao', 
    name: 'Apresentação de Bebê',
    icon: User,
    defaultTitle: 'Certificado de Apresentação',
    defaultBody: 'Pelo presente certificado, fazemos saber que [NOME], nascido(a) em [DATA_NASC], filho(a) de [PAIS], foi apresentado(a) ao Senhor Deus, em conformidade com as Sagradas Escrituras, para receber a bênção divina e a dedicação de sua vida ao serviço cristão.',
    defaultFooter: '"Ensina a criança no caminho em que deve andar, e, ainda quando estiver velho, não se desviará dele." - Provérbios 22:6',
    fields: ['dataNasc', 'pais']
  },
  { 
    id: 'batismo', 
    name: 'Batismo nas Águas',
    icon: Award,
    defaultTitle: 'Certificado de Batismo',
    defaultBody: 'Certificamos que [NOME], tendo professado sua fé pública no Senhor Jesus Cristo como seu único e suficiente Salvador, foi batizado(a) nas águas em nome do Pai, do Filho e do Espírito Santo, em cumprimento ao ordenamento bíblico.',
    defaultFooter: '"Quem crer e for batizado será salvo." - Marcos 16:16',
    fields: []
  },
  { 
    id: 'obreiro', 
    name: 'Consagração de Obreiro',
    icon: Award,
    defaultTitle: 'Certificado de Consagração',
    defaultBody: 'Certificamos que [NOME] foi devidamente consagrado(a) ao cargo de [CARGO] nesta instituição religiosa, após ter demonstrado chamado ministerial, fidelidade doutrinária e testemunho cristão íntegro para o exercício do santo ministério.',
    defaultFooter: '"Procura apresentar-te a Deus aprovado, como obreiro que não tem de que se envergonhar." - 2 Timóteo 2:15',
    fields: ['cargo']
  },
  { 
    id: 'curso', 
    name: 'Cursos e Seminários',
    icon: Award,
    defaultTitle: 'Certificado de Conclusão',
    defaultBody: 'Certificamos que [NOME] concluiu com aproveitamento o curso de [CURSO], realizado no período de [PERIODO], com carga horária total de [CARGA_HORARIA], cumprindo todos os requisitos acadêmicos e práticos exigidos.',
    defaultFooter: 'Aperfeiçoando os santos para a obra do ministério.',
    fields: ['curso', 'periodo', 'cargaHoraria']
  },
];

export default function Certificado() {
  const { user } = useAuth();
  const [churchData, setChurchData] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [manualName, setManualName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // State for variables/placeholders
  const [vars, setVars] = useState({
    cargo: '',
    dataNasc: '',
    pais: '',
    curso: '',
    periodo: '',
    cargaHoraria: '',
  });

  // State for config
  const [config, setConfig] = useState<CertificateConfig>({
    fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    fontSizeTitle: 40,
    fontSizeBody: 18,
    fontColor: '#000000',
    backgroundImage: '',
    showBorder: false,
    borderColor: '#B8860B',
    signature1Label: 'Pastor Presidente',
    signature2Label: 'Secretário(a)',
    offsetX: 0,
    offsetY: 0,
  });

  // State for text content
  const [content, setContent] = useState({
    title: category.defaultTitle,
    body: category.defaultBody,
    footer: category.defaultFooter,
    date: new Date().toLocaleDateString('pt-BR'),
    location: '',
  });

  const certificateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    // Load church data
    if (!user) return;
    const churchRef = doc(db, 'church_data', user.uid);
    const unsubChurch = onSnapshot(churchRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChurchData(data);
        setContent(prev => ({ 
          ...prev, 
          location: data.city || prev.location 
        }));
      }
    });

    // Load members
    const membersQuery = query(collection(db, 'members'), where('userId', '==', user.uid));
    getDocs(membersQuery).then((snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('Members found:', docs.length);
      setMembers(docs);
      setLoading(false);
    }).catch(err => {
      console.error('Error loading members:', err);
      setLoading(false);
    });

    return () => unsubChurch();
  }, [user]);

  useEffect(() => {
    // Reset defaults when category changes
    setContent(prev => ({
      ...prev,
      title: category.defaultTitle,
      body: category.defaultBody,
      footer: category.defaultFooter
    }));
  }, [category]);

  const handleAISuggest = async () => {
    if (!process.env.GEMINI_API_KEY) {
      alert('Configuração de IA não disponível.');
      return;
    }

    try {
      setIsGenerating(true);
      
      const prompt = `Atuação: Você é um especialista em design de documentos eclesiásticos e acadêmicos. 
      Sua função é gerar o conteúdo textual solene para um certificado.
      
      Categoria: ${category.name}
      Membro selecionado: ${selectedMember?.nome || 'NOME_EXEMPLO'}
      Igreja: ${churchData?.socialName || 'Igreja Evangélica'}
      
      Instruções:
      1. Retorne um texto solene, bíblico e profissional.
      2. Use placeholders [NOME], [CARGO], [DATA_NASC], [PAIS] se aplicável.
      3. O resultado deve ser apenas o corpo do texto, sem introduções.
      
      Estrutura esperada: O texto deve ser formal e adequado para a categoria ${category.id}.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      
      const text = response.text;
      
      if (text) {
        setContent(prev => ({ ...prev, body: text.trim() }));
      }
    } catch (error) {
      console.error('Erro na IA:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const replacePlaceholders = (text: string) => {
    let result = text;
    // Prioritize manual name over selected member
    const targetName = manualName || selectedMember?.nome || '________________________';
    
    result = result.replace(/\[NOME\]/g, targetName);
    
    // Use manual vars if present, otherwise member data or default placeholders
    const targetCargo = vars.cargo || selectedMember?.cargo || '________________________';
    const targetDataNasc = vars.dataNasc || selectedMember?.dataNascimento || '__/__/____';
    
    let parents = vars.pais;
    if (!parents && selectedMember) {
      parents = `${selectedMember.nomePai || '________________'} e ${selectedMember.nomeMae || '________________'}`;
    }
    if (!parents) parents = '________________ e ________________';

    result = result.replace(/\[CARGO\]/g, targetCargo);
    result = result.replace(/\[DATA_NASC\]/g, targetDataNasc);
    result = result.replace(/\[PAIS\]/g, parents);
    
    // Generic placeholders from vars
    result = result.replace(/\[DATA\]/g, content.date);
    result = result.replace(/\[LÍDER\]/g, churchData?.pastorPresident || 'Pastor Presidente');
    result = result.replace(/\[CURSO\]/g, vars.curso || 'Nome do Curso');
    result = result.replace(/\[PERIODO\]/g, vars.periodo || 'Data de Início a Data de Fim');
    result = result.replace(/\[CARGA_HORARIA\]/g, vars.cargaHoraria || 'XX Horas');
    
    return result;
  };

  const handlePrint = () => {
    const printContent = certificateRef.current;
    if (!printContent) return;

    const windowPrint = window.open('', '', 'width=1200,height=800');
    if (!windowPrint) return;

    windowPrint.document.write(`
      <html>
        <head>
          <title>Certificado - ${manualName || selectedMember?.nome || 'Impressão'}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Cinzel:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;700&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              @page { size: landscape; margin: 0; }
              body { margin: 0; -webkit-print-color-adjust: exact; }
            }
            body { font-family: 'Inter', sans-serif; }
          </style>
        </head>
        <body class="bg-white">
          <div class="w-[297mm] h-[210mm] overflow-hidden">
            ${printContent.outerHTML}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `);
    windowPrint.document.close();
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setConfig(prev => ({ ...prev, backgroundImage: event.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredMembers = members.filter(m => 
    m.nome?.toLowerCase().includes(search.toLowerCase()) ||
    m.cpf?.includes(search)
  ).slice(0, 5);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-transparent overflow-hidden">
      {/* Horizontal Header for Category Selection */}
      <div className="shrink-0 bg-white dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800/50 px-6 py-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-600/20 mr-2">
            <Award className="text-white w-5 h-5" />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-left whitespace-nowrap ${
                  category.id === cat.id 
                    ? 'bg-amber-600/10 border-amber-500 text-amber-700 dark:text-amber-400 shadow-sm' 
                    : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <cat.icon className={`w-3.5 h-3.5 ${category.id === cat.id ? 'text-amber-600' : 'text-slate-400'}`} />
                <span className="text-[11px] font-black uppercase tracking-tight">{cat.name}</span>
                {category.id === cat.id && (
                  <motion.div layoutId="activeCat" className="w-1.5 h-1.5 rounded-full bg-amber-600 ml-1" />
                )}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-black py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-amber-600/20 text-[10px] uppercase tracking-widest shrink-0"
        >
          <Printer className="w-4 h-4" />
          Imprimir Certificado
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Form */}
        <div className="w-96 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 overflow-y-auto scrollbar-hide p-6 space-y-8">
          
          {/* Unified Name Input */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <User className="w-3 h-3" /> Nome do Certificado
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Escalha um membro ou digite um nome..." 
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setManualName(e.target.value);
                  if (selectedMember) setSelectedMember(null);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 focus:border-amber-500/50 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white transition-all outline-none"
              />
            </div>
            
            {search && !selectedMember && filteredMembers.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                {filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMember(m);
                      setManualName(m.nome);
                      setSearch(m.nome);
                      setVars(prev => ({
                        ...prev,
                        cargo: m.cargo || '',
                        dataNasc: m.dataNascimento || '',
                        pais: m.nomePai && m.nomeMae ? `${m.nomePai} e ${m.nomeMae}` : prev.pais
                      }));
                    }}
                    className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{m.nome}</div>
                      <div className="text-[10px] text-slate-500">{m.cargo || 'Membro'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Config Controls */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 border-t border-slate-200 dark:border-slate-800 pt-6">
              <Settings2 className="w-3 h-3" /> Configurações de Estilo
            </h3>
            
            <div className="space-y-4">
              {/* Font Family */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Tipografia</label>
                <select 
                  value={config.fontFamily}
                  onChange={(e) => setConfig(prev => ({ ...prev, fontFamily: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-xs font-bold outline-none"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.value} style={{ fontFamily: f.value }}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sizes & Color */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Tam. Título ({config.fontSizeTitle}px)</label>
                  <input 
                    type="range" min="20" max="80" value={config.fontSizeTitle}
                    onChange={(e) => setConfig(prev => ({ ...prev, fontSizeTitle: parseInt(e.target.value) }))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Tam. Corpo ({config.fontSizeBody}px)</label>
                  <input 
                    type="range" min="12" max="32" value={config.fontSizeBody}
                    onChange={(e) => setConfig(prev => ({ ...prev, fontSizeBody: parseInt(e.target.value) }))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Cor do Texto</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" value={config.fontColor}
                      onChange={(e) => setConfig(prev => ({ ...prev, fontColor: e.target.value }))}
                      className="w-8 h-8 rounded-lg overflow-hidden border-none cursor-pointer bg-transparent"
                    />
                    <input 
                      type="text" value={config.fontColor}
                      onChange={(e) => setConfig(prev => ({ ...prev, fontColor: e.target.value }))}
                      className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-lg py-1 px-2 text-[10px] uppercase font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Cor da Borda</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" value={config.borderColor}
                      onChange={(e) => setConfig(prev => ({ ...prev, borderColor: e.target.value }))}
                      className="w-8 h-8 rounded-lg overflow-hidden border-none cursor-pointer bg-transparent"
                    />
                    <div className="flex items-center gap-2 ml-auto">
                      <button 
                        onClick={() => setConfig(prev => ({ ...prev, showBorder: !prev.showBorder }))}
                        className={`w-8 h-4 rounded-full transition-all relative ${config.showBorder ? 'bg-amber-600' : 'bg-slate-300'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${config.showBorder ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Position Offsets */}
              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Deslocamento (X, Y)</label>
                  {(config.offsetX !== 0 || config.offsetY !== 0) && (
                    <button 
                      onClick={() => setConfig(prev => ({ ...prev, offsetX: 0, offsetY: 0 }))}
                      className="text-[9px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Centralizar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-medium text-slate-400 uppercase tracking-tight ml-1 text-center block">Horizontal ({config.offsetX}px)</label>
                    <input 
                      type="range" min="-150" max="150" value={config.offsetX}
                      onChange={(e) => setConfig(prev => ({ ...prev, offsetX: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-medium text-slate-400 uppercase tracking-tight ml-1 text-center block">Vertical ({config.offsetY}px)</label>
                    <input 
                      type="range" min="-150" max="150" value={config.offsetY}
                      onChange={(e) => setConfig(prev => ({ ...prev, offsetY: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-600"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Fundo (Textura ou Upload)</label>
                <div className="flex flex-wrap gap-2">
                  <label className="p-1 px-3 rounded-lg border border-dashed border-amber-500 text-[9px] font-bold text-amber-600 hover:bg-amber-50 cursor-pointer flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    Upload do PC
                    <input type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} />
                  </label>
                  {config.backgroundImage && (
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, backgroundImage: '' }))}
                      className="p-1 px-3 rounded-lg border border-slate-200 text-[9px] font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Remover Fundo
                    </button>
                  )}
                </div>
                <input 
                  type="text" 
                  value={config.backgroundImage}
                  onChange={(e) => setConfig(prev => ({ ...prev, backgroundImage: e.target.value }))}
                  placeholder="URL personalizada..."
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-lg py-1 px-2 text-[10px]"
                />
              </div>
            </div>
          </div>

          {/* Text Content Editors */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 border-t border-slate-200 dark:border-slate-800 pt-6">
              <FileText className="w-3 h-3" /> Conteúdo do Texto
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Título</label>
                <input 
                  type="text" value={content.title}
                  onChange={(e) => setContent(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-xl py-2 px-3 text-xs"
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Modelo do Certificado</label>
                    <button 
                      onClick={handleAISuggest}
                      disabled={isGenerating}
                      className="flex items-center gap-1.5 text-[9px] font-bold text-amber-600 hover:text-amber-700 transition-colors disabled:opacity-50"
                    >
                      <Sparkles className={`w-3 h-3 ${isGenerating ? 'animate-pulse' : ''}`} />
                      {isGenerating ? 'Sugerir com IA' : 'Sugerir com IA'}
                    </button>
                  </div>
                  <textarea 
                    value={content.body}
                    onChange={(e) => setContent(prev => ({ ...prev, body: e.target.value }))}
                    rows={4}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs resize-none"
                  />
                  <p className="text-[9px] text-slate-400 italic">O texto acima é o modelo. Preencha os campos abaixo para completar os dados.</p>
                </div>

                {/* Dynamic Variables Fields */}
                <div className="grid grid-cols-1 gap-3 pt-2">
                  {category.fields?.includes('cargo') && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tight ml-1">Cargo (Obreiros)</label>
                      <input 
                        type="text" value={vars.cargo}
                        onChange={(e) => setVars(prev => ({ ...prev, cargo: e.target.value }))}
                        placeholder="Ex: Diácono"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-lg py-1.5 px-3 text-xs"
                      />
                    </div>
                  )}
                  {category.fields?.includes('dataNasc') && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tight ml-1">Data de Nasc. (Apresentação)</label>
                      <input 
                        type="text" value={vars.dataNasc}
                        onChange={(e) => setVars(prev => ({ ...prev, dataNasc: e.target.value }))}
                        placeholder="Ex: 01/01/2024"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-lg py-1.5 px-3 text-xs"
                      />
                    </div>
                  )}
                  {category.fields?.includes('pais') && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tight ml-1">Pais (Apresentação)</label>
                      <input 
                        type="text" value={vars.pais}
                        onChange={(e) => setVars(prev => ({ ...prev, pais: e.target.value }))}
                        placeholder="Ex: João e Maria"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-lg py-1.5 px-3 text-xs"
                      />
                    </div>
                  )}
                  {category.fields?.includes('curso') && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tight ml-1">Curso / Seminário</label>
                      <input 
                        type="text" value={vars.curso}
                        onChange={(e) => setVars(prev => ({ ...prev, curso: e.target.value }))}
                        placeholder="Ex: Teologia Básica"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-lg py-1.5 px-3 text-xs"
                      />
                    </div>
                  )}
                  {(category.fields?.includes('periodo') || category.fields?.includes('cargaHoraria')) && (
                    <div className="grid grid-cols-2 gap-2">
                      {category.fields?.includes('periodo') && (
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tight ml-1">Período</label>
                          <input 
                            type="text" value={vars.periodo}
                            onChange={(e) => setVars(prev => ({ ...prev, periodo: e.target.value }))}
                            placeholder="Jan/24 a Fev/24"
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-lg py-1.5 px-3 text-xs"
                          />
                        </div>
                      )}
                      {category.fields?.includes('cargaHoraria') && (
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tight ml-1">Carga Horária</label>
                          <input 
                            type="text" value={vars.cargaHoraria}
                            onChange={(e) => setVars(prev => ({ ...prev, cargaHoraria: e.target.value }))}
                            placeholder="Ex: 40 Horas"
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-lg py-1.5 px-3 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Versículo / Rodapé</label>
                  <input 
                    type="text" value={content.footer}
                    onChange={(e) => setContent(prev => ({ ...prev, footer: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-xl py-2 px-3 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Cidade</label>
                    <input 
                      type="text" value={content.location}
                      onChange={(e) => setContent(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-xl py-2 px-3 text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Data</label>
                    <input 
                      type="text" value={content.date}
                      onChange={(e) => setContent(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-xl py-2 px-3 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Assinatura 1</label>
                    <input 
                      type="text" value={config.signature1Label}
                      onChange={(e) => setConfig(prev => ({ ...prev, signature1Label: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-xl py-2 px-3 text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-1">Assinatura 2</label>
                    <input 
                      type="text" value={config.signature2Label}
                      onChange={(e) => setConfig(prev => ({ ...prev, signature2Label: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-xl py-2 px-3 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pb-12 text-center">
             <button 
                onClick={() => setConfig({
                  fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
                  fontSizeTitle: 40,
                  fontSizeBody: 18,
                  fontColor: '#000000',
                  backgroundImage: '',
                  showBorder: false,
                  borderColor: '#B8860B',
                  signature1Label: 'Pastor Presidente',
                  signature2Label: 'Secretário(a)',
                  offsetX: 0,
                  offsetY: 0,
                })}
                className="text-[10px] font-bold text-slate-400 hover:text-amber-600 flex items-center gap-2 mx-auto justify-center"
             >
               <RotateCcw className="w-3 h-3" /> Restaurar Padrões
             </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="flex-1 bg-slate-200 dark:bg-slate-900 flex items-center justify-center p-8 overflow-auto CustomScroll">
          <div className="bg-white shadow-2xl p-0 landscape" style={{ width: '297mm', height: '210mm', minWidth: '297mm', minHeight: '210mm' }}>
            <div 
              ref={certificateRef}
              className="w-full h-full p-12 bg-white relative flex flex-col items-center justify-between overflow-hidden transition-all duration-300"
              style={{ 
                color: config.fontColor,
                fontFamily: config.fontFamily,
                backgroundImage: config.backgroundImage ? `url(${config.backgroundImage})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: 'white'
              }}
            >
              {/* Border */}
              {config.showBorder && (
                <div 
                  className="absolute inset-4 pointer-events-none"
                  style={{ border: `4px double ${config.borderColor}` }}
                >
                  <div 
                    className="absolute inset-1 pointer-events-none"
                    style={{ border: `1px solid ${config.borderColor}` }}
                  ></div>
                </div>
              )}

              {/* Watermark Logo (Optional) */}
              {churchData?.logos?.[0] && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0">
                  <img src={churchData.logos[0]} alt="Watermark" className="w-[600px] object-contain" />
                </div>
              )}

              {/* Content Wrapper restricted to 70% width */}
              <div 
                className="w-[70%] h-full flex flex-col items-center justify-between z-10 py-4 relative transition-transform duration-200"
                style={{ 
                  transform: `translate(${config.offsetX}px, ${config.offsetY}px)`
                }}
              >
                {/* Header Header */}
                <div className="w-full flex flex-col items-center pt-8">
                  {churchData?.logos?.[0] && (
                    <img src={churchData.logos[0]} alt="Logo" className="h-20 mb-4 object-contain" />
                  )}
                  <div className="text-center">
                    <h2 className="text-lg font-bold tracking-widest uppercase mb-1">{churchData?.socialName || 'Igreja Evangélica'}</h2>
                    {churchData?.ministry && (
                      <p className="text-[10pt] font-medium opacity-80 uppercase tracking-widest">{churchData.ministry}</p>
                    )}
                  </div>
                </div>

                {/* Title Section */}
                <div className="text-center w-full mt-4">
                  <h1 
                    className="font-bold tracking-tight"
                    style={{ fontSize: `${config.fontSizeTitle}px` }}
                  >
                    {content.title}
                  </h1>
                  <div className="h-1 w-32 bg-amber-600/30 mx-auto mt-4 rounded-full"></div>
                </div>

                {/* Body Section */}
                <div className="text-center w-full mt-8 leading-relaxed">
                  <p 
                    className="italic"
                    style={{ fontSize: `${config.fontSizeBody}px` }}
                  >
                    {replacePlaceholders(content.body)}
                  </p>
                </div>

                {/* Date & Location */}
                <div className="text-center w-full mt-6">
                  <p className="font-bold text-sm tracking-widest uppercase opacity-75">
                    {content.location && `${content.location}, `}{content.date}
                  </p>
                </div>

                {/* Signatures */}
                <div className="w-full flex justify-around items-end pb-8 mt-auto">
                  <div className="flex flex-col items-center">
                    <div className="w-48 border-t border-black mb-1"></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                      {churchData?.pastorPresident || 'Pastor Presidente'}
                    </span>
                    <span className="text-[8px] font-medium opacity-40 uppercase">
                      {config.signature1Label}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-48 border-t border-black mb-1"></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 h-4">
                      {churchData?.secretary1 || '___________________'}
                    </span>
                    <span className="text-[8px] font-medium opacity-40 uppercase">
                      {config.signature2Label}
                    </span>
                  </div>
                </div>

                {/* Footer Verse */}
                <div className="text-center w-full pt-4 pb-4">
                  <p className="text-[10px] font-medium italic opacity-60 w-full border-t border-slate-100 pt-4">
                    {content.footer}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
