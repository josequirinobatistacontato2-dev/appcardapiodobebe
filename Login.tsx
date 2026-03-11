import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Sparkles, Shield, ChevronRight } from 'lucide-react';
import { useApp } from './App';
import { User } from './types';

export const Login = () => {
  const { setUser, theme, notify, signIn, solicitarResetSenha, verificarVendaParaPrimeiroAcesso, concluirPrimeiroAcesso } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    // O redirecionamento de recuperação agora é tratado globalmente no App.tsx
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'login' | 'first-access' | 'create-password' | 'forgot-password'>('login');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [resetCooldown, setResetCooldown] = useState(0);

  useEffect(() => {
    if (resetCooldown > 0) {
      const timer = setTimeout(() => setResetCooldown(resetCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resetCooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const eTrim = email.trim().toLowerCase();

    // ADMIN BYPASS
    if (eTrim === theme.adminEmail.toLowerCase() && password === 'admin123') {
      const adminUser: User = { 
        id: 'admin', 
        name: 'Master Admin', 
        email: eTrim, 
        role: 'admin', 
        status: 'active', 
        accessType: 'lifetime', 
        startDate: new Date().toISOString(), 
        purchasedProducts: [] 
      };
      setUser(adminUser);
      localStorage.setItem('bs_auth_user', JSON.stringify(adminUser));
      navigate('/admin');
      setLoading(false);
      return;
    }

    try {
      await signIn(eTrim, password);
      if (eTrim === theme.adminEmail.toLowerCase()) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      notify(err.message || 'Erro ao realizar login.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyFirstAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const emailLimpo = email.trim().toLowerCase();
      await verificarVendaParaPrimeiroAcesso(emailLimpo);
      notify('E-mail validado com sucesso! Agora crie sua senha.', 'success');
      setStep('create-password');
    } catch (err: any) {
      console.error('verificarVendaParaPrimeiroAcesso error:', err);
      notify(err.message || 'E-mail não encontrado ou sem acesso ativo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      notify('As senhas não coincidem.', 'error');
      return;
    }
    if (password.length < 6) {
      notify('A senha deve ter pelo menos 6 caracteres.', 'error');
      return;
    }

    setLoading(true);
    try {
      await concluirPrimeiroAcesso(email, password);
      notify('Senha criada com sucesso! Agora você pode fazer login.', 'success');
      setStep('login');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('concluirPrimeiroAcesso error:', err);
      
      const isAlreadyRegistered = err.message?.toLowerCase().includes('already registered') || 
                                 err.message?.toLowerCase().includes('already exists');

      if (isAlreadyRegistered) {
        // Tenta fazer login automaticamente com a senha fornecida
        try {
          await signIn(email, password);
          notify('Você já possuía uma conta e o acesso foi validado!', 'success');
          if (email.trim().toLowerCase() === theme.adminEmail.toLowerCase()) {
            navigate('/admin');
          } else {
            navigate('/dashboard');
          }
          return;
        } catch (loginErr) {
          // Se o login falhar, significa que a senha é diferente ou a conta está bloqueada
          notify('Você já possui uma conta cadastrada com uma senha diferente. Por favor, faça login ou recupere sua senha.', 'warning');
          setStep('login');
          setPassword('');
        }
      } else {
        notify(err.message || 'Erro ao criar senha. Tente novamente.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetCooldown > 0) {
      notify(`Aguarde ${resetCooldown}s para solicitar novamente.`, 'warning');
      return;
    }
    setLoading(true);
    try {
      await solicitarResetSenha(email.trim().toLowerCase());
      notify('Enviamos um email para você redefinir sua senha. Verifique também sua caixa de spam.', 'success');
      setStep('login');
      setResetCooldown(60); // Cooldown de 60s após sucesso para evitar spam
    } catch (err: any) {
      console.error('solicitarResetSenha error:', err);
      if (err.message?.includes('15 seconds')) {
        notify('Por segurança, aguarde 15 segundos antes de solicitar novamente.', 'warning');
        setResetCooldown(15);
      } else {
        notify(err.message || 'Erro ao solicitar recuperação de senha.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden bg-stone-100" style={{ backgroundColor: theme.backgroundColor }}>
      <div className="absolute inset-0 z-0">
         <picture className="w-full h-full">
           <source media="(max-width: 768px)" srcSet={theme.loginMobileImageUrl || theme.loginBannerUrl} />
           <img src={theme.loginBannerUrl} className="w-full h-full object-cover opacity-60" alt="Fundo" referrerPolicy="no-referrer" />
         </picture>
         <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]"></div>
      </div>
      
      <div className="hidden lg:block absolute left-32 top-[30%] z-20 max-w-2xl space-y-4 animate-in slide-in-from-left-20 duration-1000">
         <h1 className="text-white text-7xl font-black uppercase italic tracking-tighter leading-none drop-shadow-2xl">{theme.loginTagline}</h1>
         <div className="bg-black/20 backdrop-blur-md px-6 py-3 rounded-full inline-flex items-center gap-3 text-white font-bold text-xs uppercase tracking-widest"><Sparkles className="text-orange-500" size={16}/> {theme.loginSubTagline}</div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center lg:justify-end lg:pr-32 relative z-10 p-6 gap-10">
        <div className="lg:hidden text-center space-y-3 z-20 animate-in fade-in slide-in-from-top-10 duration-1000">
           <h1 className="text-white text-4xl font-black uppercase italic tracking-tighter leading-none drop-shadow-2xl">{theme.loginTagline}</h1>
           <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.2em]">{theme.loginSubTagline}</p>
        </div>

        <div className="w-full max-w-[400px] bg-white/10 backdrop-blur-2xl p-8 md:p-12 rounded-[60px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-white/20 text-center animate-in zoom-in-95 flex flex-col gap-8 relative overflow-hidden">
           {/* Progress Bar */}
           <div className="absolute top-0 left-0 w-full flex gap-1 p-4 px-10">
              <div className="h-1.5 flex-1 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
              <div className="h-1.5 flex-1 bg-white/20 rounded-full"></div>
              <div className="h-1.5 flex-1 bg-white/20 rounded-full"></div>
           </div>

           <div className="flex flex-col items-center justify-center text-center leading-none select-none mt-4">
              <span className="font-bold tracking-tight text-xl drop-shadow-sm" style={{ color: theme.secondaryColor }}>Cardápio do</span>
              <span className="font-black -mt-1 text-3xl drop-shadow-md" style={{ color: theme.secondaryColor }}>Bebê</span>
              <div className="mt-3 bg-[#5BA525] text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-[0.2em] shadow-lg">Saudável</div>
           </div>
           
           {step === 'login' ? (
             <form onSubmit={handleLogin} className="space-y-8">
                <div className="space-y-3">
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter text-stone-800 drop-shadow-sm">SEJA BEM-VINDA!</h2>
                  <p className="text-[11px] font-bold text-stone-600 uppercase tracking-widest leading-tight opacity-80">Insira suas credenciais para continuar</p>
                </div>
                <div className="space-y-5">
                   <div className="space-y-2 text-left">
                     <label className="text-[11px] font-black uppercase tracking-[0.15em] px-5" style={{ color: theme.secondaryColor }}>E-mail</label>
                     <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-white/90 p-6 rounded-full border-none font-bold text-center text-base shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] focus:ring-4 focus:ring-orange-500/20 outline-none transition-all placeholder:text-stone-300" placeholder="E-mail de Aluno" />
                   </div>
                   <div className="space-y-2 text-left">
                     <label className="text-[11px] font-black uppercase tracking-[0.15em] px-5" style={{ color: theme.secondaryColor }}>Senha</label>
                     <div className="relative">
                       <input type={showPass ? "text" : "password"} required value={password} onChange={e=>{setPassword(e.target.value); setPasswordError('');}} className={`w-full bg-white/90 p-6 rounded-full border-none font-bold text-center text-base shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] focus:ring-4 outline-none transition-all placeholder:text-stone-300 ${passwordError ? 'ring-4 ring-red-500' : 'focus:ring-orange-500/20'}`} placeholder="Sua Senha" />
                       <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-8 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors">{showPass ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
                     </div>
                   </div>
                   {passwordError && <p className="text-[11px] font-bold text-red-500 animate-bounce">{passwordError}</p>}
                   
                   <div className="space-y-4 pt-2">
                     <button 
                       type="button" 
                       onClick={()=>setStep('first-access')} 
                       className="w-full py-5 bg-stone-100 text-stone-800 rounded-full font-black text-[10px] uppercase tracking-[0.2em] shadow-sm hover:bg-stone-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 border border-stone-200"
                     >
                        <Sparkles size={14} className="text-orange-500" />
                        PRIMEIRO ACESSO? CRIE SUA SENHA
                     </button>

                     <button disabled={loading} type="submit" className="w-full py-6 bg-stone-900 text-white rounded-full font-black text-sm uppercase tracking-[0.2em] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] hover:bg-black hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center gap-3">
                       {loading ? <Loader2 className="animate-spin" size={24} /> : (
                         <>
                           ACESSAR PORTAL
                           <ChevronRight size={20} className="text-orange-500" />
                         </>
                       )}
                     </button>
                   </div>
                   
                   <div className="flex justify-center">
                     <button type="button" onClick={()=>setStep('forgot-password')} className="text-[11px] font-black uppercase tracking-widest transition-all hover:scale-110 active:scale-95 hover:text-orange-600 opacity-60 hover:opacity-100" style={{ color: theme.secondaryColor }}>Esqueceu a senha?</button>
                   </div>
                </div>

                <div className="pt-6 border-t border-white/10">
                   <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white border border-white/20 shadow-xl">
                      <Shield size={14} className="text-emerald-400" /> 
                      PORTAL 100% SEGURO
                   </div>
                </div>
             </form>
           ) : step === 'first-access' ? (
             <form onSubmit={handleVerifyFirstAccess} className="space-y-6">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-stone-800">PRIMEIRO ACESSO</h2>
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Digite o e-mail usado na compra para validar seu acesso.</p>
                <div className="space-y-4">
                   <div className="space-y-1 text-left">
                     <label className="text-[10px] font-black uppercase tracking-widest px-4" style={{ color: theme.secondaryColor }}>E-mail da Compra</label>
                     <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-white p-5 rounded-full border-none font-bold text-center text-base shadow-lg focus:ring-2 focus:ring-orange-500/20 outline-none transition-all placeholder:text-stone-300" placeholder="Ex: maria@email.com" />
                   </div>
                   <button disabled={loading} type="submit" className="w-full py-5 bg-black text-white rounded-full font-black text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                     {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'VERIFICAR ACESSO'}
                   </button>
                   <button type="button" onClick={()=>setStep('login')} className="text-[10px] font-black uppercase tracking-widest transition-colors" style={{ color: theme.secondaryColor }}>VOLTAR PARA O LOGIN</button>
                </div>
             </form>
           ) : step === 'create-password' ? (
             <form onSubmit={handleCreatePassword} className="space-y-6">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-stone-800">CRIAR SENHA</h2>
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Defina uma senha para seus próximos acessos.</p>
                <div className="space-y-4">
                   <div className="space-y-1 text-left">
                     <label className="text-[10px] font-black uppercase tracking-widest px-4" style={{ color: theme.secondaryColor }}>Nova Senha</label>
                     <input type={showPass ? "text" : "password"} required value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-white p-5 rounded-full border-none font-bold text-center text-base shadow-lg focus:ring-2 focus:ring-orange-500/20 outline-none transition-all placeholder:text-stone-300" placeholder="Mínimo 6 caracteres" />
                   </div>
                   <div className="space-y-1 text-left">
                     <label className="text-[10px] font-black uppercase tracking-widest px-4" style={{ color: theme.secondaryColor }}>Confirmar Senha</label>
                     <input type={showPass ? "text" : "password"} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="w-full bg-white p-5 rounded-full border-none font-bold text-center text-base shadow-lg focus:ring-2 focus:ring-orange-500/20 outline-none transition-all placeholder:text-stone-300" placeholder="Repita a senha" />
                   </div>
                   <button disabled={loading} type="submit" className="w-full py-5 bg-orange-500 text-white rounded-full font-black text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                     {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'CRIAR SENHA E ACESSAR'}
                   </button>
                   <button type="button" onClick={()=>setStep('first-access')} className="text-[10px] font-black uppercase tracking-widest transition-colors" style={{ color: theme.secondaryColor }}>VOLTAR</button>
                </div>
             </form>
           ) : (
             <form onSubmit={handleForgotPassword} className="space-y-6">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-stone-800">RECUPERAR SENHA</h2>
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Enviaremos as instruções para o seu e-mail.</p>
                <div className="space-y-4">
                   <div className="space-y-1 text-left">
                     <label className="text-[10px] font-black uppercase tracking-widest px-4" style={{ color: theme.secondaryColor }}>E-mail</label>
                     <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-white p-5 rounded-full border-none font-bold text-center text-base shadow-lg focus:ring-2 focus:ring-orange-500/20 outline-none transition-all placeholder:text-stone-300" placeholder="E-mail de Aluno" />
                   </div>
                   <button disabled={loading || resetCooldown > 0} type="submit" className="w-full py-5 bg-black text-white rounded-full font-black text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                     {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (resetCooldown > 0 ? `AGUARDE ${resetCooldown}s` : 'ENVIAR INSTRUÇÕES')}
                   </button>
                   <button type="button" onClick={()=>setStep('login')} className="text-[10px] font-black uppercase tracking-widest transition-colors" style={{ color: theme.secondaryColor }}>VOLTAR PARA O LOGIN</button>
                </div>
             </form>
           )}
        </div>
      </div>
    </div>
  );
};
