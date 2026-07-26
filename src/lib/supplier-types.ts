export interface Supplier {
  id?: string;
  userId: string;
  tipo: 'Física' | 'Jurídica';
  nome?: string; // Para pessoa física
  cpf?: string; // Para pessoa física
  razaoSocial?: string; // Para pessoa jurídica
  nomeFantasia?: string; // Para pessoa jurídica
  cnpj?: string; // Para pessoa jurídica
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  servicosProdutos?: string; // O que o fornecedor fornece
  createdAt?: string;
  updatedAt?: string;
}
