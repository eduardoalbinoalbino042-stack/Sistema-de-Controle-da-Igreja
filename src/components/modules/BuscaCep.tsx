import { useState, useCallback, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, Copy, Check, Loader2, Info, Map as MapIcon, Compass, Eye, EyeOff } from 'lucide-react';
import { smartSearch, AddressResult } from '../../services/searchService';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

import { useConfig } from '../../context/ConfigContext';

const DEFAULT_MAPS_KEY = 'AIzaSyC_YbCIHXRMfedcwMhxhDRIxq9p2eYwJzo';

function MapDisplay({ address }: { address: string }) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral | null>(null);

  useEffect(() => {
    if (!placesLib || !map || !address) return;

    const svc = new placesLib.PlacesService(map);
    svc.findPlaceFromQuery(
      { query: address, fields: ['geometry', 'name'] },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          const pos = { lat: loc.lat(), lng: loc.lng() };
          setMarkerPosition(pos);
          map.panTo(pos);
          map.setZoom(16);
        }
      }
    );
  }, [placesLib, map, address]);

  return (
    <div className="w-full h-full relative">
      {markerPosition && <AdvancedMarker position={markerPosition} />}
    </div>
  );
}

export default function BuscaCep() {
  const { mapsKey } = useConfig();
  const MAPS_API_KEY = mapsKey || DEFAULT_MAPS_KEY;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  // API Key Management
  const [mapsApiKey, setMapsApiKey] = useState(mapsKey || localStorage.getItem('custom_maps_key') || DEFAULT_MAPS_KEY);
  const [tempKey, setTempKey] = useState(mapsApiKey);

  useEffect(() => {
    if (mapsKey) {
      setMapsApiKey(mapsKey);
      setTempKey(mapsKey);
    }
  }, [mapsKey]);
  const [isSaving, setIsLoadingSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleSaveKey = () => {
    setIsLoadingSaving(true);
    localStorage.setItem('custom_maps_key', tempKey);
    setMapsApiKey(tempKey);
    setTimeout(() => {
      setIsLoadingSaving(false);
    }, 500);
  };

  const hasValidMapsKey = Boolean(mapsApiKey) && 
    mapsApiKey !== '' && 
    mapsApiKey !== 'MY_GOOGLE_MAPS_PLATFORM_KEY';

  const handleSearch = useCallback(async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    try {
      const data = await smartSearch(query);
      setResults(data);
    } catch (error) {
      console.error(error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  const copyToClipboard = (result: AddressResult) => {
    const text = `${result.logradouro}, ${result.bairro}, ${result.localidade} - ${result.uf}, CEP: ${result.cep}`;
    navigator.clipboard.writeText(text);
    setCopiedId(result.cep);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const Content = (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FBFBFA] dark:bg-[#0b1120] p-4 md:p-8 overflow-y-auto scrollbar-hide">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-50/50 dark:bg-blue-900/5 rounded-full blur-3xl opacity-50" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-indigo-50/50 dark:bg-indigo-900/5 rounded-full blur-3xl opacity-50" />
      </div>

      <main className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* Left Column: Search & Results */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Search Card */}
          <section className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/20 dark:border-slate-800/50 rounded-[2rem] p-8 md:p-10 shadow-sm overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10">
              <MapIcon className="w-48 h-48 -rotate-12 dark:text-blue-500" />
            </div>
            
            <div className="max-w-2xl relative">
              <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white mb-4 leading-[1.1]">
                Encontre o endereço <br /> <span className="text-blue-600 dark:text-blue-400">pelo contexto.</span>
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg mb-8 max-w-md font-medium">
                Busque por CEP, logradouro ou pontos de referência. Nossa IA faz o trabalho pesado para você.
              </p>

              <form onSubmit={handleSearch} className="relative group/form">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-400 group-focus-within/form:text-blue-500 transition-all duration-300">
                  <Search className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="CEP, Rua ou nome do local..."
                  className="block w-full pl-14 pr-40 py-5 bg-white/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 rounded-2xl text-lg shadow-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-400 outline-none transition-all duration-300 placeholder:text-slate-400"
                />
                <div className="absolute right-2 top-2 bottom-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="h-full px-8 bg-slate-900 dark:bg-blue-600 text-white font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2 group/btn"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>Pesquisar</span>
                        <Check className="w-4 h-4 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* Results Section */}
          <section className="flex flex-col gap-6 min-h-[400px]">
            <AnimatePresence mode="popLayout" initial={false}>
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex-1 flex flex-col items-center justify-center py-20 bg-white/40 dark:bg-slate-900/40 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800"
                >
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-blue-50 dark:border-blue-900/30 border-t-blue-600 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <p className="font-display font-bold text-slate-800 dark:text-slate-200 mt-6 tracking-wide">Mapeando endereços...</p>
                  <p className="text-slate-400 text-xs uppercase tracking-widest mt-2 font-bold animate-pulse">Google API Processing</p>
                </motion.div>
              ) : results.length > 0 ? (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between px-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                      {results.length} {results.length === 1 ? 'Resultado' : 'Resultados'}
                    </span>
                    <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800 mx-6" />
                  </div>
                  {results.map((result, idx) => (
                    <motion.div
                      key={result.cep + idx}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.19, 1, 0.22, 1] }}
                      className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/20 dark:border-slate-800/50 rounded-[2rem] p-4 flex flex-col md:flex-row gap-4 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-500 overflow-hidden group"
                    >
                      {/* Map Preview (Left) */}
                      <div className="md:w-72 h-48 md:h-auto rounded-2xl overflow-hidden relative bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50">
                        {hasValidMapsKey ? (
                          <Map
                            defaultCenter={{ lat: -23.55052, lng: -46.633309 }}
                            defaultZoom={13}
                            mapId={`MAP_${idx}`}
                            disableDefaultUI={true}
                            gestureHandling={'none'}
                            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                            style={{ width: '100%', height: '100%' }}
                          >
                            <MapDisplay address={`${result.logradouro}, ${result.bairro}, ${result.localidade}, ${result.uf}, Brazil`} />
                          </Map>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center opacity-40">
                            <MapIcon className="w-8 h-8 text-slate-400 mb-2" />
                            <p className="text-[10px] font-bold uppercase text-slate-500">Mapa Visual</p>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent pointer-events-none md:hidden" />
                      </div>

                      {/* Content (Right) */}
                      <div className="flex-1 p-4 md:p-6 flex flex-col justify-between gap-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-blue-600 dark:text-blue-400 font-bold text-[10px] uppercase tracking-widest block mb-1">
                              {result.referencia || 'Endereço Localizado'}
                            </span>
                            <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight group-hover:text-blue-600 transition-colors">
                              {result.logradouro}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base mt-2 font-medium">
                              {result.bairro ? `${result.bairro} — ` : ''}{result.localidade}, {result.uf}
                            </p>
                          </div>
                          
                          <div className="flex flex-col items-end gap-2">
                              <div className="bg-[#FBFBFA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-right">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-tighter">CEP</span>
                                <span className="font-mono font-bold text-lg text-slate-900 dark:text-white">{result.cep}</span>
                              </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => copyToClipboard(result)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 border ${
                              copiedId === result.cep 
                                ? 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-100' 
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            {copiedId === result.cep ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-slate-400" />}
                            {copiedId === result.cep ? 'Dados Copiados' : 'Copiar Endereço'}
                          </button>
                          <button className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-md">
                              <MapPin className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : hasSearched && !isLoading ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 flex flex-col items-center justify-center py-20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem]"
                >
                  <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-6">
                    <Search className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  </div>
                  <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Nenhum resultado</h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-xs text-center text-sm font-medium">
                    Não localizamos endereços com esse termo. <br /> Tente ser mais específico (Ex: "Rua tal, Cidade").
                  </p>
                  <button 
                    onClick={() => { setQuery(''); setHasSearched(false); }}
                    className="mt-8 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-widest hover:underline"
                  >
                    Limpar busca
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center py-20 text-slate-300 dark:text-slate-700 pointer-events-none"
                >
                  <Compass className="w-16 h-16 mb-4 opacity-20 animate-pulse" />
                  <p className="font-display font-bold uppercase tracking-widest text-[11px] opacity-40">Aguardando sua busca</p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>

        {/* Right Column: Information & Status */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          {/* Quick Tips */}
          <div className="bg-slate-900 dark:bg-slate-950 rounded-[2rem] p-8 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl min-h-[340px]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
            
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-6 backdrop-blur-sm border border-white/10 text-blue-400">
                <Info className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-2xl leading-tight">Como otimizar <br /> suas buscas?</h3>
              <p className="text-slate-400 text-sm mt-4 leading-relaxed font-medium">
                Nossa plataforma combina geolocalização do Google com processamento inteligente de texto.
              </p>
            </div>

            <div className="space-y-3 relative mt-8">
              {[
                { id: '01', text: 'CEP: 19800-010' },
                { id: '02', text: 'Av. Paulista, SP' },
                { id: '03', text: 'Oficina Giroto Assis' }
              ].map(step => (
                <div key={step.id} className="flex items-center gap-4 group cursor-help">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center font-mono text-[10px] font-bold text-blue-400 transition-colors group-hover:bg-blue-500/20 group-hover:border-blue-500/20">{step.id}</div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 group-hover:text-white transition-colors">{step.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Google Status Panel */}
          <section className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/20 dark:border-slate-800/50 rounded-[2.5rem] p-8 shadow-sm flex flex-col border-slate-200/50">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-display font-bold text-slate-900 dark:text-white border-l-4 border-orange-500 pl-4 h-6 flex items-center">
                 Status do Google
              </h3>
              <div className="px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-[9px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-tighter">Pendente</div>
            </div>
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 text-[11px] leading-relaxed relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                  <Info className="w-12 h-12 text-orange-600" />
                </div>
                <div className="flex items-center gap-2 mb-3 text-orange-800 dark:text-orange-400 font-bold uppercase tracking-tight">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /> 
                  Erro Detectado: API Indisponível
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="relative">
                    <input 
                      type={showKey ? "text" : "password"}
                      value={tempKey}
                      onChange={(e) => setTempKey(e.target.value)}
                      placeholder="Insira sua Chave API aqui"
                      className="w-full p-3 pr-10 text-xs bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-900/30 rounded-xl outline-none focus:ring-2 focus:ring-orange-200 font-mono shadow-inner"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button 
                    onClick={handleSaveKey}
                    disabled={isSaving}
                    className="w-full py-3 bg-orange-500 text-white rounded-xl text-[10px] font-bold hover:bg-orange-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-200 dark:shadow-none"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'RECARREGAR COM NOVA CHAVE'}
                  </button>
                </div>

                <div className="space-y-3 mt-4 border-t border-orange-100 dark:border-orange-900/30 pt-4">
                   <div className="bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl">
                      <p className="text-orange-900 dark:text-orange-300 font-bold mb-2">ERRO: ApiNotActivatedMapError</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        Este erro ocorre porque a biblioteca do Google Maps não foi ativada para sua chave. Você precisa habilitar manualmente as APIs abaixo no seu console:
                      </p>
                      <ul className="mt-2 space-y-1">
                        {['Maps JavaScript API', 'Places API', 'Places API (New)'].map(api => (
                          <li key={api} className="flex items-center gap-2 text-[10px] font-bold text-orange-700 dark:text-orange-400">
                             <Check className="w-3 h-3 text-green-500" /> {api}
                          </li>
                        ))}
                      </ul>
                   </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">Checklist de Resolução:</p>
                <div className="space-y-4">
                  {[
                    { step: 1, text: 'Acesse o Console do Google Cloud.', link: 'https://console.cloud.google.com/google/maps-apis/overview' },
                    { step: 2, text: 'Verifique se o Faturamento (Billing) está ATIVO.', link: 'https://console.cloud.google.com/billing' },
                    { step: 3, text: 'Ative as 3 APIs listadas acima no menu "APIs e Serviços".' }
                  ].map(item => (
                    <div key={item.step} className="flex gap-4 items-start group">
                      <div className="flex-none w-6 h-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-900 dark:text-white shadow-sm group-hover:bg-blue-50 transition-colors">{item.step}</div>
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold leading-tight pt-1">{item.text}</p>
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noreferrer" className="text-[9px] text-blue-500 hover:underline flex items-center gap-1 font-bold">
                            Abrir Link <Compass className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <a 
                  href="https://console.cloud.google.com/google/maps-apis/overview" 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-4 mt-8 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-xl shadow-slate-100 dark:shadow-none"
                >
                  Abrir Console do Google
                </a>
              </div>
            </div>
          </section>
        </aside>
      </main>

      <footer className="max-w-6xl mx-auto w-full flex flex-col md:flex-row items-center justify-between py-10 opacity-40 text-[9px] uppercase tracking-[0.2em] font-bold text-slate-900 dark:text-slate-400">
        <div className="flex items-center gap-2 mb-4 md:mb-0">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
           System Status: Operational
        </div>
        <div className="flex gap-8">
          <span className="hover:text-blue-600 transition-colors cursor-pointer">Privacidade</span>
          <span className="hover:text-blue-600 transition-colors cursor-pointer">Suporte</span>
          <span className="text-slate-300">/</span>
          <span>© 2024 LOCALIZACEP PRO</span>
        </div>
      </footer>
    </div>
  );

  return hasValidMapsKey ? (
    <APIProvider apiKey={mapsApiKey} version="weekly">
      {Content}
    </APIProvider>
  ) : Content;
}
