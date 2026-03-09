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

  // Verifica e estabelece a sessão de segurança ao carregar a página
  React.useEffect(() => {
    const initSession = async () => {
      try {
        console.log('NovaSenha: Iniciando validação de segurança...');
        
        // 1. Tenta obter sessão existente
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          console.log('NovaSenha: Sessão já ativa para:', existingSession.user.email);
          setSessionReady(true);
          return;
        }

        // 2. Tenta PKCE Flow (se houver 'code' na URL) - Conforme solicitado pelo usuário
        const url = new URL(window.location.href.replace('#/', '/'));
        const code = url.searchParams.get('code');
        if (code) {
          console.log('NovaSenha: Detectado código PKCE, trocando por sessão...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            console.log('NovaSenha: Sessão PKCE estabelecida!');
            setSessionReady(true);
            return;
          }
        }

        // 3. Tenta Implicit Flow (se houver 'access_token' no hash) - Comum em HashRouter
        const hash = window.location.hash;
        if (hash.includes('access_token=')) {
          console.log('NovaSenha: Detectado token no hash, processando...');
          // Extrai a parte dos tokens (pode estar após um segundo #)
          const tokenPart = hash.includes('#access_token=') 
            ? hash.split('#access_token=')[1] 
            : (hash.includes('access_token=') ? hash.split('access_token=')[1] : '');
          
          if (tokenPart) {
            const params = new URLSearchParams('access_token=' + tokenPart);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            
            if (accessToken) {
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });
              if (!error && data.session) {
                console.log('NovaSenha: Sessão via hash estabelecida!');
                setSessionReady(true);
                return;
              }
            }
          }
        }

        console.log('NovaSenha: Nenhuma sessão detectada ainda. Aguardando processamento automático...');
        // Aguarda um pouco para o Supabase processar automaticamente se for o caso
        setTimeout(async () => {
          const { data: { session: finalCheck } } = await supabase.auth.getSession();
          if (finalCheck) {
            setSessionReady(true);
          }
        }, 2000);

      } catch (err) {
        console.error('Erro na inicialização da sessão:', err);
      }
    };

    initSession();
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
      console.log('NovaSenha: Tentando atualizar senha...');
      
      // Garantia final: tenta pegar a sessão antes do update
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Sessão de segurança não encontrada. Por favor, clique no link do e-mail novamente.');
      }

      const { error } = await supabase.auth.updateUser({
        password: password,
      });
      
      if (error) throw error;

      notify('Senha criada com sucesso! Redirecionando...', 'success');
      
      // Limpa o hash para evitar re-processamento
      window.location.hash = '#/';
      
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (err: any) {
      console.error('Erro ao atualizar senha:', err);
      notify(err.message || 'Erro ao atualizar senha. Tente novamente.', 'error');
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
