import { useEffect, useState } from "react"
import { supabase } from "./supabaseClient"

export default function NovaSenha() {

  const [senha, setSenha] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {

    const processRecovery = async () => {

      try {

        const { data, error } =
          await supabase.auth.exchangeCodeForSession(window.location.href)

        console.log("Recovery session:", data)

        if (error) {
          console.error("Erro recovery:", error.message)
        }

      } catch (err) {
        console.error("Erro geral:", err)
      }

    }

    processRecovery()

  }, [])


  const criarSenha = async () => {

    if (!senha || !confirmar) {
      alert("Digite a senha")
      return
    }

    if (senha !== confirmar) {
      alert("As senhas não coincidem")
      return
    }

    try {

      setLoading(true)

      const { error } = await supabase.auth.updateUser({
        password: senha
      })

      if (error) {
        alert(error.message)
        setLoading(false)
        return
      }

      alert("Senha criada com sucesso!")

      await supabase.auth.signOut()

      window.location.href = "/"

    } catch (err) {

      console.error(err)
      alert("Erro ao atualizar senha")

    } finally {

      setLoading(false)

    }

  }


  return (

    <div style={{
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#d8e8b6"
    }}>

      <div style={{
        background: "#fff",
        padding: "40px",
        borderRadius: "20px",
        width: "350px",
        textAlign: "center"
      }}>

        <h2 style={{ color: "#333", marginBottom: "10px" }}>NOVA SENHA</h2>

        <p style={{ color: "#666", fontSize: "14px" }}>Crie uma nova senha segura para o seu acesso.</p>

        <input
          type="password"
          placeholder="Nova senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          style={{ 
            width: "100%", 
            padding: "12px", 
            marginTop: "20px", 
            border: "1px solid #ddd", 
            borderRadius: "8px",
            boxSizing: "border-box"
          }}
        />

        <input
          type="password"
          placeholder="Confirmar senha"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          style={{ 
            width: "100%", 
            padding: "12px", 
            marginTop: "10px", 
            border: "1px solid #ddd", 
            borderRadius: "8px",
            boxSizing: "border-box"
          }}
        />

        <button
          onClick={criarSenha}
          disabled={loading}
          style={{
            marginTop: "20px",
            width: "100%",
            padding: "14px",
            background: "#ff7a00",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "14px"
          }}
        >
          {loading ? "Salvando..." : "CRIAR SENHA E ACESSAR"}
        </button>

      </div>

    </div>

  )

}
