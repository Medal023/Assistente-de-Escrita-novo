import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc 
} from "firebase/firestore";
import { 
  Share2, 
  Copy, 
  QrCode, 
  Check, 
  Users, 
  TrendingUp, 
  Calendar, 
  Gift, 
  Award, 
  CheckCircle,
  Clock,
  Send
} from "lucide-react";
import { UserProfile, InviteRecord } from "../types";

interface ShareProps {
  currentUser: any;
  userProfile: UserProfile | null;
  onProfileUpdate: (updatedProfile: UserProfile) => void;
}

export default function Share({ currentUser, userProfile, onProfileUpdate }: ShareProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [invitedUsers, setInvitedUsers] = useState<any[]>([]);
  const [totalSharesCount, setTotalSharesCount] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [lastShareDate, setLastShareDate] = useState<string | null>(null);
  const [emailToShare, setEmailToShare] = useState("");
  const [emailShareSuccess, setEmailShareSuccess] = useState(false);

  // Construct invite URL dynamically using window origin and current inviteCode
  const inviteCode = userProfile?.inviteCode || "ABCD1234";
  const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;

  useEffect(() => {
    const fetchReferralStats = async () => {
      if (!currentUser || !userProfile) return;
      try {
        // Query shared_links where referrerUid equals current user's inviteCode OR uid
        const q = query(
          collection(db, "shared_links"), 
          where("referrerUid", "==", inviteCode)
        );
        const snap = await getDocs(q);
        const list: any[] = [];
        let completedReg = 0;
        let lastDate: string | null = null;

        snap.forEach((d) => {
          const data = d.data();
          list.push({ id: d.id, ...data });
          if (data.referredUid) completedReg++;
          if (data.date) {
            if (!lastDate || new Date(data.date) > new Date(lastDate)) {
              lastDate = data.date;
            }
          }
        });

        setInvitedUsers(list);
        setTotalSharesCount(snap.size || userProfile.shareCount || 0);
        
        // Conversion rate: completed registrations / total shares
        const rate = snap.size > 0 ? Math.round((completedReg / snap.size) * 100) : 0;
        setConversionRate(rate);
        
        if (lastDate) {
          setLastShareDate(new Date(lastDate).toLocaleString("pt-BR"));
        }
      } catch (err) {
        console.error("Erro ao carregar dados de compartilhamento:", err);
      }
    };

    fetchReferralStats();
  }, [currentUser, userProfile]);

  const logShare = async (platform: string) => {
    if (!currentUser || !userProfile) return;
    try {
      // Record in firestore
      await addDoc(collection(db, "shared_links"), {
        referrerUid: inviteCode,
        date: new Date().toISOString(),
        origin: platform
      });

      // Increment profile count
      const updatedShares = (userProfile.shareCount || 0) + 1;
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { shareCount: updatedShares });
      onProfileUpdate({ ...userProfile, shareCount: updatedShares });

      setTotalSharesCount(prev => prev + 1);
      setLastShareDate(new Date().toLocaleString("pt-BR"));

      // Audit logs
      await addDoc(collection(db, "audit_logs"), {
        uid: currentUser.uid,
        action: "Share",
        details: `Link compartilhado via ${platform}`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Erro ao gravar compartilhamento:", e);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    logShare("CopyLink");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`Escreva melhor, corrija erros e refine o tom dos seus e-mails e mensagens com o Assistente Inteligente de Escrita! Cadastre-se por este link de convite: ${inviteUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
    logShare("WhatsApp");
  };

  const handleShareTelegram = () => {
    const text = encodeURIComponent(`Escreva melhor, corrija erros e refine o tom dos seus e-mails e mensagens com o Assistente Inteligente de Escrita! Cadastre-se por este link de convite:`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${text}`, "_blank");
    logShare("Telegram");
  };

  const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}`, "_blank");
    logShare("Facebook");
  };

  const handleShareX = () => {
    const text = encodeURIComponent(`Escreva melhor e refine seus e-mails profissionais com o Assistente Inteligente de Escrita! Cadastre-se com meu convite: `);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(inviteUrl)}`, "_blank");
    logShare("X");
  };

  const handleShareLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(inviteUrl)}`, "_blank");
    logShare("LinkedIn");
  };

  const handleShareEmailForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailToShare.trim()) return;

    // Simulate sending email (open mailto client with content pre-filled)
    const subject = encodeURIComponent("Convite para o Assistente Inteligente de Escrita");
    const body = encodeURIComponent(`Olá!\n\nEstou te convidando para conhecer o Assistente Inteligente de Escrita. Ele me ajuda a estruturar e-mails, revisar gramática com IA e humanizar o tom de mensagens profissionais.\n\nCrie sua conta gratuita aqui:\n${inviteUrl}\n\nAbraços!`);
    window.location.href = `mailto:${emailToShare}?subject=${subject}&body=${body}`;

    logShare("Email");
    setEmailShareSuccess(true);
    setEmailToShare("");
    setTimeout(() => setEmailShareSuccess(false), 3000);
  };

  // Gamification Milestones Calculation
  const milestones = [
    { target: 5, badge: "Bronze Ambassador", desc: "Convide 5 amigos e garanta bônus inicial" },
    { target: 10, badge: "Silver Ambassador", desc: "Convide 10 amigos e libere IA Avançada" },
    { target: 25, badge: "Gold Ambassador", desc: "Convide 25 amigos e garanta suporte premium" },
    { target: 50, badge: "Platinum Leader", desc: "Convide 50 amigos e ganhe isenção vitalícia" },
    { target: 100, badge: "Ultimate Writing Evangelist", desc: "Parceiro oficial do ecossistema" }
  ];

  const currentInvitesCount = invitedUsers.filter(u => u.referredUid).length;

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-2" id="share-module-container">
      
      {/* HEADER SECTION */}
      <div className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-6 sm:p-8 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="space-y-1.5 flex-1">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-blue-950/40 text-blue-300 text-[10px] font-black uppercase tracking-widest border border-blue-900/40">
            <Gift className="w-3 h-3 text-blue-400" />
            PROGRAMA DE AFILIADOS
          </div>
          <h2 className="text-xl font-black uppercase tracking-wider text-white">
            Compartilhe &amp; Recompense
          </h2>
          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            Convide seus amigos e colegas para utilizar o **Assistente Inteligente de Escrita**. Cada amigo cadastrado eleva o nível da sua conta para Premium gratuitamente!
          </p>
        </div>

        {/* INVITE CODE DISPLAY */}
        <div className="bg-[#121212] border border-[#262626] rounded-lg p-4 text-center min-w-[200px]">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Seu Código Único</p>
          <p className="text-2xl font-black text-white tracking-widest mt-0.5 select-all">{inviteCode}</p>
        </div>
      </div>

      {/* COMPARTILHAMENTO LINKS & ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* COMPARTILHAMENTO DIRETO */}
        <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-5 sm:p-6 space-y-5">
          <h3 className="text-xs font-black tracking-widest uppercase text-[#3B82F6]">Opções de Envio Rápido</h3>
          
          {/* LINK COPY */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Link de Convite</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs font-mono text-slate-300 focus:outline-hidden"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-[#F5F5F5] hover:bg-white text-[#0A0A0A] rounded-sm text-xs font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>

          {/* SOCIAL MEDIA BUTTONS */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enviar via Redes Sociais</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleShareWhatsApp}
                className="py-2.5 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-300 hover:text-emerald-200 border border-emerald-900/40 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
              >
                WhatsApp
              </button>
              <button
                onClick={handleShareTelegram}
                className="py-2.5 bg-sky-950/20 hover:bg-sky-900/30 text-sky-300 hover:text-sky-200 border border-sky-900/40 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
              >
                Telegram
              </button>
              <button
                onClick={handleShareFacebook}
                className="py-2.5 bg-blue-950/20 hover:bg-blue-900/30 text-blue-300 hover:text-blue-200 border border-blue-900/40 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
              >
                Facebook
              </button>
              <button
                onClick={handleShareX}
                className="py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-800 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
              >
                X (Twitter)
              </button>
              <button
                onClick={handleShareLinkedIn}
                className="py-2.5 bg-indigo-950/20 hover:bg-indigo-900/30 text-indigo-300 hover:text-indigo-200 border border-indigo-900/40 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all grid-col-span-2"
              >
                LinkedIn
              </button>
              <button
                onClick={() => setShowQr(!showQr)}
                className="py-2.5 bg-purple-950/20 hover:bg-purple-900/30 text-purple-300 hover:text-purple-200 border border-purple-900/40 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
              >
                <QrCode className="w-3.5 h-3.5" />
                QR CODE
              </button>
            </div>
          </div>

          {/* QR CODE DISPLAY BOX */}
          {showQr && (
            <div className="p-4 bg-[#121212] border border-[#262626] rounded-lg flex flex-col items-center text-center animate-fadeIn">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(inviteUrl)}`} 
                alt="QR Code de Convite"
                className="w-36 h-36 bg-white p-2 rounded-md shadow-md"
              />
              <p className="text-[10px] text-slate-400 mt-2 font-mono">Aponte a câmera para ler o convite</p>
            </div>
          )}

          {/* EMAIL DIRECT SHARE */}
          <form onSubmit={handleShareEmailForm} className="space-y-1.5 pt-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enviar por E-mail</p>
            <div className="flex gap-2">
              <input
                type="email"
                required
                placeholder="amigo@empresa.com"
                value={emailToShare}
                onChange={(e) => setEmailToShare(e.target.value)}
                className="flex-1 bg-[#121212] border border-[#262626] rounded-md px-3 py-2 text-xs text-slate-300 focus:outline-hidden"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#1C1C1C] hover:bg-[#2A2A2A] text-slate-300 rounded-sm text-xs font-black uppercase tracking-widest flex items-center gap-1 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar
              </button>
            </div>
            {emailShareSuccess && (
              <p className="text-[10px] text-emerald-400 font-bold">Cliente de e-mail acionado!</p>
            )}
          </form>

        </div>

        {/* STATS & METRICS */}
        <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-5 sm:p-6 space-y-6">
          <h3 className="text-xs font-black tracking-widest uppercase text-[#3B82F6]">Seu Desempenho</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[#121212] border border-[#202020] rounded-lg">
              <Share2 className="w-5 h-5 text-blue-400 mb-2" />
              <p className="text-2xl font-black text-white">{totalSharesCount}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Cliques Compartilhados</p>
            </div>

            <div className="p-4 bg-[#121212] border border-[#202020] rounded-lg">
              <Users className="w-5 h-5 text-emerald-400 mb-2" />
              <p className="text-2xl font-black text-white">{currentInvitesCount}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Cadastros Realizados</p>
            </div>

            <div className="p-4 bg-[#121212] border border-[#202020] rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-400 mb-2" />
              <p className="text-2xl font-black text-white">{conversionRate}%</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Conversão de Clientes</p>
            </div>

            <div className="p-4 bg-[#121212] border border-[#202020] rounded-lg flex flex-col justify-between">
              <Calendar className="w-5 h-5 text-amber-400 mb-1" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white truncate">{lastShareDate || "Nenhum ainda"}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Última Atividade</p>
              </div>
            </div>
          </div>

          {/* LIST OF REGISTERED REFERRALS */}
          {currentInvitesCount > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Inscrições com seu Convite</p>
              <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin">
                {invitedUsers.filter(u => u.referredUid).map((refUser, i) => (
                  <div key={i} className="flex justify-between items-center bg-[#141414] px-3 py-1.5 border border-[#222] rounded-md text-xs">
                    <span className="font-medium text-slate-300">Convidado {refUser.referredUid?.substring(0, 6)}</span>
                    <span className="text-[10px] text-slate-500">{new Date(refUser.date).toLocaleDateString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* GAMIFICATION / MILESTONES */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500 shrink-0" />
          <h3 className="text-xs font-black tracking-widest uppercase text-white">Progresso de Metas &amp; Conquistas</h3>
        </div>

        {/* PROGRESS BAR */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Seu Progresso: <strong className="text-white">{currentInvitesCount} convidados</strong></span>
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Próximo Nível</span>
          </div>
          <div className="w-full h-2.5 bg-[#141414] rounded-full overflow-hidden border border-[#2D2D2D]">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-[#3B82F6] to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min((currentInvitesCount / 100) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        {/* GRID OF BADGES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
          {milestones.map((mil, idx) => {
            const isUnlocked = currentInvitesCount >= mil.target;
            return (
              <div 
                key={idx}
                className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all ${
                  isUnlocked 
                    ? "bg-emerald-950/10 border-emerald-900/40 text-slate-200" 
                    : "bg-[#121212]/50 border-[#222] text-slate-500"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2.5 ${
                  isUnlocked ? "bg-emerald-500/20 text-emerald-400" : "bg-[#202020] text-slate-600"
                }`}>
                  {isUnlocked ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <h4 className="text-[11px] font-black uppercase tracking-wider leading-snug">{mil.badge}</h4>
                <span className="text-[9px] font-mono text-slate-500 mt-1">Meta: {mil.target} amigos</span>
                <p className="text-[9px] text-slate-400 leading-tight mt-1.5 text-center truncate w-full" title={mil.desc}>{mil.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
