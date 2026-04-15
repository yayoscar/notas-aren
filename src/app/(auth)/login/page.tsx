"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

export default function LoginPage() {
  const [usuario, setUsuario] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const email = `${usuario}@notasdearen.local`

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error("Credenciales inválidas")
      setLoading(false)
      return
    }

    // Check if user must change password
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: vendedor } = await supabase
        .from("vendedores")
        .select("debe_cambiar_password")
        .eq("auth_user_id", user.id)
        .maybeSingle()

      if (vendedor?.debe_cambiar_password) {
        toast.success("Sesión iniciada — debes cambiar tu contraseña")
        router.push("/cambiar-password")
        router.refresh()
        return
      }
    }

    toast.success("Sesión iniciada")
    router.push("/")
    router.refresh()
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-espresso">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-espresso via-brand-espresso/95 to-primary/30" />

      {/* Decorative elements */}
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-gold/5 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-brand-sand/5 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Brand mark */}
        <div className="mb-8 text-center">
          <Image
            src="/logo.png"
            alt="Notas de Aren"
            width={72}
            height={107}
            priority
            className="mx-auto mb-4 h-24 w-auto"
          />
          <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-cream">
            Notas de Aren
          </h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.25em] text-brand-sand/60">
            Perfumería
          </p>
        </div>

        <Card className="border-border/20 bg-card/95 shadow-2xl shadow-black/20 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <CardTitle className="font-display text-xl font-medium">Bienvenido</CardTitle>
            <CardDescription>Ingresa tus credenciales para acceder</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="usuario" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Usuario
                </Label>
                <Input
                  id="usuario"
                  type="text"
                  placeholder="nombre_usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  required
                  className="border-border/60 bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-border/60 bg-background/50"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Iniciando sesión..." : "Iniciar sesión"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
