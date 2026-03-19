"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { toast } from "sonner"

export function Header() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success("Sesión cerrada")
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-end border-b border-border/60 bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="text-muted-foreground hover:text-foreground"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Cerrar sesión
      </Button>
    </header>
  )
}
