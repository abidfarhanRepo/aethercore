import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/auth'
import { authAPI } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'

export default function Register(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()

  async function submit(e:React.FormEvent){
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try{
      await authAPI.register(email, password)
      // Auto-login after registration
      const loginRes = await authAPI.login(email, password)
      const { accessToken, refreshToken, user } = loginRes.data
      setTokens(accessToken, refreshToken)
      setUser(user)
      navigate('/checkout')
    }catch(e:any){
      console.error('Register error:', e)
      const message = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Registration failed'
      setError(message)
    }finally{
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-16 top-12 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -left-20 bottom-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_25%,hsl(var(--accent)/0.10),transparent_35%),radial-gradient(circle_at_82%_78%,hsl(var(--foreground)/0.08),transparent_30%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl items-center justify-center gap-6 md:gap-10">
        <aside className="hidden w-full max-w-sm rounded-2xl border border-border/60 bg-card/60 p-6 shadow-xl backdrop-blur md:block">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">AetherCore POS</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-foreground">Create your account</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Start securely with role-based access and proceed directly to checkout after registration.
          </p>
        </aside>

        <Card className="w-full max-w-md border-border/70 bg-card/90 shadow-2xl backdrop-blur">
          <CardHeader className="space-y-3 pb-4">
            <CardTitle className="text-2xl">Register</CardTitle>
            <CardDescription>Create credentials to get started quickly.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e=>setEmail(e.target.value)}
                  className="h-12 rounded-lg text-base"
                  required
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'register-error' : undefined}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={e=>setPassword(e.target.value)}
                  className="h-12 rounded-lg text-base"
                  required
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'register-error' : undefined}
                />
              </div>

              {error && (
                <div
                  id="register-error"
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </div>
              )}

              <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
