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
      
      // 1. Tenta obter a sessão normalmente
      let { data: { session } } = await supabase.auth.getSession();
      
      // 2. Se não encontrou, tenta extrair os tokens do hash manualmente
      if (!session) {
        const hash = window.location.hash;
        if (hash.includes('access_token=')) {
          console.log('NovaSenha: Tentando extrair tokens do hash manualmente...');
          // O hash pode vir como #/nova-senha#access_token=... ou #access_token=...
          const hashParts = hash.split('#');
          const tokenPart = hashParts.find(p => p.includes('access_token='));
          
          if (tokenPart) {
            // Limpar o tokenPart de possíveis prefixos de rota
            const cleanTokenPart = tokenPart.includes('access_token=') 
              ? tokenPart.substring(tokenPart.indexOf('access_token=')) 
              : tokenPart;

            const params = new URLSearchParams(cleanTokenPart);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            
            if (accessToken) {
              try {
                const { data, error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken || '',
                });
                if (!error && data.session) {
                  console.log('NovaSenha: Sessão recuperada manualmente!');
                  session = data.session;
                }
              } catch (e) {
                console.error('Erro ao definir sessão manual:', e);
              }
            }
          }
        }
      }

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
            // Mesmo sem sessão "oficial", se temos tokens no hash, vamos considerar "pronto" para tentar
            if (window.location.hash.includes('access_token=')) {
              setSessionReady(true);
            }
          }
        }, 1000);
      }
    };
    checkSession();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
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
      // Antes de atualizar, garante que a sessão está setada se houver tokens no hash
      if (!sessionReady) {
        const hash = window.location.hash;
        const hashParts = hash.split('#');
        const tokenPart = hashParts.find(p => p.includes('access_token='));
        if (tokenPart) {
          const cleanTokenPart = tokenPart.substring(tokenPart.indexOf('access_token='));
          const params = new URLSearchParams(cleanTokenPart);
          const accessToken = params.get('access_token');
          if (accessToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: params.get('refresh_token') || '',
            });
          }
        }
      }

      await atualizarSenha(password);
      notify('Senha criada com sucesso! Você já pode acessar.', 'success');
      navigate('/');
    } catch (err: any) {
      console.error('Erro ao atualizar senha:', err);
      notify(err.message || 'Erro ao atualizar senha. Tente clicar no link do e-mail novamente.', 'error');
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

            <button disabled={loading} type="submit" className="w-full py-6 text-white rounded-[35px] font-black text-[10px] uppercase tracking-widest shadow-xl transition-all hover:scale-[1.02] active:scale-95" style={{ backgroundColor: theme.primaryColor }}>
              {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'CRIAR SENHA E ACESSAR'}
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
