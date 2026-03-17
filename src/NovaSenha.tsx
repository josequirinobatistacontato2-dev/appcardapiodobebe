import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Loader2, Shield, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function NovaSenha() {
  const navigate = useNavigate();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const [sessaoValida, setSessaoValida] = useState(false);
  const [tentando, setTentando] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        // Verificar se há erro no hash (comum quando o link expira ou é inválido)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const errorMsg = hashParams.get('error_description') || hashParams.get('error');
        
        if (errorMsg && isMounted) {
          console.error('NovaSenha: Erro detectado no hash:', errorMsg);
          setErro(errorMsg === 'Email link is invalid or has expired' 
            ? 'O link de recuperação é inválido ou expirou. Por favor, solicite um novo.' 
            : errorMsg);
          setTentando(false);
          return;
        }

        let { data: { session } } = await supabase.auth.getSession();
        console.log('NovaSenha: Check session inicial:', !!session);
        
        // Se não houver sessão mas houver hash de token, aguardar o processamento do Supabase
        const hasToken = window.location.hash.includes('access_token=') || 
                         window.location.hash.includes('recovery_token=') ||
                         window.location.search.includes('code=');

        if (!session && hasToken) {
          console.log('NovaSenha: Token detectado mas sem sessão, aguardando processamento...');
          // Tentar várias vezes em intervalos curtos
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 800));
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession) {
              session = retrySession;
              console.log('NovaSenha: Sessão encontrada na tentativa', i + 1);
              break;
            }
          }
        }

        if (session && isMounted) {
          setSessaoValida(true);
          setTentando(false);
        }
      } catch (e: any) {
        console.error('NovaSenha: Error checking session:', e);
        if (isMounted) setErro(e.message || 'Erro ao verificar sessão');
      }
    };

    checkSession();

    // Escutar eventos de autenticação do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('NovaSenha: Auth event:', event, 'Session:', !!session);
      
      if (event === 'PASSWORD_RECOVERY' || (session && isMounted)) {
        if (isMounted) {
          setSessaoValida(true);
          setTentando(false);
        }
      }
    });

    // Timer de segurança caso o evento não dispare e não encontre sessão
    const timer = setTimeout(() => {
      if (isMounted && tentando) {
        console.log('NovaSenha: Timer atingido, encerrando tentativa');
        if (!erro) setErro('Não foi possível validar seu link de acesso. Ele pode ter expirado ou já foi utilizado.');
        setTentando(false);
      }
    }, 6000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleAlterarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 3. Adicionar controle de loading para impedir múltiplos envios
    if (carregando) return;

    setErro('');

    // Validações básicas
    if (novaSenha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não correspondem');
      return;
    }

    setCarregando(true);

    try {
      console.log('NovaSenha: Iniciando atualização de senha...');
      
      // Verificar sessão antes de tentar
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        console.error('NovaSenha: Sem sessão ativa para atualização');
        throw new Error('Sessão de recuperação não encontrada. O link pode ter expirado ou já foi utilizado.');
      }

      console.log('NovaSenha: Sessão confirmada, chamando updateUser...');

      // Timeout de segurança para a chamada do Supabase
      const updatePromise = supabase.auth.updateUser({
        password: novaSenha
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tempo limite excedido ao salvar senha. Verifique sua conexão ou tente novamente.')), 20000)
      );

      const { error } = await Promise.race([updatePromise, timeoutPromise]) as any;

      if (error) {
        console.error('NovaSenha: Erro retornado pelo Supabase:', error);
        throw error;
      }

      console.log('NovaSenha: Senha atualizada com sucesso!');
      
      // Sucesso!
      setSucesso(true);
      
      // Limpar o hash da URL usando o navigate do React Router para garantir que o estado global (App.tsx) seja atualizado
      // Isso fará com que isRecovery se torne falso no App.tsx
      navigate(window.location.pathname, { replace: true });

      // NÃO damos signOut aqui para evitar conflitos de eventos com App.tsx
      // O redirecionamento para o login cuidará disso ou o usuário já estará logado
      
      // 4. Após sucesso, redirecionar o usuário para /login
      setTimeout(() => {
        console.log('NovaSenha: Redirecionando para login...');
        navigate('/login');
      }, 3000);

    } catch (err: any) {
      console.error('NovaSenha: Erro ao atualizar senha:', err);
      setErro(err.message || 'Erro ao atualizar senha. Verifique se o link ainda é válido.');
    } finally {
      // 5. Encerrar o estado de loading após sucesso ou erro
      setCarregando(false);
    }
  };

  // Sucesso!
  if (sucesso) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-100 p-6">
        <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-10 text-center space-y-6 border border-stone-200">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="text-green-600" size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-stone-800 uppercase italic tracking-tighter">Senha Atualizada!</h2>
            <p className="text-stone-500 text-sm font-bold">Sua senha foi alterada com sucesso.</p>
            <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest pt-4">Redirecionando para o login...</p>
          </div>
        </div>
      </div>
    );
  }

  // Aguardando detecção do evento PASSWORD_RECOVERY
  if (tentando) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-100 p-6">
        <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-10 text-center space-y-6 border border-stone-200">
          <div className="relative inline-block">
            <Loader2 className="animate-spin text-orange-500 opacity-20" size={64} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Shield className="text-orange-500 animate-pulse" size={24} />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-stone-800 uppercase italic tracking-tighter">Verificando Link</h2>
            <p className="text-stone-500 text-xs font-bold uppercase tracking-widest">Aguardando autorização do Supabase...</p>
          </div>
        </div>
      </div>
    );
  }

  // Se o link for inválido ou o evento não disparar
  if (!sessaoValida) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-100 p-6">
        <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl p-10 text-center space-y-6 border border-stone-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="text-red-600" size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-red-600 uppercase italic tracking-tighter">Link Inválido</h2>
            <p className="text-stone-800 text-sm font-bold">{erro}</p>
            <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest pt-4">Redirecionando para recuperação...</p>
          </div>
        </div>
      </div>
    );
  }

  // Formulário para alterar senha (só aparece após PASSWORD_RECOVERY)
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-10 border border-stone-200">
        <div className="flex flex-col items-center mb-8">
           <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="text-orange-600" size={32} />
           </div>
           <h2 className="text-3xl font-black text-stone-800 uppercase italic tracking-tighter">Alterar Senha</h2>
           <p className="text-stone-500 text-xs font-bold uppercase tracking-widest mt-2">Digite sua nova senha de acesso</p>
        </div>

        {erro && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-medium flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0" />
            {erro}
          </div>
        )}

        <form onSubmit={handleAlterarSenha} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[11px] font-black text-stone-600 uppercase tracking-[0.2em] px-4">
              Nova Senha
            </label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
              disabled={carregando}
              className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-full focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all font-bold text-stone-800 placeholder:text-stone-300"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-black text-stone-600 uppercase tracking-[0.2em] px-4">
              Confirmar Senha
            </label>
            <input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              disabled={carregando}
              className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-full focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all font-bold text-stone-800 placeholder:text-stone-300"
              placeholder="Confirme sua senha"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-stone-900 hover:bg-black disabled:bg-stone-300 text-white font-black py-5 px-4 rounded-full transition-all shadow-xl hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
          >
            {carregando ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                SALVANDO...
              </>
            ) : (
              <>
                SALVAR NOVA SENHA
                <CheckCircle2 size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}


