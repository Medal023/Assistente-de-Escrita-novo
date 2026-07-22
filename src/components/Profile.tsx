import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { 
  updatePassword, 
  deleteUser, 
  reauthenticateWithCredential, 
  EmailAuthProvider 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc
} from "firebase/firestore";
import { 
  User, 
  ShieldAlert, 
  Trash2, 
  Globe, 
  Monitor, 
  LogOut, 
  Check, 
  AlertTriangle,
  Moon,
  Sun,
  Eye,
  EyeOff
} from "lucide-react";
import { UserProfile, UserSession } from "../types";

interface ProfileProps {
  currentUser: any;
  userProfile: UserProfile | null;
  onProfileUpdate: (updatedProfile: UserProfile) => void;
  onLogout: () => void;
  onThemeToggle: (theme: "light" | "dark") => void;
}

export default function Profile({ 
  currentUser, 
  userProfile, 
  onProfileUpdate, 
  onLogout,
  onThemeToggle
}: ProfileProps) {
  
  // Local editable states
  const [name, setName] = useState("");
  const [lastname, setLastname] = useState("");
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState("");
  const [language, setLanguage] = useState<"pt" | "en" | "es">("pt");
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Security credentials change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);

  // Sessions list
  const [sessions, setSessions] = useState<UserSession[]>([]);

  // Delete account confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  // UI state feedback
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name);
      setLastname(userProfile.lastname);
      setPhone(userProfile.phone);
      setPhoto(userProfile.photo);
      setLanguage(userProfile.language || "pt");
      setTheme(userProfile.theme || "dark");
    }
  }, [userProfile]);

  // Load Sessions
  const fetchSessions = async () => {
    if (!currentUser) return;
    try {
      const q = query(collection(db, "sessions"), where("uid", "==", currentUser.uid));
      const snap = await getDocs(q);
      const list: UserSession[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as UserSession);
      });
      setSessions(list);
    } catch (err) {
      console.error("Erro ao carregar sessões:", err);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [currentUser]);

  const logAudit = async (action: string, details: string) => {
    try {
      await addDoc(collection(db, "audit_logs"), {
        uid: currentUser.uid,
        action,
        details,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Erro ao gravar auditoria:", e);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const userRef = doc(db, "users", currentUser.uid);
      const updated: Partial<UserProfile> = {
        name,
        lastname,
        phone,
        photo,
        language,
        theme
      };

      await updateDoc(userRef, updated);
      onProfileUpdate({
        ...userProfile!,
        ...updated
      } as UserProfile);

      // Trigger visual theme toggle if changed
      onThemeToggle(theme);

      await logAudit("Update Profile", "Usuário alterou informações de perfil, idioma ou tema.");
      setSuccessMsg("Perfil atualizado com sucesso!");
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Erro ao salvar alterações: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword !== confirmPassword) {
      setErrorMsg("As novas senhas informadas não coincidem.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("A senha deve conter ao menos 6 caracteres.");
      return;
    }

    setIsLoading(true);
    try {
      // Reauthenticate user first
      const credential = EmailAuthProvider.credential(currentUser.email!, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      
      // Update
      await updatePassword(currentUser, newPassword);
      await logAudit("Change Password", "Usuário alterou a senha com reautenticação válida.");
      
      setSuccessMsg("Senha atualizada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordSection(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Falha na reautenticação ou troca de senha: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    try {
      await deleteDoc(doc(db, "sessions", sessionId));
      setSuccessMsg("Sessão encerrada com sucesso.");
      fetchSessions();
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Falha ao encerrar sessão: " + err.message);
    }
  };

  const terminateAllOtherSessions = async () => {
    try {
      const q = query(collection(db, "sessions"), where("uid", "==", currentUser.uid));
      const snap = await getDocs(q);
      snap.forEach(async (d) => {
        // We delete all sessions. (We can keep current session easily if we want, or clear all)
        await deleteDoc(doc(db, "sessions", d.id));
      });
      setSuccessMsg("Todas as sessões foram finalizadas.");
      setSessions([]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Falha ao limpar sessões: " + err.message);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      // Reauthenticate before destructive delete if provider is email
      if (userProfile?.provider === "password") {
        if (!deletePassword) {
          setErrorMsg("Digite sua senha atual para confirmar a exclusão da conta.");
          setIsLoading(false);
          return;
        }
        const credential = EmailAuthProvider.credential(currentUser.email!, deletePassword);
        await reauthenticateWithCredential(currentUser, credential);
      }

      // Delete from Firestore
      await deleteDoc(doc(db, "users", currentUser.uid));

      // Clean up audit logs or record last log before delete
      await logAudit("Delete Account", "Usuário excluiu permanentemente a conta e os dados associados.");

      // Terminate auth user
      await deleteUser(currentUser);
      onLogout();
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Erro ao reautenticar para exclusão: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-2" id="profile-module-container">
      
      {/* HEADER SECTION */}
      <div className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
        <div className="relative">
          <img 
            src={photo || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"} 
            alt="Avatar" 
            className="w-20 h-20 rounded-full border-2 border-[#3B82F6] object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-[#0F0F0F]">
            {userProfile?.role || "Free"}
          </div>
        </div>
        
        <div className="text-center sm:text-left flex-1 space-y-1">
          <h2 className="text-xl font-black uppercase tracking-wider text-white">
            {name} {lastname}
          </h2>
          <p className="text-xs text-slate-400 font-mono">{currentUser?.email}</p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#1A1A1A] text-slate-400 border border-[#333]">
              Provedor: {userProfile?.provider || "Email"}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-blue-950/50 text-blue-300 border border-blue-900/40">
              Plano: {userProfile?.plan || "Premium Starter"}
            </span>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 bg-[#1C1C1C] hover:bg-red-900/40 text-slate-400 hover:text-red-200 rounded-sm text-xs font-black uppercase tracking-wider border border-[#2D2D2D] transition-all shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          SAIR DA CONTA
        </button>
      </div>

      {/* ERROR / SUCCESS ALERTS */}
      {errorMsg && (
        <div className="p-4 bg-red-950/40 border border-red-900/60 rounded-sm text-red-200 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold uppercase tracking-wider text-red-400">Falha na Ação</h4>
            <p className="text-slate-300 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-900/60 rounded-sm text-emerald-200 text-xs flex items-start gap-2.5">
          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold uppercase tracking-wider text-emerald-400">Sucesso</h4>
            <p className="text-slate-300 mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      {/* PROFILE DETAILS CONFIG FORM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* EDIT PROFILE FORM */}
        <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-5 sm:p-6 space-y-4">
          <h3 className="text-xs font-black tracking-widest uppercase text-[#3B82F6]">Alterar Dados Básicos</h3>
          
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sobrenome</label>
                <input
                  type="text"
                  required
                  value={lastname}
                  onChange={(e) => setLastname(e.target.value)}
                  className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Telefone / Celular</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avatar URL</label>
              <input
                type="url"
                value={photo}
                onChange={(e) => setPhoto(e.target.value)}
                className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-medium text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[#3B82F6]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Idioma padrão</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="w-full bg-[#121212] border border-[#262626] rounded-md px-2.5 py-2 text-xs font-bold text-slate-300"
                >
                  <option value="pt" className="bg-[#0A0A0A]">Português</option>
                  <option value="en" className="bg-[#0A0A0A]">Inglês</option>
                  <option value="es" className="bg-[#0A0A0A]">Espanhol</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tema visual</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  className="w-full bg-[#121212] border border-[#262626] rounded-md px-2.5 py-2 text-xs font-bold text-slate-300"
                >
                  <option value="dark" className="bg-[#0A0A0A]">Escuro (Stark)</option>
                  <option value="light" className="bg-[#0A0A0A]">Claro (Classic)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 bg-[#F5F5F5] hover:bg-white text-[#0A0A0A] rounded-sm text-xs font-black uppercase tracking-widest transition-all"
            >
              {isLoading ? "Salvando..." : "Salvar Alterações"}
            </button>
          </form>
        </div>

        {/* SECURITY & SESSIONS INFO */}
        <div className="space-y-6">
          
          {/* PASSWORD RESET CARD */}
          {userProfile?.provider === "password" && (
            <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-5 sm:p-6 space-y-4">
              <h3 className="text-xs font-black tracking-widest uppercase text-[#3B82F6]">Segurança de Acesso</h3>
              
              {!showPasswordSection ? (
                <button
                  onClick={() => setShowPasswordSection(true)}
                  className="w-full py-2.5 bg-[#121212] border border-[#262626] rounded-sm text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-[#1A1A1A]"
                >
                  Alterar Senha da Conta
                </button>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Senha Atual</label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-medium text-slate-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nova Senha</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-medium text-slate-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Confirmar Nova</label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-medium text-slate-300"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPasswordSection(false)}
                      className="px-4 py-2 bg-[#121212] border border-[#262626] text-slate-400 text-xs font-bold uppercase tracking-wider hover:bg-[#1A1A1A]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 bg-[#F5F5F5] text-[#0A0A0A] text-xs font-black uppercase tracking-widest hover:bg-white"
                    >
                      {isLoading ? "Salvando..." : "Confirmar Senha"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* SESSIONS CONTROL CARD */}
          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black tracking-widest uppercase text-[#3B82F6]">Sessões Ativas ({sessions.length})</h3>
              {sessions.length > 1 && (
                <button
                  onClick={terminateAllOtherSessions}
                  className="text-[10px] font-bold text-red-500 uppercase hover:underline"
                >
                  Encerrar Todas
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
              {sessions.map((sess) => (
                <div key={sess.id} className="p-3 bg-[#121212] border border-[#262626] rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Monitor className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-300">{sess.browser} • {sess.os}</p>
                      <p className="text-[9px] text-slate-500 font-mono">{sess.date} {sess.ip !== "127.0.0.1" && `• IP: ${sess.ip}`}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => terminateSession(sess.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 border border-[#222] hover:border-red-900/40 rounded-sm bg-[#161616]"
                    title="Encerrar sessão"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* DANGEROUS ZONE: ACCOUNT DELETION */}
      <div className="bg-red-950/20 border-2 border-red-900/30 rounded-xl p-6 space-y-4">
        <h3 className="text-xs font-black tracking-widest uppercase text-red-400 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4" />
          ZONA DE PERIGO
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          Ao excluir permanentemente sua conta, todas as suas correções salvas, sessões, convites de recompensas e dados de perfil serão excluídos do sistema de forma imediata e definitiva. Esta ação é irreversível.
        </p>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-5 py-2.5 bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white border border-red-800/40 rounded-sm text-xs font-black uppercase tracking-widest transition-all"
          >
            Excluir Conta Permanentemente
          </button>
        ) : (
          <form onSubmit={handleDeleteAccount} className="space-y-4 max-w-md bg-[#0F0F0F] p-4 border border-red-900/40 rounded-lg">
            <h4 className="text-xs font-black text-white uppercase tracking-wider">Confirmar exclusão de dados</h4>
            
            {userProfile?.provider === "password" && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 font-medium">Insira sua senha de acesso para validação:</p>
                <input
                  type="password"
                  required
                  placeholder="Sua senha atual"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs text-slate-300"
                />
              </div>
            )}

            <p className="text-[10px] text-red-400 font-bold uppercase leading-normal">
              Esta ação será aplicada imediatamente e cancelará seu login definitivo.
            </p>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => { setConfirmDelete(false); setDeletePassword(""); }}
                className="px-4 py-2 bg-[#121212] border border-[#262626] text-slate-400 text-xs font-bold uppercase tracking-wider hover:bg-[#1A1A1A]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-colors"
              >
                {isLoading ? "Excluindo..." : "Confirmar Exclusão"}
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  );
}
