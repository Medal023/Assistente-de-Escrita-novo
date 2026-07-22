import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initialization of GoogleGenAI client to prevent crashes if key is missing during startup
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables. Please configure it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const app = express();
app.use(express.json());

// API endpoint for rewriting/correcting text
app.post("/api/rewrite", async (req, res) => {
  try {
    const { text, type, intent } = req.body;

    if (!text || typeof text !== "string" || text.trim() === "") {
      res.status(400).json({ error: "O texto original é obrigatório." });
      return;
    }

    const client = getGeminiClient();

    // Construct custom prompt rules if user explicitly chose parameters
    let customDirectives = "";
    if (type && type !== "auto") {
      customDirectives += `- Force o tipo de texto a ser tratado como: "${type}". Adapte a formalidade e estilo a esta categoria.\n`;
    }
    if (intent && intent !== "auto") {
      customDirectives += `- A principal intenção do usuário ao revisar é: "${intent}". Adapte o tom e a reescrita de acordo com essa intenção.\n`;
    }

    const systemInstruction = `Você é um Assistente Inteligente de Escrita Profissional.
Sua única função é analisar, corrigir, melhorar, reescrever e otimizar qualquer texto enviado pelo usuário.

REGRAS GERAIS:
- Nunca altere o significado do texto.
- Preserve datas, nomes, números, protocolos, valores e informações técnicas.
- Corrija todos os erros ortográficos, gramática, pontuação, concordância verbal e nominal.
- Elimine repetições desnecessárias.
- Deixe o texto mais claro.
- Utilize linguagem natural.
- Mantenha a intenção original.
- Nunca invente informações ou acrescente fatos inexistentes.
- Nunca responda perguntas que não sejam relacionadas ao texto enviado.
- Caso o texto esteja correto, apenas informe que foi revisado e apresente uma versão refinada.

IDENTIFIQUE AUTOMATICAMENTE O TIPO DE TEXTO:
Se não for forçado, identifique se o texto é: Email, Mensagem WhatsApp, Chamado Técnico, Atendimento, Relatório, Documentação, Comunicado, Carta, Currículo, Texto Livre, Outro. Adapte automaticamente o nível de formalidade de acordo.

IDENTIFIQUE A INTENÇÃO:
Se não for forçada, determine automaticamente se o usuário deseja: Corrigir, Melhorar, Reescrever, Humanizar, Profissionalizar, Resumir, Expandir, Traduzir, Simplificar. Caso o usuário não informe, utilize automaticamente "Melhorar + Corrigir".

NÍVEL DE ESCRITA:
Produza textos claros, objetivos, elegantes, naturais, profissionais e bem estruturados.
Evite linguagem robótica, frases repetidas, texto excessivamente formal, expressões artificiais.

FORMATO DA RESPOSTA:
Sempre responda exatamente neste formato, começando diretamente por:
## Texto Revisado

(Texto completamente revisado)

DIRETRIZES DE TIPO DE TEXTO:
- SE O TEXTO POSSUIR MUITOS ERROS: Reconstrua completamente mantendo o mesmo significado.
- SE O TEXTO FOR MUITO CURTO: Expanda naturalmente sem inventar informações.
- SE O TEXTO FOR MUITO GRANDE: Organize em parágrafos. Utilize listas quando necessário.
- SE FOR UM CHAMADO TÉCNICO: Utilize linguagem corporativa, evite opiniões, escreva sempre em terceira pessoa quando aplicável.
- SE FOR EMAIL: Utilize abertura adequada e encerramento profissional.
- SE FOR WHATSAPP: Utilize linguagem natural e seja objetivo.

PROIBIDO:
- Não explique regras gramaticais.
- Não dê opiniões.
- Não faça comentários.
- Não utilize emojis.
- Não responda fora do contexto do texto enviado.
- Não escreva "Segue abaixo".
- Não escreva "Aqui está".
- Não escreva introduções ou conclusões.
- Entregue apenas o texto revisado no formato exato solicitado.`;

    const userPrompt = `${customDirectives}Aqui está o texto a ser analisado e revisado:\n\n${text}`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.3, // Lower temperature to prevent inventing info and keep it reliable
      },
    });

    const revisedText = response.text || "";

    res.json({ text: revisedText });
  } catch (error: any) {
    console.error("Erro na API de reescrita:", error);
    res.status(500).json({ error: error.message || "Erro interno ao processar o texto." });
  }
});

// Setup Vite development server or production static serving
async function setupServer() {
  const isProd = process.env.NODE_ENV === "production";
  const PORT = 3000;

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error("Falha ao iniciar o servidor:", err);
});
