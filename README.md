# ✍️ Assistente de Escrita Profissional

Uma aplicação web completa e pronta para produção desenvolvida para ajudar profissionais, estudantes e criadores de conteúdo a revisar, aprimorar, corrigir e adaptar seus textos utilizando a Inteligência Artificial do Google Gemini.

---

## 🎯 Objetivo

O **Assistente de Escrita Profissional** tem como propósito transformar rascunhos, e-mails, relatórios, propostas comerciais e artigos em textos elegantes, claros e com gramática impecável. A plataforma ajusta automaticamente tom, estilo e intenção sem alterar o sentido original do conteúdo.

---

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React 19** com **TypeScript**
- **Vite 6** (Build tool e Dev Server de ultra-alta velocidade)
- **Tailwind CSS v4** (Estilização moderna e utilitária)
- **Framer Motion** (Animações fluidas e transições suaves)
- **Lucide React** (Ícones modernos em vetor)

### Backend & Serviços
- **Node.js + Express** (Servidor HTTP para proxy seguro da API)
- **@google/genai SDK** (Integração server-side segura com Gemini AI)
- **Firebase Auth & Firestore** (Autenticação de usuários e persistência de histórico e perfil)
- **esbuild & tsx** (Compilação rápida do backend em ambiente de produção)

---

## 📐 Arquitetura do Sistema

```
                         +-----------------------------+
                         |      Navegador do Usuário   |
                         |   (React 19 + Tailwind CSS) |
                         +--------------+--------------+
                                        |
                            HTTP / API  | JSON
                                        v
                         +-----------------------------+
                         |       Express Backend       |
                         |       (server.ts)           |
                         +--------------+--------------+
                                        |
                 +----------------------+----------------------+
                 |                                             |
                 v                                             v
    +--------------------------+                 +---------------------------+
    |   Google Gemini API      |                 |    Firebase Auth &        |
    |   (gemini-2.5-flash)     |                 |    Firestore Database     |
    +--------------------------+                 +---------------------------+
```

---

## 📂 Estrutura de Pastas

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml          # Pipeline de integração e entrega contínua (CI/CD)
├── public/
│   ├── favicon.svg             # Ícone do aplicativo
│   └── manifest.json           # Configuração de PWA e instalação
├── src/
│   ├── components/             # Componentes modulares
│   │   ├── Login.tsx           # Tela de autenticação e registro
│   │   ├── Profile.tsx         # Gerenciamento de perfil e conta
│   │   └── Share.tsx           # Compartilhamento e convites
│   ├── App.tsx                 # Aplicação principal e gerenciamento de estado
│   ├── firebase.ts             # Inicialização do Firebase Auth & Firestore
│   ├── index.css               # Importação de estilos globais Tailwind
│   ├── main.tsx                # Ponto de entrada do React
│   └── types.ts                # Definições de tipos e interfaces TypeScript
├── .env.example                # Modelo das variáveis de ambiente
├── .gitattributes             # Padronização de quebras de linha no Git
├── .gitignore                  # Arquivos e pastas ignorados pelo Git
├── firestore.rules             # Regras de segurança do Firestore Database
├── index.html                  # HTML principal com tags SEO e Open Graph
├── LICENSE                     # Licença MIT do projeto
├── metadata.json               # Metadados da plataforma
├── package.json                # Dependências do projeto e scripts
├── README.md                   # Documentação detalhada da aplicação
├── server.ts                   # Servidor Express com rotas de API e proxy Gemini
├── tsconfig.json               # Configurações do compilador TypeScript
└── vite.config.ts              # Configurações de build e servidores Vite
```

---

## ⚡ Como Instalar e Executar Localmente

### Pré-requisitos
- **Node.js** v18 ou superior instalado
- **npm** ou **yarn** instalado
- Chave de API do **Google Gemini** (`GEMINI_API_KEY`)

### Passo a Passo

1. **Clonar o Repositório**:
   ```bash
   git clone https://github.com/seu-usuario/assistente-escrita.git
   cd assistente-escrita
   ```

2. **Instalar Dependências**:
   ```bash
   npm install
   ```

3. **Configurar Variáveis de Ambiente**:
   Crie um arquivo `.env` baseado no `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Preencha no arquivo `.env`:
   ```env
   GEMINI_API_KEY="SuaChaveDeAPIDoGeminiAqui"
   APP_URL="http://localhost:3000"
   ```

4. **Executar em Modo de Desenvolvimento**:
   ```bash
   npm run dev
   ```
   Acesse a aplicação em `http://localhost:3000`.

---

## 📦 Gerando Build de Produção

Para compilar a aplicação e gerar os artefatos otimizados:

```bash
npm run build
```

O comando irá:
1. Compilar o frontend React estático para a pasta `dist/`.
2. Empacotar o servidor backend TypeScript para `dist/server.cjs` utilizando o `esbuild`.

Para testar a versão de produção localmente:
```bash
npm run start
```

---

## 🚀 Publicação & Deploy

A aplicação está configurada para deploy simplificado em diversas plataformas:

### 1. Cloud Run / Docker
O servidor Express nativo no `dist/server.cjs` escuta na porta `3000` na interface `0.0.0.0`, tornando-o ideal para conteinerização no Google Cloud Run, AWS ECS ou Render.

### 2. Vercel / Netlify / Render
Defina as seguintes configurações de build na plataforma:
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Start Command**: `npm run start`
- **Environment Variables**: Adicione `GEMINI_API_KEY` nas configurações do projeto.

---

## 🔐 Segurança & Boas Práticas

- **Proteção de Chaves de API**: A chave do Gemini é processada exclusivamente no lado do servidor (`server.ts`), impedindo vazamento de credenciais no cliente HTTP.
- **Validação com Zod/TypeScript**: Tipagem estrita de payloads e respostas de API.
- **Regras do Firestore**: Proteção a nível de documento garantindo que cada usuário só acesse e modifique seu próprio histórico e perfil.

---

## 📄 Licença

Este projeto é distribuído sob os termos da licença **MIT**. Veja o arquivo [LICENSE](./LICENSE) para mais detalhes.

---

## ❓ Perguntas Frequentes (FAQ)

**1. O Gemini altera o sentido do meu texto?**  
Não. As instruções do sistema garantem a preservação de datas, números, nomes e a intenção original do usuário.

**2. Posso usar a plataforma sem conta?**  
Você pode realizar revisões imediatas no modo convidado. Para salvar o histórico e acumular créditos, basta realizar o login rápido com e-mail ou Google.

---

*Desenvolvido com foco em alta performance, usabilidade e design moderno.*
