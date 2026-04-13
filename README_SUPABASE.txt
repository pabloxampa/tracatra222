TRACATRA + SUPABASE + VERCEL

1) Ya debes tener en Vercel estas variables:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY

2) En Supabase debes haber ejecutado el SQL de la tabla profiles y las policies.

3) MUY IMPORTANTE:
   Si quieres que el registro entre directamente sin pedir confirmación por correo,
   desactiva la confirmación de email en:
   Supabase > Authentication > Providers > Email > Confirm email = OFF

4) Sube esta carpeta a GitHub o a Vercel.

5) En Vercel:
   - Framework preset: Vite
   - Root directory: vacío
   - Build command: npm run build
   - Output directory: dist

6) Haz Deploy o Redeploy.

NOTA IMPORTANTE DE SEGURIDAD:
- Las contraseñas sí las gestiona Supabase con hash seguro.
- El saldo se guarda de verdad en Supabase.
- Pero como la lógica del juego sigue en el cliente, un usuario avanzado todavía podría intentar manipular su propio saldo desde consola.
- Para blindarlo de verdad hace falta mover la lógica crítica a backend o Edge Functions.
