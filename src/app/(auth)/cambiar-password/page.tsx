"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

export default function CambiarPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres")
      return
    }

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden")
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      toast.error("Error al cambiar contraseña")
      setLoading(false)
      return
    }

    // Mark debe_cambiar_password = false
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from("vendedores")
        .update({ debe_cambiar_password: false })
        .eq("auth_user_id", user.id)
    }

    toast.success("Contraseña actualizada")
    router.push("/")
    router.refresh()
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-espresso">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-espresso via-brand-espresso/95 to-primary/30" />
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-gold/5 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-brand-sand/5 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-brand-cream">
            Cambiar contraseña
          </h1>
          <p className="mt-2 text-sm text-brand-sand/60">
            Debes establecer una nueva contraseña para continuar
          </p>
        </div>

        <Card className="border-border/20 bg-card/95 shadow-2xl shadow-black/20 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <CardTitle className="font-display text-xl font-medium">Nueva contraseña</CardTitle>
            <CardDescription>Ingresa tu nueva contraseña</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Nueva contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-border/60 bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Confirmar contraseña
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repite la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="border-border/60 bg-background/50"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Guardando..." : "Cambiar contraseña"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
