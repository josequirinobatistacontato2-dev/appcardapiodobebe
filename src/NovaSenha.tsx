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

    // Escutar eventos de autenticação do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('NovaSenha: Auth event:', event);
      
      if (event === 'PASSWORD_RECOVERY') {
        if (isMounted) {
          setSessaoValida(true);
          setTentando(false);
        }
      }
    });

    // Timer de segurança caso o evento não dispare (link inválido ou expirado)
    const timer = setTimeout(() => {
      if (isMounted) {
        setTentando(prev => {
          if (prev) {
            setErro('Link de recuperação inválido ou expirado. Solicite um novo e-mail.');
            setTimeout(() => {
              if (isMounted) navigate('/esqueci-senha');
            }, 3000);
            return false;
          }
          return prev;
        });
      }
    }, 5000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [navigate]);

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
      // 1. Executar supabase.auth.updateUser() apenas quando o usuário clicar no botão
      const { error } = await supabase.auth.updateUser({
        password: novaSenha
      });

      if (error) {
        throw error;
      }

      // Sucesso!
      setSucesso(true);
      
      // Limpar a sessão de recuperação para evitar loops no App.tsx
      await supabase.auth.signOut();
      
      // 4. Após sucesso, redirecionar o usuário para /login
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (err: any) {
      console.error('NovaSenha: Erro ao atualizar senha:', err);
      setErro(err.message || 'Erro ao atualizar senha');
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


