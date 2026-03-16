import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { solicitarResetSenha } from './authService';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  const handleEnviarEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro('');
    setMensagem('');

    try {
      // Usando a lógica do authService para manter as validações de cliente
      await solicitarResetSenha(email.trim().toLowerCase());

      setMensagem('E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada e também a pasta de spam.');
      setEmail('');
    } catch (err: any) {
      setErro(err.message || 'Erro ao enviar e-mail');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-10 border border-stone-200">
        <div className="flex flex-col items-center mb-8">
           <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="text-orange-600" size={32} />
           </div>
           <h2 className="text-3xl font-black text-stone-800 uppercase italic tracking-tighter">Recuperar Senha</h2>
           <p className="text-stone-500 text-xs font-bold uppercase tracking-widest mt-2 text-center">
             Enviaremos as instruções para o seu e-mail de aluno.
           </p>
        </div>

        {mensagem && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-sm font-medium animate-in fade-in slide-in-from-top-2">
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              {mensagem}
            </p>
          </div>
        )}

        {erro && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-medium animate-in shake duration-500">
            {erro}
          </div>
        )}

        <form onSubmit={handleEnviarEmail} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[11px] font-black text-stone-600 uppercase tracking-[0.2em] px-4">
              E-mail de Aluno
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-full focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all font-bold text-stone-800 placeholder:text-stone-300"
              placeholder="seu@email.com"
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
                ENVIANDO...
              </>
            ) : 'ENVIAR INSTRUÇÕES'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-stone-100 flex flex-col items-center gap-4">
          <button 
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 text-stone-500 hover:text-orange-600 transition-colors text-[11px] font-black uppercase tracking-widest"
          >
            <ArrowLeft size={14} />
            VOLTAR PARA O LOGIN
          </button>
        </div>
      </div>
    </div>
  );
}
