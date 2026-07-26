export interface Member {
  id?: string;
  idPlanilha?: number;
  userId: string;
  nome: string;
  dataRegistro?: string;
  dataNascimento?: string;
  idade?: number;
  escolaridade?: string;
  cpf?: string;
  rg?: string;
  celular?: string;
  telefone?: string;
  email?: string;
  naturalidade?: string;
  ufNascimento?: string;
  genero?: string;
  nomePai?: string;
  nomeMae?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  cidade?: string;
  uf?: string;
  eBatizado?: boolean;
  dataBatismo?: string;
  pastorBatismo?: string;
  igrejaBatismo?: string;
  temCartao?: boolean;
  estadoCivil?: string;
  dataCasamento?: string;
  conjuge?: string;
  formaRecebimento?: string;
  dataRecebimento?: string;
  cargo?: string;
  cargoAnterior?: string;
  status: 'Ativo' | 'Inativo' | 'Afastado' | 'Falecido' | 'Transferido' | 'Visitante';
  fotoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const MEMBER_STATUS_COLORS = {
  Ativo: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  Inativo: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  Afastado: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  Falecido: 'bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20',
  Transferido: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  Visitante: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
};

export const FORMAS_RECEBIMENTO = [
  'Batismo',
  'Aclamação',
  'Transferência',
  'Reconciliação',
  'Interesse Próprio',
  'Outro'
];

export const ESTADOS_CIVIS = [
  'Solteiro(a)',
  'Casado(a)',
  'Divorciado(a)',
  'Viúvo(a)',
  'Separado(a)',
  'União Estável'
];

export const ESCOLARIDADES = [
  'Analfabeto',
  'Fundamental Incompleto',
  'Fundamental Completo',
  'Médio Incompleto',
  'Médio Completo',
  'Superior Incompleto',
  'Superior Completo',
  'Pós-Graduação',
  'Mestrado',
  'Doutorado'
];

export const CARGOS = [
  'Membro',
  'Pastor Presidente',
  'Pastora Vice Presidente',
  'Pastor',
  'Pastora',
  'Bispo',
  'Bispa',
  'Evangelista',
  'Presbítero',
  'Diácono',
  'Diaconisa',
  'Missionário(a)',
  'Cooperador(a)',
  'Auxiliar',
  'Levita',
  'Professor(a) EBD',
  'Líder de Departamento',
  'Secretário(a)',
  'Tesoureiro(a)',
  'Músico',
  'Porteiro'
];
