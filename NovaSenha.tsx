import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useApp } from './App';
import { supabase } from './supabaseClient';

export const NovaSenha = () => {
  const { theme, notify, atualizarSenha } = useApp();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Verifica se existe uma sessão ativa antes de permitir o reset
  React.useEffect(() => {
    const checkSession = async () => {
      console.log('NovaSenha: Verificando sessão...');
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('NovaSenha: Sessão encontrada para:', session.user.email);
        setSessionReady(true);
      } else {
        console.log('NovaSenha: Nenhuma sessão encontrada no primeiro check.');
        // Se não houver sessão, aguarda um pouco (pode ser delay do Supabase)
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession) {
            console.log('NovaSenha: Sessão encontrada no retry.');
            setSessionReady(true);
          } else {
            console.warn('NovaSenha: Falha ao obter sessão após retry. Hash atual:', window.location.hash);
          }
        }, 1500);
      }
    };
    checkSession();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionReady) {
      notify('Aguardando validação de segurança... Tente em 2 segundos.', 'error');
      return;
    }
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
      await atualizarSenha(password);
      notify('Senha atualizada com sucesso! Faça login agora.', 'success');
      navigate('/');
    } catch (err: any) {
      notify(err.message || 'Erro ao atualizar senha.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-stone-100" style={{ backgroundColor: theme.backgroundColor }}>
      <div className="w-full max-w-md bg-white p-10 md:p-16 rounded-[50px] shadow-2xl border border-white/60 text-center">
        <form onSubmit={handleReset} className="space-y-8">
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-stone-800">NOVA SENHA</h2>
          <p className="text-xs font-bold text-stone-400">Crie uma nova senha segura para o seu acesso.</p>
          
          <div className="space-y-4">
            <div className="relative">
              <input 
                type={showPass ? "text" : "password"} 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full bg-stone-50 p-6 rounded-[30px] border border-stone-100 font-bold text-center focus:ring-2 focus:ring-orange-500/20 outline-none transition-all" 
                placeholder="Nova Senha" 
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-6 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 transition-colors">
                {showPass ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>
            
            <input 
              type={showPass ? "text" : "password"} 
              required 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              className="w-full bg-stone-50 p-6 rounded-[30px] border border-stone-100 font-bold text-center focus:ring-2 focus:ring-orange-500/20 outline-none transition-all" 
              placeholder="Confirmar Nova Senha" 
            />

            <button disabled={loading || !sessionReady} type="submit" className={`w-full py-6 text-white rounded-[35px] font-black text-[10px] uppercase tracking-widest shadow-xl transition-all ${!sessionReady ? 'bg-stone-300 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95'}`} style={{ backgroundColor: sessionReady ? theme.primaryColor : undefined }}>
              {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (sessionReady ? 'ATUALIZAR SENHA' : 'VALIDANDO ACESSO...')}
            </button>
            
            <button type="button" onClick={() => navigate('/')} className="text-[9px] font-black uppercase tracking-widest text-stone-400 hover:text-orange-500 transition-colors">
              VOLTAR PARA O LOGIN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
