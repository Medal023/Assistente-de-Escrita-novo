export interface RevisionItem {
  id: string;
  originalText: string;
  revisedText: string;
  detectedType?: string;
  detectedIntent?: string;
  selectedType: string;
  selectedIntent: string;
  timestamp: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  lastname: string;
  email: string;
  phone: string;
  photo: string;
  provider: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  lastLogin: string;
  status: "active" | "inactive" | "suspended";
  role: "SuperAdmin" | "Admin" | "Premium" | "Free";
  plan: string;
  language: "pt" | "en" | "es";
  theme: "light" | "dark";
  inviteCode: string;
  referredBy?: string;
  totalInvites: number;
  shareCount: number;
}

export interface UserSession {
  id: string;
  uid: string;
  device: string;
  os: string;
  browser: string;
  date: string;
  ip: string;
  current: boolean;
}

export interface AuditLog {
  id: string;
  uid: string;
  action: string; // 'Login' | 'Logout' | 'Register' | 'Change Password' | 'Change Email' | 'Delete Account' | 'Login Failure' | 'Plan Change' | 'Share'
  details: string;
  timestamp: string;
  ip?: string;
}

export interface InviteRecord {
  id: string;
  referrerUid: string;
  referredUid?: string;
  email?: string;
  name?: string;
  date: string;
  origin: string; // 'WhatsApp' | 'Telegram' | 'Facebook' | 'X' | 'LinkedIn' | 'CopyLink' | 'QRCode' | 'Email'
}

export interface FeedbackRecord {
  id: string;
  uid: string;
  rating: number;
  comment: string;
  timestamp: string;
}

export interface TextTypeOption {
  value: string;
  label: string;
  description: string;
}

export interface IntentOption {
  value: string;
  label: string;
  description: string;
}


export const TEXT_TYPES: TextTypeOption[] = [
  { value: "auto", label: "Detectar Automaticamente", description: "O assistente detecta o melhor formato para o texto" },
  { value: "Email", label: "E-mail", description: "E-mails corporativos ou pessoais com saudações e encerramentos profissionais" },
  { value: "Mensagem WhatsApp", label: "Mensagem de WhatsApp", description: "Linguagem natural, fluida, ágil e altamente objetiva" },
  { value: "Chamado Técnico", label: "Chamado Técnico / TI", description: "Linguagem corporativa em terceira pessoa, focada em fatos e isenta de opiniões" },
  { value: "Atendimento", label: "Atendimento / Suporte", description: "Linguagem acolhedora, clara, empática e prestativa" },
  { value: "Relatório", label: "Relatório", description: "Estrutura formal, parágrafos bem definidos, precisão analítica" },
  { value: "Documentação", label: "Documentação", description: "Linguagem instrucional, extremamente precisa e técnica" },
  { value: "Comunicado", label: "Comunicado / Nota", description: "Declaração corporativa oficial, tom neutro e informativo" },
  { value: "Carta", label: "Carta Oficial / Ofício", description: "Alto nível de formalidade e polidez linguística" },
  { value: "Currículo", label: "Currículo / Perfil", description: "Linguagem focada em realizações, profissionalismo e sobriedade" },
  { value: "Texto Livre", label: "Texto Livre", description: "Correção pura preservando o estilo livre original do autor" }
];

export const INTENTS: IntentOption[] = [
  { value: "auto", label: "Melhorar + Corrigir", description: "Ajusta erros de português e refina o vocabulário naturalmente" },
  { value: "Corrigir", label: "Apenas Corrigir", description: "Foca estritamente em ortografia, gramática e concordância" },
  { value: "Reescrever", label: "Reescrever Completamente", description: "Reestrutura o texto mantendo o sentido original intacto" },
  { value: "Humanizar", label: "Humanizar Tom", description: "Torna a linguagem mais acolhedora, simpática e amigável" },
  { value: "Profissionalizar", label: "Profissionalizar", description: "Eleva o nível linguístico para o ambiente corporativo" },
  { value: "Resumir", label: "Resumir / Sintetizar", description: "Diminui o tamanho focando apenas nos pontos essenciais" },
  { value: "Expandir", label: "Expandir / Desenvolver", description: "Enriquece o texto e detalha melhor os argumentos de forma natural" },
  { value: "Simplificar", label: "Simplificar Linguagem", description: "Evita termos difíceis e jargões, facilitando a leitura" },
  { value: "Traduzir", label: "Traduzir (Inglês/Espanhol)", description: "Traduz o texto com precisão de termos profissionais correspondentes" }
];

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

