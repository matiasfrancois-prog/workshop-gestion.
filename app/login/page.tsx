import { ingresar } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 py-10 max-w-sm mx-auto">
      <div className="mb-8">
        <div className="size-14 rounded-2xl bg-marca text-white grid place-items-center text-xl font-extrabold">WS</div>
        <h1 className="mt-4 text-2xl font-bold">Work Shop</h1>
        <p className="text-suave">Sistema de gestión</p>
      </div>
      <form action={ingresar} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {error && (
          <p className="text-mal text-sm">
            {error === "sin-perfil" ? "Tu usuario no está habilitado." : "Email o contraseña incorrectos."}
          </p>
        )}
        <button className="btn-primario w-full">Ingresar</button>
      </form>
    </main>
  );
}
