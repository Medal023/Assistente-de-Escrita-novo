import React, { useState, useEffect } from "react";
import { 
  auth, 
  googleProvider, 
  db,
  signInWithPopup, 
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "../firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  sendEmailVerification,
  ConfirmationResult
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc 
} from "firebase/firestore";
import { 
  Sparkles, 
  Mail, 
  Lock, 
  Phone, 
  User, 
  ArrowRight, 
  Check, 
  AlertCircle, 
  Info, 
  ShieldCheck,
  Eye,
  EyeOff
} from "lucide-react";
import { UserProfile } from "../types";

// Helper to generate a random 8-char invite code
function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Simple browser metadata detector for session logging
function getBrowserMetadata() {
  const ua = navigator.userAgent;
  let browser = "Navegador Desconhecido";
  let os = "OS Desconhecido";
  let device = "Desktop";

  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Edge")) browser = "Edge";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) { os = "Android"; device = "Mobile"; }
  else if (ua.includes("iPhone") || ua.includes("iPad")) { os = "iOS"; device = "Mobile"; }

  return { browser, os, device };
}

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register" | "phone">("login");
  
  // Credentials Login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Registration Form
  const [regName, setRegName] = useState("");
  const [regLastname, setRegLastname] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPhoto, setRegPhoto] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  // Phone Login OTP
  const [phoneNum, setPhoneNum] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Password Recovery
  const [forgotPassword, setForgotPassword] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Recaptcha for phone sign in
  useEffect(() => {
    if (activeTab === "phone" && !otpSent) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
          callback: () => {
            // recaptcha solved
          }
        });
      } catch (err) {
        console.error("Erro ao inicializar Recaptcha Verifier:", err);
      }
    }
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [activeTab, otpSent]);

  const logAudit = async (uid: string, action: string, details: string) => {
    try {
      await addDoc(collection(db, "audit_logs"), {
        uid,
        action,
        details,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Erro ao registrar log de auditoria:", e);
    }
  };

  const createSession = async (uid: string) => {
    try {
      const { browser, os, device } = getBrowserMetadata();
      await addDoc(collection(db, "sessions"), {
        uid,
        device,
        os,
        browser,
        date: new Date().toLocaleString("pt-BR"),
        ip: "127.0.0.1", // Standard proxy IP or mock
        current: true
      });
    } catch (e) {
      console.error("Erro ao criar registro de sessão:", e);
    }
  };

  const handleCreateOrUpdateUserProfile = async (user: any, nameVal = "", lastnameVal = "", phoneVal = "", photoVal = "") => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    // Get referrer code from local storage
    const referredByCode = localStorage.getItem("referred_by_invite_code") || undefined;

    if (!userSnap.exists()) {
      // Create profile structure
      const newProfile: UserProfile = {
        uid: user.uid,
        name: nameVal || user.displayName?.split(" ")[0] || "Usuário",
        lastname: lastnameVal || user.displayName?.split(" ").slice(1).join(" ") || "",
        email: user.email || "",
        phone: phoneVal || user.phoneNumber || "",
        photo: photoVal || user.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
        provider: user.providerData?.[0]?.providerId || "email",
        emailVerified: user.emailVerified,
        phoneVerified: !!user.phoneNumber,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        status: "active",
        role: "Free",
        plan: "Plano Gratuito",
        language: "pt",
        theme: "dark",
        inviteCode: generateInviteCode(),
        referredBy: referredByCode,
        totalInvites: 0,
        shareCount: 0
      };

      await setDoc(userRef, newProfile);
      await logAudit(user.uid, "Register", `Conta cadastrada via ${newProfile.provider}`);

      // Handle referral stats updates
      if (referredByCode) {
        try {
          // Increment referrer invites
          // We can write a quick update after registering
          await addDoc(collection(db, "shared_links"), {
            referrerUid: referredByCode,
            referredUid: user.uid,
            date: new Date().toISOString(),
            origin: "CopyLink"
          });
        } catch (err) {
          console.error("Erro ao registrar estatísticas de convite:", err);
        }
      }

    } else {
      // Update profile
      const currentData = userSnap.data();
      const updates: Partial<UserProfile> = {
        lastLogin: new Date().toISOString(),
        emailVerified: user.emailVerified
      };
      // If photo changed/was empty
      if (!currentData.photo && user.photoURL) updates.photo = user.photoURL;
      if (!currentData.name && user.displayName) updates.name = user.displayName.split(" ")[0];

      await updateDoc(userRef, updates);
      await logAudit(user.uid, "Login", `Login bem sucedido via ${currentData.provider}`);
    }

    await createSession(user.uid);
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await handleCreateOrUpdateUserProfile(result.user);
      onLoginSuccess(result.user);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao autenticar com Google: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Update or verification check
      await handleCreateOrUpdateUserProfile(result.user);
      onLoginSuccess(result.user);
    } catch (err: any) {
      console.error(err);
      setError("Falha no login: verifique suas credenciais. " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!regName.trim() || !regLastname.trim() || !regEmail.trim() || !regPassword) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError("As senhas informadas não coincidem.");
      return;
    }

    if (regPassword.length < 6) {
      setError("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    if (!acceptTerms || !acceptPrivacy) {
      setError("Você deve aceitar os Termos de Uso e a Política de Privacidade para continuar.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      
      // Send Verification Email immediately
      await sendEmailVerification(result.user);

      // Create profile structure
      await handleCreateOrUpdateUserProfile(
        result.user, 
        regName, 
        regLastname, 
        regPhone, 
        regPhoto
      );

      setSuccessMsg("Cadastro realizado com sucesso! Enviamos um link de confirmação para o seu e-mail.");
      
      // Clear registration inputs
      setRegName("");
      setRegLastname("");
      setRegEmail("");
      setRegPhone("");
      setRegPassword("");
      setRegConfirmPassword("");
      
      // Auto switch to login
      setActiveTab("login");
    } catch (err: any) {
      console.error(err);
      setError("Falha ao registrar: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phoneNum) {
      setError("Informe o número do celular com o código de área nacional e DDI (+55).");
      return;
    }

    setIsLoading(true);
    try {
      const appVerifier = window.recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phoneNum, appVerifier);
      setConfirmationResult(result);
      setOtpSent(true);
      setSuccessMsg("Código enviado via SMS! Digite-o abaixo.");
    } catch (err: any) {
      console.error(err);
      setError("Falha ao enviar SMS: verifique o formato do número (ex: +5511999999999). " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otpCode || !confirmationResult) return;

    setIsLoading(true);
    try {
      const result = await confirmationResult.confirm(otpCode);
      await handleCreateOrUpdateUserProfile(result.user);
      onLoginSuccess(result.user);
    } catch (err: any) {
      console.error(err);
      setError("Código de verificação SMS inválido ou expirado.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRecoverySuccess(false);

    if (!recoveryEmail) {
      setError("Por favor, digite seu e-mail cadastrado.");
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, recoveryEmail);
      setRecoverySuccess(true);
      setSuccessMsg("Enviamos um link de redefinição de senha para o seu e-mail.");
    } catch (err: any) {
      console.error(err);
      setError("Erro ao solicitar redefinição: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-8" id="login-module-container">
      <div className="w-full max-w-lg bg-[#0F0F0F] border-2 border-[#262626] rounded-xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        
        {/* Recaptcha hidden anchor */}
        <div id="recaptcha-container"></div>

        {/* LOGO AREA */}
        <div className="flex flex-col items-center text-center mb-8 shrink-0">
          <div className="w-12 h-12 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white shadow-lg shadow-blue-500/20 mb-3 animate-pulse">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black font-display text-white tracking-widest uppercase">
            IDENTIFICAÇÃO
          </h1>
          <p className="text-[10px] text-slate-500 tracking-wider uppercase font-semibold mt-1">
            Acesse para liberar revisão profissional instantânea
          </p>
        </div>

        {/* ERROR / SUCCESS FEEDBACKS */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-900/60 rounded-sm text-red-200 text-xs flex items-start gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase tracking-wider text-red-400">Falha na Operação</p>
              <p className="mt-0.5 leading-relaxed text-slate-300">{error}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-950/40 border border-emerald-900/60 rounded-sm text-emerald-200 text-xs flex items-start gap-2.5">
            <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase tracking-wider text-emerald-400">Mensagem do Sistema</p>
              <p className="mt-0.5 leading-relaxed text-slate-300">{successMsg}</p>
            </div>
          </div>
        )}

        {/* FORGOT PASSWORD VIEW OVERLAY */}
        {forgotPassword ? (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <h3 className="text-sm font-black tracking-widest uppercase text-white mb-2">Recuperar Senha</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Digite seu e-mail cadastrado abaixo e lhe enviaremos as instruções de redefinição de acesso.
            </p>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">E-mail Cadastrado</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="exemplo@empresa.com"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  className="w-full bg-[#121212] border border-[#262626] rounded-md pl-10 pr-4 py-2.5 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  setForgotPassword(false);
                  setRecoverySuccess(false);
                  setSuccessMsg(null);
                }}
                className="w-1/2 px-4 py-2.5 bg-[#141414] border border-[#262626] rounded-sm text-xs font-bold uppercase tracking-widest text-slate-400 hover:bg-[#1C1C1C] hover:text-white transition-colors"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="w-1/2 px-4 py-2.5 bg-[#F5F5F5] hover:bg-white text-[#0A0A0A] rounded-sm text-xs font-black uppercase tracking-widest transition-all"
              >
                {isLoading ? "Enviando..." : "Solicitar Link"}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* TABS NAVIGATION */}
            <div className="flex border-b border-[#262626] mb-6" id="auth-tabs">
              <button
                onClick={() => { setActiveTab("login"); setError(null); }}
                className={`w-1/3 pb-3 text-xs font-bold uppercase tracking-widest text-center transition-colors relative ${
                  activeTab === "login" ? "text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Entrar
                {activeTab === "login" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6]" />}
              </button>
              <button
                onClick={() => { setActiveTab("register"); setError(null); }}
                className={`w-1/3 pb-3 text-xs font-bold uppercase tracking-widest text-center transition-colors relative ${
                  activeTab === "register" ? "text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Cadastrar
                {activeTab === "register" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6]" />}
              </button>
              <button
                onClick={() => { setActiveTab("phone"); setError(null); }}
                className={`w-1/3 pb-3 text-xs font-bold uppercase tracking-widest text-center transition-colors relative ${
                  activeTab === "phone" ? "text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Celular
                {activeTab === "phone" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6]" />}
              </button>
            </div>

            {/* LOGIN FORM */}
            {activeTab === "login" && (
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">E-mail Corporativo</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#121212] border border-[#262626] rounded-md pl-10 pr-4 py-2.5 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Senha</label>
                    <button
                      type="button"
                      onClick={() => setForgotPassword(true)}
                      className="text-[10px] text-[#3B82F6] hover:underline uppercase font-bold tracking-wider"
                    >
                      Esqueceu?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="******"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#121212] border border-[#262626] rounded-md pl-10 pr-10 py-2.5 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-[#F5F5F5] hover:bg-white text-[#0A0A0A] rounded-sm text-xs font-black uppercase tracking-widest transition-all mt-6 shadow-md shadow-white/5"
                >
                  {isLoading ? "Autenticando..." : "Entrar com Credenciais"}
                </button>
              </form>
            )}

            {/* REGISTER FORM */}
            {activeTab === "register" && (
              <form onSubmit={handleEmailRegister} className="space-y-3 max-h-[420px] overflow-y-auto pr-2 scrollbar-thin">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome *</label>
                    <input
                      type="text"
                      required
                      placeholder="João"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sobrenome *</label>
                    <input
                      type="text"
                      required
                      placeholder="Silva"
                      value={regLastname}
                      onChange={(e) => setRegLastname(e.target.value)}
                      className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">E-mail Corporativo *</label>
                  <input
                    type="email"
                    required
                    placeholder="joao@empresa.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Celular (com DDI)</label>
                    <input
                      type="tel"
                      placeholder="+5511999999999"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Foto URL (opcional)</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={regPhoto}
                      onChange={(e) => setRegPhoto(e.target.value)}
                      className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Senha *</label>
                    <input
                      type="password"
                      required
                      placeholder="Mínimo 6 dígitos"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Confirmar Senha *</label>
                    <input
                      type="password"
                      required
                      placeholder="Mínimo 6 dígitos"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
                    />
                  </div>
                </div>

                {/* Terms of Service Consent */}
                <div className="space-y-2 pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-0.5 rounded-sm border-slate-700 bg-slate-900 text-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                    />
                    <span className="text-[10px] text-slate-400 leading-normal">
                      Aceito os <span className="text-white hover:underline">Termos de Uso</span> da Plataforma e de tratamento de dados.
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptPrivacy}
                      onChange={(e) => setAcceptPrivacy(e.target.checked)}
                      className="mt-0.5 rounded-sm border-slate-700 bg-slate-900 text-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                    />
                    <span className="text-[10px] text-slate-400 leading-normal">
                      Aceito a <span className="text-white hover:underline">Política de Privacidade</span> e concordo em receber notificações importantes.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !acceptTerms || !acceptPrivacy}
                  className={`w-full py-2.5 rounded-sm text-xs font-black uppercase tracking-widest transition-all mt-4 ${
                    (!acceptTerms || !acceptPrivacy)
                      ? "bg-[#181818] text-slate-600 border border-[#262626] cursor-not-allowed"
                      : "bg-[#F5F5F5] hover:bg-white text-[#0A0A0A] cursor-pointer"
                  }`}
                >
                  {isLoading ? "Criando conta..." : "Criar Conta Profissional"}
                </button>
              </form>
            )}

            {/* PHONE OTP SMS FORM */}
            {activeTab === "phone" && (
              <div className="space-y-4 animate-fadeIn">
                {!otpSent ? (
                  <form onSubmit={handleSendOTP} className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Número de Celular (com DDI)</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input
                          type="tel"
                          required
                          placeholder="+5511999999999"
                          value={phoneNum}
                          onChange={(e) => setPhoneNum(e.target.value)}
                          className="w-full bg-[#121212] border border-[#262626] rounded-md pl-10 pr-4 py-2.5 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 block">Escreva o formato internacional com o código do país (DDI 55).</span>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 bg-[#F5F5F5] hover:bg-white text-[#0A0A0A] rounded-sm text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-white/5"
                    >
                      {isLoading ? "Enviando..." : "Enviar Código SMS"}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOTP} className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Código de Verificação de 6 dígitos</label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          required
                          placeholder="123456"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          className="w-full bg-[#121212] border border-[#262626] rounded-md pl-10 pr-4 py-2.5 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setConfirmationResult(null);
                        }}
                        className="w-1/2 px-4 py-2.5 bg-[#141414] border border-[#262626] rounded-sm text-xs font-bold uppercase tracking-widest text-slate-400 hover:bg-[#1C1C1C] hover:text-white transition-colors"
                      >
                        Reiniciar
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-1/2 px-4 py-2.5 bg-[#F5F5F5] hover:bg-white text-[#0A0A0A] rounded-sm text-xs font-black uppercase tracking-widest transition-all"
                      >
                        {isLoading ? "Verificando..." : "Confirmar e Entrar"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* THIRD-PARTY SOCIAL LOGINS ACCENT */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#262626]"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0F0F0F] px-3 text-[10px] text-slate-500 font-bold tracking-widest">Ou continue com</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-3 bg-[#121212] hover:bg-[#1A1A1A] text-slate-300 hover:text-white border border-[#262626] rounded-sm text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Google Workspace
            </button>
          </>
        )}
      </div>
    </div>
  );
}
