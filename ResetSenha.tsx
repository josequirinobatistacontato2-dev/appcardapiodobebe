import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetarSenhaComToken } from './authService';
import { Loader2, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ResetSenha() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!token) {
      setErro('Token de recuperação ausente. Solicite um novo e-mail.');
      setTimeout(() => navigate('/esqueci-senha'), 3000);
    }
  }, [token, navigate]);

  const handleResetSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!token) return;

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
      await resetarSenhaComToken(token, novaSenha);
      setSucesso(true);
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    } catch (err: any) {
      console.error('ResetSenha: Erro ao resetar senha:', err);
      setErro(err.message || 'Erro ao atualizar senha. O link pode ter expirado.');
      setCarregando(false);
    }
  };

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-10 border border-stone-200">
        <div className="flex flex-col items-center mb-8">
           <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="text-orange-600" size={32} />
           </div>
           <h2 className="text-3xl font-black text-stone-800 uppercase italic tracking-tighter">Nova Senha</h2>
           <p className="text-stone-500 text-xs font-bold uppercase tracking-widest mt-2">Defina sua nova senha de acesso</p>
        </div>

        {erro && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-medium flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0" />
            {erro}
          </div>
        )}

        <form onSubmit={handleResetSenha} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[11px] font-black text-stone-600 uppercase tracking-[0.2em] px-4">
              Nova Senha
            </label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
              disabled={carregando || !token}
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
              disabled={carregando || !token}
              className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-full focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all font-bold text-stone-800 placeholder:text-stone-300"
              placeholder="Confirme sua senha"
            />
          </div>

          <button
            type="submit"
            disabled={carregando || !token}
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
