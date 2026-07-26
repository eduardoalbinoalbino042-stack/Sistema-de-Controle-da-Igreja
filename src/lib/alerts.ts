import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

const Toast = MySwal.mixin({
  toast: true,
  position: 'bottom-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  showCloseButton: true,
  background: 'transparent',
  color: 'inherit',
  didOpen: (toast) => {
    const isDark = document.documentElement.classList.contains('dark');
    toast.style.background = isDark ? '#1e293b' : '#ffffff';
    toast.style.color = isDark ? '#f8fafc' : '#0f172a';
    toast.style.border = `1px solid ${isDark ? '#334155' : '#e2e8f0'}`;
  },
  customClass: {
    popup: 'rounded-2xl shadow-lg !p-3 flex items-center min-w-0 max-w-[300px]',
    title: 'text-xs font-semibold m-0 leading-snug',
    timerProgressBar: 'bg-emerald-500',
    closeButton: 'text-slate-400 hover:text-slate-600 scale-75 mt-[-6px] mr-[-6px]'
  }
});

export const confirmSaveAction = async (isEdit: boolean = false): Promise<boolean> => {
  const isDark = document.documentElement.classList.contains('dark');
  
  const titleText = isEdit ? 'Confirmar Alterações?' : 'Salvar Registro?';
  const subtitleText = isEdit 
    ? 'Deseja realmente salvar as alterações feitas neste registro?' 
    : 'Deseja realmente salvar este novo registro?';
    
  const titleColorClass = isEdit ? 'text-blue-500' : 'text-emerald-500';
  const confirmBtnClass = isEdit 
    ? 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-100 dark:shadow-none' 
    : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-100 dark:shadow-none';

  const result = await MySwal.fire({
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    width: '380px',
    showCancelButton: true,
    confirmButtonText: 'Salvar',
    cancelButtonText: 'Cancelar',
    buttonsStyling: false,
    customClass: {
      popup: 'border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl px-4 py-8 font-sans',
      title: 'hidden',
      htmlContainer: 'm-0 p-0',
      actions: '!grid !grid-cols-2 !gap-3 !w-full !px-4 !m-0 !mt-6',
      cancelButton: 'col-span-1 order-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 !w-full !m-0',
      confirmButton: `col-span-1 order-2 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 !w-full !m-0 ${confirmBtnClass}`,
    },
    html: `<div class="text-[17px] font-black uppercase tracking-wide text-center m-0 p-0 ${titleColorClass}">${titleText}</div><div class="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed font-bold uppercase tracking-wider">${subtitleText}</div>`,
  });
  return result.isConfirmed;
};

export const confirmRecurrentDeleteAction = async (): Promise<'single' | 'series' | null> => {
  const isDark = document.documentElement.classList.contains('dark');
  const result = await MySwal.fire({
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    width: '380px',
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: 'Apenas este',
    denyButtonText: 'Toda a série',
    cancelButtonText: 'Cancelar',
    buttonsStyling: false,
    customClass: {
      popup: 'border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl px-4 py-8 font-sans',
      title: 'hidden',
      htmlContainer: 'm-0 p-0',
      actions: '!grid !grid-cols-2 !gap-3 !w-full !px-4 !m-0 !mt-6',
      denyButton: 'col-span-2 order-1 bg-rose-700 hover:bg-rose-800 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 !w-full !m-0 shadow-lg shadow-rose-100 dark:shadow-none',
      cancelButton: 'col-span-1 order-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 !w-full !m-0',
      confirmButton: 'col-span-1 order-3 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 !w-full !m-0 shadow-lg shadow-red-100 dark:shadow-none',
    },
    html: `<div class="text-[17px] font-black uppercase tracking-wide text-center m-0 p-0 text-red-500">Excluir Recorrência?</div><div class="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed font-bold uppercase tracking-wider">Deseja excluir apenas esta transação ou toda a série recorrente?</div>`,
  });

  if (result.isConfirmed) return 'single';
  if (result.isDenied) return 'series';
  return null;
};

export const confirmInstallmentAction = async (mode: 'edit' | 'delete' = 'edit'): Promise<'single' | 'series' | null> => {
  const isDark = document.documentElement.classList.contains('dark');
  
  const isDelete = mode === 'delete';
  
  const titleText = isDelete ? 'Excluir Parcelas?' : 'Alterar Parcelas?';
  const subtitleText = isDelete 
    ? 'Esta compra possui parcelas. Deseja excluir apenas esta ou toda a série?' 
    : 'Esta compra possui parcelas. Deseja alterar apenas esta ou toda a série?';

  // Styles based on mode
  const titleColorClass = isDelete ? 'text-red-500' : 'text-blue-500';
  const primaryBtnClass = isDelete 
    ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-100 dark:shadow-none' 
    : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-100 dark:shadow-none';
    
  const secondaryBtnClass = isDelete 
    ? 'bg-rose-700 hover:bg-rose-800 shadow-lg shadow-rose-100 dark:shadow-none' 
    : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none';

  const result = await MySwal.fire({
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    width: '380px',
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: 'Apenas esta',
    denyButtonText: 'Todas as parcelas',
    cancelButtonText: 'Cancelar',
    buttonsStyling: false,
    customClass: {
      popup: 'border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl px-4 py-8 font-sans',
      title: 'hidden',
      htmlContainer: 'm-0 p-0',
      actions: '!grid !grid-cols-2 !gap-3 !w-full !px-4 !m-0 !mt-6',
      denyButton: `col-span-2 order-1 ${secondaryBtnClass} text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 !w-full !m-0`,
      cancelButton: 'col-span-1 order-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 !w-full !m-0',
      confirmButton: `col-span-1 order-3 ${primaryBtnClass} text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 !w-full !m-0`,
    },
    html: `<div class="text-[17px] font-black uppercase tracking-wide text-center m-0 p-0 ${titleColorClass}">${titleText}</div><div class="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed font-bold uppercase tracking-wider">${subtitleText}</div>`
  });

  if (result.isConfirmed) return 'single';
  if (result.isDenied) return 'series';
  return null;
};

export const confirmDeleteAction = async (): Promise<boolean> => {
  const isDark = document.documentElement.classList.contains('dark');
  const result = await MySwal.fire({
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    width: '380px',
    showCancelButton: true,
    confirmButtonText: 'Excluir',
    cancelButtonText: 'Cancelar',
    buttonsStyling: false,
    customClass: {
      popup: 'border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl px-4 py-8 font-sans',
      title: 'hidden',
      htmlContainer: 'm-0 p-0',
      actions: '!grid !grid-cols-2 !gap-3 !w-full !px-4 !m-0 !mt-6',
      cancelButton: 'col-span-1 order-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 !w-full !m-0',
      confirmButton: 'col-span-1 order-2 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 !w-full !m-0 shadow-lg shadow-red-100 dark:shadow-none',
    },
    html: `<div class="text-[17px] font-black uppercase tracking-wide text-center m-0 p-0 text-red-500">Excluir Registro?</div><div class="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed font-bold uppercase tracking-wider">Deseja realmente apagar este registro? Esta ação não poderá ser desfeita.</div>`,
  });
  return result.isConfirmed;
};

export const confirmPayAction = async (value: string): Promise<boolean> => {
  const isDark = document.documentElement.classList.contains('dark');
  const result = await MySwal.fire({
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    width: '380px',
    showCancelButton: true,
    confirmButtonText: 'Pagar',
    cancelButtonText: 'Cancelar',
    buttonsStyling: false,
    customClass: {
      popup: 'border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl px-4 py-8 font-sans',
      title: 'hidden',
      htmlContainer: 'm-0 p-0',
      actions: '!grid !grid-cols-2 !gap-3 !w-full !px-4 !m-0 !mt-6',
      cancelButton: 'col-span-1 order-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 !w-full !m-0',
      confirmButton: 'col-span-1 order-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 !w-full !m-0 shadow-lg shadow-emerald-100 dark:shadow-none',
    },
    html: `<div class="text-[17px] font-black uppercase tracking-wide text-center m-0 p-0 text-emerald-500">Confirmar Pagamento?</div><div class="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed font-bold uppercase tracking-wider">Deseja realmente marcar essa fatura de <span class="text-emerald-500 font-extrabold">${value}</span> como <span class="text-emerald-500 font-extrabold">Paga</span>?</div>`,
  });
  return result.isConfirmed;
};

export const confirmAction = async (
  title: string,
  text: string,
  confirmButtonText: string = 'Sim',
  cancelButtonText: string = 'Cancelar',
  confirmColor: string = '#f43f5e', // rose-500
): Promise<boolean> => {
  const isDark = document.documentElement.classList.contains('dark');
  
  // Decide active style based on confirmColor values or keywords
  let confirmBtnClass = '';
  const lowerTitle = title.toLowerCase();
  const lowerConfirm = confirmButtonText.toLowerCase();
  
  if (confirmColor === '#ff0000' || confirmColor === '#ef4444' || confirmColor === '#f43f5e' || lowerTitle.includes('excluir') || lowerTitle.includes('apagar') || lowerTitle.includes('remover')) {
    // Red deletion theme
    confirmBtnClass = 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-100 dark:shadow-none';
  } else if (confirmColor === '#10b981' || confirmColor === '#00a650' || lowerTitle.includes('salvar') || lowerTitle.includes('criar') || lowerTitle.includes('cadastrar')) {
    // Emerald green theme
    confirmBtnClass = 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-100 dark:shadow-none';
  } else {
    // Blue theme
    confirmBtnClass = 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-100 dark:shadow-none';
  }

  const result = await MySwal.fire({
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    width: '380px',
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    buttonsStyling: false,
    customClass: {
      popup: 'border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl px-4 py-8 font-sans',
      title: 'hidden',
      htmlContainer: 'm-0 p-0',
      actions: 'flex gap-4 justify-center w-full mt-6 mb-0',
      confirmButton: `${confirmBtnClass} text-white font-bold py-2.5 px-5 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 min-w-[120px] max-w-[155px]`,
      cancelButton: 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-5 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 min-w-[120px] max-w-[155px]',
    },
    html: `<div class="text-[17px] font-black uppercase tracking-wide text-center m-0 p-0">${title}</div>${text ? `<div class="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center leading-relaxed font-bold uppercase tracking-wider">${text}</div>` : ''}`
  });

  return result.isConfirmed;
};

export const showSuccess = (title: string, text?: string) => {
  Toast.fire({
    icon: 'success',
    title: text ? `${title}: ${text}` : title,
  });
};

export const showError = (title: string, text?: string) => {
  Toast.fire({
    icon: 'error',
    title: text ? `${title}: ${text}` : title,
  });
};

export const showInfo = (title: string, text?: string) => {
  Toast.fire({
    icon: 'info',
    title: text ? `${title}: ${text}` : title,
  });
};

export const showPwaInstructions = async () => {
  const isDark = document.documentElement.classList.contains('dark');
  await MySwal.fire({
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    width: '450px',
    confirmButtonText: 'Entendido',
    buttonsStyling: false,
    customClass: {
      popup: 'border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl px-6 py-8 font-sans',
      title: 'hidden',
      htmlContainer: 'm-0 p-0',
      actions: '!flex !justify-center !w-full !m-0 !mt-6',
      confirmButton: 'bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-8 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 shadow-lg shadow-emerald-100 dark:shadow-none',
    },
    html: `
      <div class="text-[17px] font-black uppercase tracking-wide text-center m-0 p-0 text-emerald-500 flex items-center justify-center gap-2">
         Instalação do Aplicativo
      </div>
      <div class="text-xs text-left text-slate-600 dark:text-slate-300 mt-4 space-y-4 leading-relaxed">
        <p class="font-bold text-center uppercase tracking-wider text-slate-500 dark:text-slate-400">Como instalar na sua Área de Trabalho:</p>
        
        <div class="space-y-3 mt-4">
          <div class="flex gap-2.5">
            <span class="flex items-center justify-center w-5 h-5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full font-bold text-[10px] shrink-0">1</span>
            <p>Se você estiver dentro de uma visualização incorporada ou iframe (como no AI Studio), clique no botão de <strong>Nova Aba</strong> (ou abra o link principal diretamente no Chrome/Edge) para ir para o endereço real.</p>
          </div>
          <div class="flex gap-2.5">
            <span class="flex items-center justify-center w-5 h-5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full font-bold text-[10px] shrink-0">2</span>
            <p>No topo da barra de navegação do seu navegador (Google Chrome ou Microsoft Edge), procure pelo ícone de <strong>"Instalar Aplicativo"</strong> (computador com uma seta para baixo) ao lado da estrela de favoritos.</p>
          </div>
          <div class="flex gap-2.5">
            <span class="flex items-center justify-center w-5 h-5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full font-bold text-[10px] shrink-0">3</span>
            <p>Caso não localize, clique no menu de <strong>Três Pontos</strong> do navegador no canto superior direito e vá em <strong>"Salvar e compartilhar" &gt; "Instalar página como app"</strong>.</p>
          </div>
        </div>

        <div class="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300">
          <span class="font-black uppercase tracking-wider block mb-1">💡 Importante (Inatividade do Servidor):</span>
          Como o seu aplicativo está em um servidor compartilhado em nuvem, ele entra em modo de suspensão ("dorme") após períodos de inatividade para economizar recursos. Por isso, <strong>no primeiro acesso do dia, ele pode demorar de 15 a 30 segundos para "acordar"</strong>. Se isso acontecer, basta aguardar um pouco ou recarregar a página que ele carregará perfeitamente!
        </div>
      </div>
    `,
  });
};

export const showGoogleAuthErrorHelp = async (error: any) => {
  const isDark = document.documentElement.classList.contains('dark');
  const currentUrl = window.location.href;
  
  await MySwal.fire({
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    width: '480px',
    confirmButtonText: 'Entendido',
    buttonsStyling: false,
    customClass: {
      popup: 'border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl px-6 py-8 font-sans',
      title: 'hidden',
      htmlContainer: 'm-0 p-0',
      actions: '!flex !justify-center !w-full !m-0 !mt-6',
      confirmButton: 'bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2.5 px-8 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 shadow-lg shadow-cyan-100 dark:shadow-none',
    },
    html: `
      <div class="text-[17px] font-black uppercase tracking-wide text-center m-0 p-0 text-cyan-500 flex items-center justify-center gap-2">
         Restrição de Segurança do Navegador
      </div>
      <div class="text-xs text-left text-slate-600 dark:text-slate-300 mt-4 space-y-4 leading-relaxed">
        <p class="font-bold text-center uppercase tracking-wider text-slate-500 dark:text-slate-400">Por que o login do Google falhou?</p>
        
        <p>Você encontrou um erro de rede (<code>auth/network-request-failed</code>). Isso ocorre porque <strong>o seu navegador bloqueia a comunicação de login seguro (popup de login externo) dentro de iframes incorporados</strong> (como a janela de pré-visualização do Google AI Studio).</p>

        <div class="space-y-3 mt-4">
          <div class="flex gap-2.5 bg-cyan-50 dark:bg-cyan-950/20 p-3 rounded-2xl border border-cyan-100 dark:border-cyan-900/40">
            <span class="flex items-center justify-center w-5 h-5 bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 rounded-full font-bold text-[10px] shrink-0 mt-0.5">1</span>
            <div>
              <strong class="text-cyan-600 dark:text-cyan-400 block mb-0.5">Solução Rápida e Definitiva:</strong>
              Use o botão <strong>"Abrir em Nova Aba"</strong> (ícone de seta inclinada no canto superior direito da barra de visualização do AI Studio) ou copie e cole o link direto no seu navegador:
              <div class="mt-2 flex items-center gap-1">
                <input type="text" readonly value="${currentUrl}" class="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-[10px] w-full font-mono select-all focus:outline-none" />
              </div>
            </div>
          </div>
          
          <div class="flex gap-2.5">
            <span class="flex items-center justify-center w-5 h-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full font-bold text-[10px] shrink-0">2</span>
            <p>Se você estiver em uma aba separada e persistir, certifique-se de que o domínio <code>${window.location.hostname}</code> está adicionado como um <strong>"Domínio Autorizado"</strong> nas configurações do console do Firebase Authentication.</p>
          </div>
        </div>

        <div class="mt-4 text-[10px] text-slate-400 dark:text-slate-500 text-center italic">
          Detalhes técnicos: ${error.message || error.code || error}
        </div>
      </div>
    `,
  });
};

export const showUnauthorizedDomainHelp = async (domainName: string = window.location.hostname, errorCode: string = 'auth/invalid-continue-uri') => {
  const isDark = document.documentElement.classList.contains('dark');
  
  await MySwal.fire({
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    width: '520px',
    confirmButtonText: 'Entendido',
    buttonsStyling: false,
    customClass: {
      popup: 'border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl px-6 py-8 font-sans',
      title: 'hidden',
      htmlContainer: 'm-0 p-0',
      actions: '!flex !justify-center !w-full !m-0 !mt-6',
      confirmButton: 'bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-8 rounded-xl text-xs uppercase tracking-widest transition-transform active:scale-95 shadow-lg shadow-amber-100 dark:shadow-none',
    },
    html: `
      <div class="text-[17px] font-black uppercase tracking-wide text-center m-0 p-0 text-amber-500 flex items-center justify-center gap-2">
         Domínio Não Autorizado no Firebase
      </div>
      <div class="text-xs text-left text-slate-600 dark:text-slate-300 mt-4 space-y-4 leading-relaxed">
        <div class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 rounded-2xl">
          <p class="font-bold text-amber-800 dark:text-amber-300">Erro: <code>${errorCode}</code></p>
          <p class="text-[11px] text-amber-700 dark:text-amber-400 mt-1">O Firebase bloqueou a autenticação porque o domínio <strong>${domainName}</strong> (ou o seu domínio Vercel/produção) não está na lista de domínios autorizados do seu projeto Firebase.</p>
        </div>

        <p class="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Como autorizar no Firebase Console (Passo a Passo):</p>

        <div class="space-y-3">
          <div class="flex gap-2.5">
            <span class="flex items-center justify-center w-5 h-5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded-full font-bold text-[10px] shrink-0 mt-0.5">1</span>
            <p>Acesse o <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 font-bold underline">Console do Firebase</a> e selecione seu projeto.</p>
          </div>
          <div class="flex gap-2.5">
            <span class="flex items-center justify-center w-5 h-5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded-full font-bold text-[10px] shrink-0 mt-0.5">2</span>
            <p>No menu esquerdo, clique em <strong>Authentication</strong> (Autenticação).</p>
          </div>
          <div class="flex gap-2.5">
            <span class="flex items-center justify-center w-5 h-5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded-full font-bold text-[10px] shrink-0 mt-0.5">3</span>
            <p>Acesse a aba <strong>Settings</strong> (Configurações) no topo e escolha <strong>Authorized domains</strong> (Domínios autorizados).</p>
          </div>
          <div class="flex gap-2.5">
            <span class="flex items-center justify-center w-5 h-5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded-full font-bold text-[10px] shrink-0 mt-0.5">4</span>
            <div>
              <p>Clique em <strong>Add domain</strong> (Adicionar domínio) e adicione os domínios:</p>
              <code class="block bg-slate-100 dark:bg-slate-900 p-2 rounded-lg font-mono text-[11px] mt-1 text-emerald-600 dark:text-emerald-400 font-bold">project-36sd1.vercel.app</code>
              <code class="block bg-slate-100 dark:bg-slate-900 p-2 rounded-lg font-mono text-[11px] mt-1 text-emerald-600 dark:text-emerald-400 font-bold">church-control-system.vercel.app</code>
              <code class="block bg-slate-100 dark:bg-slate-900 p-2 rounded-lg font-mono text-[11px] mt-1 text-cyan-600 dark:text-cyan-400 font-bold">${domainName}</code>
            </div>
          </div>
        </div>
      </div>
    `,
  });
};
