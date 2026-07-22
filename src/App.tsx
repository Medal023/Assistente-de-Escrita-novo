import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Clipboard,
  Check,
  Trash2,
  History,
  ArrowRight,
  RotateCcw,
  Split,
  Info,
  BookOpen,
  ChevronRight,
  AlertCircle,
  FileText,
  User,
  Share2,
  RefreshCw,
  LogOut,
  Mail,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { TEXT_TYPES, INTENTS, RevisionItem, UserProfile } from "./types";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc } from "firebase/firestore";
import { sendEmailVerification } from "firebase/auth";

// Import custom modules
import Login from "./components/Login";
import Profile from "./components/Profile";
import Share from "./components/Share";

const EXAMPLES = [
  {
    title: "E-mail com erros",
    type: "Email",
    intent: "Profissionalizar",
    text: "fala carlos, td bem? o relatorio de vendas ta pronto mais tem uns erro nos numero que o marketing passo p gnt. vc consegue ver isso hj pq a diretoria quer isso logo se nao vai dar ruim. vlw abs"
  },
  {
    title: "WhatsApp confuso",
    type: "Mensagem WhatsApp",
    intent: "auto",
    text: "oi ana desculpa incomodar vc viu a mensagem q mandei pro cliente sobre a entrega de amanhã? ele falo q nao vai ta la p receber e agr?? sera que cancelo ou tento entregar msm assim me fala ai pfvr"
  },
  {
    title: "Chamado Técnico opinativo",
    type: "Chamado Técnico",
    intent: "Profissionalizar",
    text: "O sistema de login está uma porcaria total!! Toda vez que tento entrar dá erro 500. Acho que o servidor de vocês está caindo aos pedaços ou o desenvolvedor fez besteira na última atualização de ontem à noite. Consertem isso agora pois não consigo trabalhar assim!!!"
  },
  {
    title: "Texto curto para expandir",
    type: "Texto Livre",
    intent: "Expandir",
    text: "Fazer ata da reunião de hoje às 14h sobre novas metas."
  }
];

export default function App() {
  // Navigation states
  const [activeTab, setActiveTab] = useState<"writer" | "share" | "profile">("writer");

  // User auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(null);

  // Writer states
  const [originalText, setOriginalText] = useState("");
  const [revisedText, setRevisedText] = useState("");
  const [selectedType, setSelectedType] = useState("auto");
  const [selectedIntent, setSelectedIntent] = useState("auto");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [history, setHistory] = useState<RevisionItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Analisando texto...");

  // Visual Theme support (light vs dark)
  const [visualTheme, setVisualTheme] = useState<"light" | "dark">("dark");

  // INTERCEPT INVITATION LINK
  useEffect(() => {
    try {
      const match = window.location.pathname.match(/^\/invite\/([A-Z0-9]{8})/i);
      if (match) {
        const code = match[1].toUpperCase();
        localStorage.setItem("referred_by_invite_code", code);
        // Rewrite path dynamically for single-screen SPA elegance
        window.history.replaceState({}, document.title, "/");
        console.log("Código de convite interceptado e registrado:", code);
      }
    } catch (e) {
      console.error("Erro ao interceptar código de convite:", e);
    }
  }, []);

  // AUTH OBSERVER & AUTOMATIC TOKEN UPDATE
  useEffect(() => {
    let tokenInterval: NodeJS.Timeout | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoadingAuth(true);
      setCurrentUser(user);
      
      if (user) {
        const cacheKey = `user_profile_${user.uid}`;
        
        // 1. Instantly load from localStorage if available
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const data = JSON.parse(cached) as UserProfile;
            setUserProfile(data);
            setVisualTheme(data.theme || "dark");
          } catch (e) {
            console.warn("Erro ao ler cache do perfil:", e);
          }
        }

        // 2. Fetch fresh profile from Firestore
        try {
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setUserProfile(data);
            setVisualTheme(data.theme || "dark");
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } else {
            console.warn("Documento do perfil não encontrado na inicialização.");
            // Fallback generation if no cache
            if (!localStorage.getItem(cacheKey)) {
              const defaultProfile: UserProfile = {
                uid: user.uid,
                name: user.displayName?.split(" ")[0] || "Usuário",
                lastname: user.displayName?.split(" ").slice(1).join(" ") || "",
                email: user.email || "",
                phone: user.phoneNumber || "",
                photo: user.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80",
                provider: user.providerData?.[0]?.providerId || "password",
                emailVerified: user.emailVerified || false,
                phoneVerified: false,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                status: "active",
                role: "Free",
                plan: "Plano Gratuito",
                language: "pt",
                theme: "dark",
                inviteCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
                totalInvites: 0,
                shareCount: 0
              };
              setUserProfile(defaultProfile);
              setVisualTheme("dark");
              localStorage.setItem(cacheKey, JSON.stringify(defaultProfile));
            }
          }
        } catch (err) {
          console.warn("Erro ao buscar perfil atualizado do Firestore (pode estar offline):", err);
          
          // 3. Fallback if no profile is loaded yet
          setUserProfile(prev => {
            if (prev) return prev;
            const fallback: UserProfile = {
              uid: user.uid,
              name: user.displayName?.split(" ")[0] || "Usuário",
              lastname: user.displayName?.split(" ").slice(1).join(" ") || "",
              email: user.email || "",
              phone: user.phoneNumber || "",
              photo: user.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80",
              provider: user.providerData?.[0]?.providerId || "password",
              emailVerified: user.emailVerified || false,
              phoneVerified: false,
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
              status: "active",
              role: "Free",
              plan: "Plano Gratuito",
              language: "pt",
              theme: "dark",
              inviteCode: "OFFLINE",
              totalInvites: 0,
              shareCount: 0
            };
            localStorage.setItem(cacheKey, JSON.stringify(fallback));
            return fallback;
          });
        }

        // Setup Automatic Token Update interval (refresh every 30 mins)
        if (tokenInterval) clearInterval(tokenInterval);
        tokenInterval = setInterval(async () => {
          try {
            console.log("Atualizando token de sessão do Firebase Auth...");
            await user.getIdToken(true);
          } catch (e) {
            console.error("Falha ao atualizar token automaticamente:", e);
          }
        }, 1800000);
      } else {
        setUserProfile(null);
        if (tokenInterval) {
          clearInterval(tokenInterval);
          tokenInterval = null;
        }
      }
      setLoadingAuth(false);
    });

    return () => {
      unsubscribe();
      if (tokenInterval) clearInterval(tokenInterval);
    };
  }, []);

  // Sync visual theme with body class
  useEffect(() => {
    const root = document.getElementById("main-container");
    if (root) {
      if (visualTheme === "light") {
        root.classList.remove("dark");
        root.classList.add("light");
      } else {
        root.classList.remove("light");
        root.classList.add("dark");
      }
    }
  }, [visualTheme]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("escrita_profissional_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Erro ao carregar histórico do localStorage:", e);
    }
  }, []);

  // Save history to localStorage on change
  const saveHistory = (newHistory: RevisionItem[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("escrita_profissional_history", JSON.stringify(newHistory));
    } catch (e) {
      console.error("Erro ao salvar histórico no localStorage:", e);
    }
  };

  // Status updates during loading to entertain user
  useEffect(() => {
    if (!isLoading) return;
    const statuses = [
      "Analisando semântica e intenção...",
      "Ajustando concordância e regência verbal...",
      "Identificando jargões e polindo estilo...",
      "Finalizando revisão ortográfica...",
      "Garantindo tom e naturalidade..."
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % statuses.length;
      setLoadingStatus(statuses[idx]);
    }, 1500);

    return () => clearInterval(interval);
  }, [isLoading]);

  const handleRewrite = async () => {
    if (!originalText.trim()) return;

    setIsLoading(true);
    setError(null);
    setRevisedText("");

    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: originalText,
          type: selectedType,
          intent: selectedIntent
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao processar o texto no servidor.");
      }

      const data = await res.json();
      let cleaned = data.text;
      
      // Post-process the output: remove '## Texto Revisado' if present
      const marker = "## Texto Revisado";
      if (cleaned.includes(marker)) {
        cleaned = cleaned.substring(cleaned.indexOf(marker) + marker.length).trim();
      }

      setRevisedText(cleaned);

      // Save to history
      const newItem: RevisionItem = {
        id: Date.now().toString(),
        originalText,
        revisedText: cleaned,
        selectedType,
        selectedIntent,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + " - " + new Date().toLocaleDateString("pt-BR")
      };
      
      const updatedHistory = [newItem, ...history].slice(0, 50); // limit to 50 items
      saveHistory(updatedHistory);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Não foi possível conectar ao servidor de inteligência artificial.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!revisedText) return;
    try {
      await navigator.clipboard.writeText(revisedText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Falha ao copiar:", err);
    }
  };

  const loadExample = (ex: typeof EXAMPLES[0]) => {
    setOriginalText(ex.text);
    setSelectedType(ex.type);
    setSelectedIntent(ex.intent);
    setRevisedText("");
    setError(null);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = history.filter((item) => item.id !== id);
    saveHistory(filtered);
  };

  const clearAllHistory = () => {
    if (window.confirm("Deseja realmente limpar todo o histórico de revisões?")) {
      saveHistory([]);
    }
  };

  // Simple word and char count
  const wordCount = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = (text: string) => text.length;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
      setActiveTab("writer");
    } catch (err) {
      console.error("Erro ao realizar logout:", err);
    }
  };

  // Verify email manual trigger
  const handleRefreshEmailStatus = async () => {
    setVerificationError(null);
    setVerificationSuccess(null);
    if (!auth.currentUser) return;

    try {
      await auth.currentUser.reload();
      const updatedUser = auth.currentUser;
      setCurrentUser(updatedUser);

      if (updatedUser.emailVerified) {
        setVerificationSuccess("Status atualizado! Seu e-mail foi confirmado com sucesso.");
        // Sync to profile doc
        const userRef = doc(db, "users", updatedUser.uid);
        await updateDoc(userRef, { emailVerified: true });
        setUserProfile(prev => prev ? { ...prev, emailVerified: true } : null);
      } else {
        setVerificationError("O e-mail ainda consta como não confirmado. Aguarde alguns instantes e tente novamente.");
      }
    } catch (err: any) {
      console.error(err);
      setVerificationError("Erro ao verificar status: " + err.message);
    }
  };

  // Resend email verification
  const handleResendEmail = async () => {
    setVerificationError(null);
    setVerificationSuccess(null);
    if (!auth.currentUser) return;

    try {
      await sendEmailVerification(auth.currentUser);
      setVerificationSuccess("E-mail de confirmação reenviado com sucesso! Verifique sua caixa de entrada.");
    } catch (err: any) {
      console.error(err);
      setVerificationError("Erro ao reenviar e-mail: " + err.message);
    }
  };

  // Determine if email verification is completed or bypass is valid (Google and Phone loggers have auto-verified true status)
  const isEmailProvider = currentUser?.providerData?.some((p: any) => p.providerId === "password");
  const isEmailVerified = currentUser?.emailVerified || !isEmailProvider;

  // Render Loader Splash Screen
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-center p-6 text-white font-sans">
        <div className="w-10 h-10 rounded-full border-2 border-[#222] border-t-[#3B82F6] animate-spin mb-4" />
        <motion.h2 
          className="text-sm font-black uppercase text-slate-300"
          initial={{ opacity: 0.4, scale: 0.98 }}
          animate={{ 
            opacity: [0.4, 1, 0.4],
            scale: [0.98, 1, 0.98],
            letterSpacing: ["0.2em", "0.3em", "0.2em"]
          }}
          transition={{ 
            duration: 2.5, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          Carregando Plataforma
        </motion.h2>
      </div>
    );
  }

  // Render Login state if not authenticated
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] flex flex-col font-sans antialiased" id="main-container">
        <header className="h-16 flex items-center justify-between px-6 border-b border-[#262626] bg-[#0A0A0A]" id="guest-header">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping"></div>
            <span className="text-xs font-black tracking-widest uppercase text-white font-display">
              ASSISTENTE DE ESCRITA INTELIGENTE
            </span>
          </div>
        </header>

        <Login onLoginSuccess={(u) => setCurrentUser(u)} />

        <footer className="h-12 border-t border-[#262626] bg-[#0A0A0A] flex items-center justify-center text-[9px] font-mono opacity-30 mt-auto">
          SECURE_AUTH_LAYER_V2.0.4
        </footer>
      </div>
    );
  }

  // Render Verification Screen Guard if email not verified
  if (!isEmailVerified) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] flex flex-col font-sans antialiased" id="main-container">
        
        {/* HEADER */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-[#262626] bg-[#0A0A0A] shrink-0" id="verify-header">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-black tracking-widest uppercase text-white">
              VERIFICAÇÃO DE SEGURANÇA
            </span>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white uppercase font-black tracking-wider border border-[#222] px-3 py-1.5 rounded-sm"
          >
            <LogOut className="w-3 h-3" /> Sair
          </button>
        </header>

        {/* VERIFICATION FORM CARD */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0F0F0F] border-2 border-amber-900/40 rounded-xl p-8 text-center space-y-6">
            <div className="w-12 h-12 rounded-full bg-amber-950/40 text-amber-500 border border-amber-900/60 flex items-center justify-center mx-auto animate-bounce">
              <Mail className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h1 className="text-lg font-black uppercase tracking-widest text-white">
                Seu email ainda não foi confirmado.
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Para garantir a segurança da plataforma e evitar fraudes, enviamos um link de ativação para <strong className="text-slate-300 font-mono">{currentUser.email}</strong>. Clique no link para liberar o painel.
              </p>
            </div>

            {verificationError && (
              <div className="p-3 bg-red-950/20 border border-red-900/40 text-red-300 text-xs rounded-sm">
                {verificationError}
              </div>
            )}

            {verificationSuccess && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 text-xs rounded-sm">
                {verificationSuccess}
              </div>
            )}

            <div className="flex gap-3.5 pt-2">
              <button
                onClick={handleResendEmail}
                className="w-1/2 px-4 py-2.5 bg-[#121212] border border-[#262626] text-slate-300 hover:bg-[#1C1C1C] rounded-sm text-xs font-black uppercase tracking-widest transition-all"
              >
                Reenviar Email
              </button>
              <button
                onClick={handleRefreshEmailStatus}
                className="w-1/2 px-4 py-2.5 bg-amber-500 text-[#0A0A0A] hover:bg-amber-400 rounded-sm text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Atualizar Status
              </button>
            </div>
          </div>
        </div>

        <footer className="h-12 border-t border-[#262626] bg-[#0A0A0A] flex items-center justify-center text-[9px] font-mono opacity-30 mt-auto">
          EMAIL_VERIFY_GUARD_V1.1
        </footer>
      </div>
    );
  }

  // MAIN WRITER + NAV TABS INTERFACES
  return (
    <div className={`min-h-screen ${visualTheme === "light" ? "bg-[#F9FAFB] text-[#111827]" : "bg-[#0A0A0A] text-[#F5F5F5]"} flex flex-col font-sans antialiased`} id="main-container">
      
      {/* HEADER WITH REVOLUTIONARY TABS NAVIGATION */}
      <header className={`h-16 flex items-center justify-between px-4 sm:px-10 border-b ${visualTheme === "light" ? "border-slate-200 bg-white" : "border-[#262626] bg-[#0A0A0A]"} shrink-0 sticky top-0 z-40`} id="app-header">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 bg-[#3B82F6] rounded-full animate-pulse"></div>
          <div>
            <span className={`text-xs font-black tracking-[0.2em] uppercase font-display ${visualTheme === "light" ? "text-slate-800" : "text-white"}`}>
              ESCRITA PROFISSIONAL
            </span>
          </div>
        </div>

        {/* REUSABLE MAIN PANEL TABS NAV */}
        <nav className="hidden md:flex items-center bg-[#141414]/10 p-1 rounded-lg border border-[#222]/10" id="main-navigation-tabs">
          <button
            onClick={() => setActiveTab("writer")}
            className={`px-4 py-1.5 rounded-md text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "writer" 
                ? "bg-[#3B82F6] text-white shadow-md shadow-blue-500/20" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Escritor
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-1.5 rounded-md text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "profile" 
                ? "bg-[#3B82F6] text-white shadow-md shadow-blue-500/20" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Meu Perfil
          </button>
        </nav>

        {/* USER META */}
        <div className="flex items-center gap-3">
          {/* Mobile Tab Icons */}
          <div className="flex md:hidden items-center gap-1.5">
            <button 
              onClick={() => setActiveTab("writer")} 
              className={`p-1.5 rounded-sm ${activeTab === "writer" ? "bg-blue-950/40 text-blue-400" : "text-slate-500"}`}
              title="Escritor"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setActiveTab("profile")} 
              className={`p-1.5 rounded-sm ${activeTab === "profile" ? "bg-blue-950/40 text-blue-400" : "text-slate-500"}`}
              title="Meu Perfil"
            >
              <User className="w-4 h-4" />
            </button>
          </div>

          <div className="h-8 w-[1px] bg-slate-800 hidden sm:block"></div>

          {/* Quick history toggle inside editor context */}
          {activeTab === "writer" && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all border ${
                showHistory
                  ? "bg-[#3B82F6] border-[#3B82F6] text-white"
                  : visualTheme === "light" ? "bg-white border-slate-300 text-slate-600" : "bg-[#121212] border-[#262626] text-slate-300 hover:bg-[#1A1A1A]"
              }`}
              id="history-toggle-btn"
            >
              <History className="w-3 h-3" />
              <span className="hidden sm:inline">Histórico ({history.length})</span>
            </button>
          )}

          {/* User profile small representation */}
          <div className="relative group cursor-pointer" onClick={() => setActiveTab("profile")}>
            <img 
              src={userProfile?.photo || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80"} 
              alt="Avatar" 
              className="w-8 h-8 rounded-full border border-blue-500/40 object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6" id="workspace-main">
        
        <AnimatePresence mode="wait">
          
          {/* TAB 1: ORIGINAL WRITER ASSISTANT WORKSPACE */}
          {activeTab === "writer" && (
            <motion.div
              key="writer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* UPPER INFO BANNER */}
              <div className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                visualTheme === "light" ? "bg-slate-50 border-slate-200" : "bg-[#0F0F0F] border-[#262626]"
              }`} id="intro-banner">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg shrink-0 border ${
                    visualTheme === "light" ? "bg-white border-slate-200 text-blue-500" : "bg-[#1A1A1A] border-[#262626] text-[#3B82F6]"
                  }`}>
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm tracking-wide ${visualTheme === "light" ? "text-slate-800" : "text-slate-200"}`}>Como funciona?</h3>
                    <p className={`text-xs leading-relaxed mt-1 ${visualTheme === "light" ? "text-slate-500" : "text-slate-400"}`}>
                      Cole seu rascunho abaixo, configure as opções técnicas (Canal e Intenção) e clique em <span className={visualTheme === "light" ? "text-slate-800 font-bold" : "text-white font-semibold"}>PROCESSAR AGORA</span>. A Inteligência Artificial ajustará o tom, gramática e coerência perfeitamente.
                    </p>
                  </div>
                </div>
              </div>

              {/* WORKSPACE ROW */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch" id="workspace-grid">
                
                {/* HISTORY SIDE PANEL */}
                <AnimatePresence>
                  {showHistory && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className={`lg:col-span-3 border rounded-xl flex flex-col h-[400px] lg:h-[600px] overflow-hidden ${
                        visualTheme === "light" ? "bg-white border-slate-200" : "bg-[#0F0F0F] border-[#262626]"
                      }`}
                      id="history-drawer-panel"
                    >
                      <div className={`p-4 border-b flex items-center justify-between ${
                        visualTheme === "light" ? "bg-slate-50 border-slate-200" : "bg-[#141414] border-[#262626]"
                      }`}>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-slate-500" />
                          Histórico Recente
                        </h3>
                        {history.length > 0 && (
                          <button
                            onClick={clearAllHistory}
                            className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase tracking-wider flex items-center gap-1"
                            id="clear-all-history-btn"
                          >
                            <Trash2 className="w-3 h-3" />
                            Limpar
                          </button>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
                        {history.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
                            <ClockEmptyIcon className="w-8 h-8 mb-2 opacity-30" />
                            <p className="text-[11px] font-medium leading-relaxed">Nenhum texto revisado ainda.</p>
                          </div>
                        ) : (
                          history.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => {
                                setOriginalText(item.originalText);
                                setRevisedText(item.revisedText);
                                setSelectedType(item.selectedType);
                                setSelectedIntent(item.selectedIntent);
                                setError(null);
                              }}
                              className={`p-3 border rounded-lg cursor-pointer transition-all relative group ${
                                visualTheme === "light" 
                                  ? "bg-slate-50 border-slate-200 hover:border-blue-400" 
                                  : "bg-[#141414] border-[#262626] hover:border-[#3B82F6] hover:bg-[#1A1A1A]"
                              }`}
                            >
                              <button
                                onClick={(e) => deleteHistoryItem(item.id, e)}
                                className="absolute top-2 right-2 text-slate-500 hover:text-red-400 p-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity bg-[#222] border border-[#333]"
                                title="Excluir do histórico"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <div className="text-[9px] font-mono text-slate-500 mb-1">{item.timestamp}</div>
                              <p className={`text-xs font-medium truncate pr-5 ${visualTheme === "light" ? "text-slate-800" : "text-slate-300"}`}>
                                {item.originalText}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#1e1e1e] text-slate-400 font-bold uppercase tracking-wider border border-[#333]">
                                  {TEXT_TYPES.find((t) => t.value === item.selectedType)?.label || "Auto"}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-blue-950/40 text-blue-300 font-bold uppercase tracking-wider border border-blue-800/40">
                                  {INTENTS.find((i) => i.value === item.selectedIntent)?.label || "Melhorar"}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* MAIN WRITER WORKSPACE GRID */}
                <div className={`${showHistory ? "lg:col-span-9" : "lg:col-span-12"} grid grid-cols-1 md:grid-cols-2 gap-6`} id="editor-grid">
                  
                  {/* INPUT SIDE */}
                  <div className={`border rounded-xl p-5 flex flex-col h-[500px] lg:h-[600px] shadow-xs relative ${
                    visualTheme === "light" ? "bg-white border-slate-200" : "bg-[#0A0A0A] border-[#262626]"
                  }`} id="input-card">
                    <div className="flex items-center justify-between mb-4 shrink-0">
                      <h2 className="text-[11px] uppercase tracking-widest font-black text-slate-400 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#3B82F6]" />
                        Texto Original
                      </h2>
                      {originalText && (
                        <button
                          onClick={() => {
                            setOriginalText("");
                            setRevisedText("");
                            setError(null);
                          }}
                          className="text-[10px] uppercase tracking-wider text-slate-400 hover:text-red-400 font-bold flex items-center gap-1 transition-colors"
                          id="clear-input-btn"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Limpar tudo
                        </button>
                      )}
                    </div>

                    {/* Text Input Area */}
                    <div className="flex-1 relative mb-4">
                      <textarea
                        value={originalText}
                        onChange={(e) => {
                          setOriginalText(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder="Cole seu rascunho de texto aqui ou digite algo para começarmos a revisão..."
                        className={`w-full h-full resize-none border-0 p-0 focus:ring-0 focus:outline-hidden text-sm sm:text-base placeholder-slate-600 leading-relaxed font-light italic bg-transparent ${
                          visualTheme === "light" ? "text-slate-800" : "text-slate-300"
                        }`}
                        maxLength={10000}
                        id="original-textarea"
                      />
                      
                      {/* Visual Preset Choices inside empty state */}
                      {!originalText && (
                        <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center text-center px-4 pt-10">
                          <Sparkles className="w-6 h-6 text-[#3B82F6] mb-2 animate-bounce" />
                          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-4">Ou use um rascunho de exemplo abaixo:</p>
                          
                          {/* Presets Grid */}
                          <div className="grid grid-cols-2 gap-2.5 max-w-md pointer-events-auto">
                            {EXAMPLES.map((ex, idx) => (
                              <button
                                key={idx}
                                onClick={() => loadExample(ex)}
                                className={`p-2.5 border rounded-lg text-left text-xs transition-all flex flex-col justify-between h-20 ${
                                  visualTheme === "light" 
                                    ? "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300" 
                                    : "bg-[#0F0F0F] border-[#222] hover:bg-[#151515] hover:border-slate-700"
                                }`}
                              >
                                <span className={`font-bold block line-clamp-1 text-[11px] uppercase tracking-wide ${visualTheme === "light" ? "text-slate-700" : "text-slate-300"}`}>{ex.title}</span>
                                <span className="text-[10px] text-slate-500 block line-clamp-2 italic leading-normal mt-1">"{ex.text}"</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Controls and Selectors */}
                    <div className="border-t border-[#262626]/20 pt-4 shrink-0 space-y-4" id="input-controls">
                      
                      {/* Dropdowns */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                            Canal de Destino
                          </label>
                          <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="w-full bg-[#121212] border border-[#262626] rounded-lg px-2.5 py-2 text-xs font-bold text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6] cursor-pointer"
                            id="text-type-select"
                          >
                            {TEXT_TYPES.map((type) => (
                              <option key={type.value} value={type.value} className="bg-[#0A0A0A] text-slate-300">
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                            Objetivo / Intenção
                          </label>
                          <select
                            value={selectedIntent}
                            onChange={(e) => setSelectedIntent(e.target.value)}
                            className="w-full bg-[#121212] border border-[#262626] rounded-lg px-2.5 py-2 text-xs font-bold text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6] cursor-pointer"
                            id="intent-select"
                          >
                            {INTENTS.map((intent) => (
                              <option key={intent.value} value={intent.value} className="bg-[#0A0A0A] text-slate-300">
                                {intent.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Submit Action Block */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
                        <div className="flex space-x-3">
                          <span>{wordCount(originalText)} W</span>
                          <span>/</span>
                          <span>{charCount(originalText)} CH</span>
                        </div>
                        
                        <button
                          onClick={handleRewrite}
                          disabled={isLoading || !originalText.trim()}
                          className={`px-6 py-2.5 rounded-sm font-black text-xs uppercase tracking-widest transition-all ${
                            !originalText.trim()
                              ? "bg-[#161616] text-slate-600 border border-[#262626] cursor-not-allowed"
                              : "bg-[#F5F5F5] text-[#0A0A0A] border border-slate-300 hover:bg-white cursor-pointer active:scale-95 shadow-lg shadow-white/5"
                          }`}
                          id="rewrite-btn"
                        >
                          PROCESSAR AGORA
                        </button>
                      </div>

                    </div>
                  </div>

                  {/* OUTPUT SIDE */}
                  <div className={`border rounded-xl p-5 flex flex-col h-[500px] lg:h-[600px] shadow-xs relative ${
                    visualTheme === "light" ? "bg-slate-50 border-slate-200" : "bg-[#0D0D0D] border-[#262626]"
                  }`} id="output-card">
                    <div className="flex items-center justify-between mb-4 shrink-0">
                      <h2 className="text-[11px] uppercase tracking-widest font-black text-[#3B82F6]">
                        Texto Revisado
                      </h2>

                      <div className="flex items-center space-x-1.5">
                        {revisedText && (
                          <button
                            onClick={() => setDiffMode(!diffMode)}
                            className={`px-2.5 py-1.5 rounded-sm border text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                              diffMode
                                ? "bg-[#3B82F6] border-[#3B82F6] text-white"
                                : "bg-[#121212] border-[#262626] text-slate-400 hover:bg-[#1A1A1A] hover:text-white"
                            }`}
                            title="Comparar com original"
                            id="diff-mode-toggle"
                          >
                            <Split className="w-3 h-3" />
                            <span>Comparar</span>
                          </button>
                        )}

                        {revisedText && (
                          <button
                            onClick={handleCopy}
                            className={`flex items-center space-x-1 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all ${
                              isCopied
                                ? "bg-emerald-600 text-white border border-emerald-600"
                                : "bg-[#3B82F6] text-white hover:bg-blue-600 border border-[#3B82F6]"
                            }`}
                            id="copy-to-clipboard-btn"
                          >
                            {isCopied ? <Check className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />}
                            <span>{isCopied ? "COPIADO" : "COPIAR"}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bold Typography Header Accent */}
                    <div className="mb-4 shrink-0">
                      <h1 className={`text-[44px] sm:text-[54px] leading-none font-black tracking-tighter uppercase ${visualTheme === "light" ? "text-slate-800" : "text-white"}`}>
                        {isLoading ? (
                          <span>LENDO<span className="text-amber-500">.</span></span>
                        ) : revisedText ? (
                          <span>PRONTO<span className="text-[#3B82F6]">.</span></span>
                        ) : (
                          <span>AGUARDANDO<span className="text-slate-600">.</span></span>
                        )}
                      </h1>
                      <div className={`h-1 w-20 transition-all duration-500 ${isLoading ? "bg-amber-500" : revisedText ? "bg-[#3B82F6]" : "bg-slate-700"}`}></div>
                    </div>

                    {/* Output Content Container */}
                    <div className="flex-1 overflow-y-auto relative p-3 bg-[#0A0A0A] rounded-lg border border-[#222]">
                      
                      {/* Loader State with dark backdrop */}
                      {isLoading && (
                        <div className="absolute inset-0 bg-[#0A0A0A]/95 flex flex-col items-center justify-center text-center p-6 rounded-lg z-20">
                          <div className="w-10 h-10 rounded-full border-2 border-slate-800 border-t-[#3B82F6] animate-spin mb-4" />
                          <p className="text-[#F5F5F5] font-black text-xs uppercase tracking-wider">{loadingStatus}</p>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase font-mono">Processando com latência otimizada...</p>
                        </div>
                      )}

                      {/* Error State */}
                      {error && (
                        <div className="p-4 bg-red-950/40 border border-red-900/60 rounded-lg text-red-200 text-xs flex items-start gap-3">
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-bold text-red-400 uppercase tracking-wide mb-0.5">Falha de Processamento</h4>
                            <p className="text-slate-300 leading-relaxed">{error}</p>
                          </div>
                        </div>
                      )}

                      {/* Diff Comparison View */}
                      {revisedText && diffMode ? (
                        <div className="space-y-4 text-xs sm:text-sm leading-relaxed font-mono" id="diff-comparison-view">
                          <div>
                            <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest bg-red-950/50 border border-red-900/40 px-1.5 py-0.5 rounded-sm">Original</span>
                            <p className="mt-2 text-slate-400 line-through whitespace-pre-wrap p-2.5 bg-[#121212] border border-[#222] rounded-md">{originalText}</p>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/50 border border-emerald-900/40 px-1.5 py-0.5 rounded-sm">Revisado</span>
                            <p className="mt-2 text-slate-100 whitespace-pre-wrap p-2.5 bg-[#0F0F0F] border border-[#262626] rounded-md">{revisedText}</p>
                          </div>
                        </div>
                      ) : (
                        // Normal View: Stark, high-contrast monospace text representation
                        <div className="text-sm sm:text-base text-slate-200 leading-relaxed whitespace-pre-wrap select-text font-mono" id="clean-output-view">
                          {revisedText ? (
                            revisedText
                          ) : (
                            !isLoading && !error && (
                              <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 p-8 pt-12">
                                <BookOpen className="w-8 h-8 mb-2 opacity-20 text-[#3B82F6]" />
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nenhum resultado ainda</p>
                                <p className="text-[10px] text-slate-600 max-w-xs mt-1 leading-normal uppercase">Digite seu text original e acione o processamento.</p>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    {/* Guidelines context box */}
                    {revisedText && (
                      <div className="mt-3 bg-[#121212] border border-[#262626] rounded-lg p-3 flex items-start gap-2.5 shrink-0" id="tone-guidelines-bar">
                        <Info className="w-3.5 h-3.5 text-[#3B82F6] shrink-0 mt-0.5" />
                        <div className="text-[11px] text-slate-400 leading-normal">
                          <span className="font-bold text-slate-300 uppercase tracking-wider text-[9px] bg-[#222] px-1.5 py-0.5 rounded-sm mr-1.5 border border-[#333]">Regra de Canal</span>
                          {selectedType === "auto"
                            ? "O canal de comunicação foi autodetectado. O tom e a formalidade foram otimizados inteligentemente."
                            : `A reescrita foi moldada especificamente para o canal "${TEXT_TYPES.find((t) => t.value === selectedType)?.label}".`}
                        </div>
                      </div>
                    )}

                  </div>

                </div>

              </div>

              {/* BOTTOM METRICS AND RULES CARD */}
              <section className={`border rounded-xl p-5 sm:p-6 ${
                visualTheme === "light" ? "bg-white border-slate-200" : "bg-[#0F0F0F] border-[#262626]"
              }`} id="usage-principles">
                <h2 className={`text-xs font-black tracking-[0.2em] uppercase mb-4 flex items-center gap-2 ${
                  visualTheme === "light" ? "text-slate-800" : "text-slate-300"
                }`}>
                  <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
                  NOSSOS PRINCÍPIOS DE REVISÃO E PROCESSAMENTO
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className={`space-y-1.5 p-3.5 border rounded-lg transition-colors ${
                    visualTheme === "light" ? "bg-slate-50 border-slate-200" : "bg-[#141414] border-[#222] hover:border-[#333]"
                  }`}>
                    <h4 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                      visualTheme === "light" ? "text-slate-700" : "text-slate-300"
                    }`}>
                      <span className="w-1.5 h-1.5 bg-[#3B82F6] rounded-full" />
                      Preservação Absoluta
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed font-light">
                      A IA preserva integralmente datas, nomes, valores monetários, números, protocolos técnicos e a intenção de significado original do autor.
                    </p>
                  </div>
                  
                  <div className={`space-y-1.5 p-3.5 border rounded-lg transition-colors ${
                    visualTheme === "light" ? "bg-slate-50 border-slate-200" : "bg-[#141414] border-[#222] hover:border-[#333]"
                  }`}>
                    <h4 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                      visualTheme === "light" ? "text-slate-700" : "text-slate-300"
                    }`}>
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      Foco em Correção
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed font-light">
                      Prioriza rigorosamente a correção ortográfica, regência e concordância verbal e nominal, aplicando as melhores práticas gramaticais da língua portuguesa.
                    </p>
                  </div>

                  <div className={`space-y-1.5 p-3.5 border rounded-lg transition-colors ${
                    visualTheme === "light" ? "bg-slate-50 border-slate-200" : "bg-[#141414] border-[#222] hover:border-[#333]"
                  } sm:col-span-2 lg:col-span-1`}>
                    <h4 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                      visualTheme === "light" ? "text-slate-700" : "text-slate-300"
                    }`}>
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Adequação de Canal
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed font-light">
                      Tratamento sob medida: canais corporativos como E-mail e Chamados recebem tons polidos e profissionais, enquanto mensagens instantâneas prezam pela fluidez natural.
                    </p>
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {/* TAB 2: COMPARTILHAR METRICS & REFERRALS BOARD */}
          {activeTab === "share" && (
            <motion.div
              key="share"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Share 
                currentUser={currentUser} 
                userProfile={userProfile} 
                onProfileUpdate={(updated) => {
                  setUserProfile(updated);
                  localStorage.setItem(`user_profile_${currentUser.uid}`, JSON.stringify(updated));
                }} 
              />
            </motion.div>
          )}

          {/* TAB 3: MEU PERFIL EDIT & SESSIONS LIST */}
          {activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Profile 
                currentUser={currentUser} 
                userProfile={userProfile} 
                onProfileUpdate={(updated) => {
                  setUserProfile(updated);
                  localStorage.setItem(`user_profile_${currentUser.uid}`, JSON.stringify(updated));
                }} 
                onLogout={handleLogout}
                onThemeToggle={(newTheme) => setVisualTheme(newTheme)}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* FOOTER INFO BAR */}
      <footer className={`h-12 border-t flex flex-col sm:flex-row items-center px-6 sm:px-10 gap-4 sm:gap-10 shrink-0 py-2 sm:py-0 ${
        visualTheme === "light" ? "border-slate-200 bg-white" : "border-[#262626] bg-[#0A0A0A]"
      }`} id="app-footer">
        <div className="flex gap-4 sm:gap-6">
          <span className="text-[9px] uppercase tracking-widest font-bold opacity-40">Ortografia: Corrigida</span>
          <span className="text-[9px] uppercase tracking-widest font-bold opacity-40">Gramática: Otimizada</span>
          <span className="text-[9px] uppercase tracking-widest font-bold opacity-40">Segurança: Ativa</span>
        </div>
        <div className="sm:ml-auto text-[9px] font-mono opacity-30">
          BRAZILIAN_PORTUGUESE_ENGINE_V2.0.4
        </div>
      </footer>
    </div>
  );
}

// Simple placeholder icon for empty clock / history
function ClockEmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
