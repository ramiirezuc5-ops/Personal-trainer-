import { z } from 'zod';

// bcrypt procesa solo los primeros 72 bytes: se limita el largo para no truncar contraseñas en silencio.
export const passwordSchema = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .max(72, 'La contraseña no puede superar los 72 caracteres')
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Debe combinar letras y números');

export const emailSchema = z.string().trim().toLowerCase().email('Correo electrónico inválido').max(254);
const tokenSchema = z.string().min(20).max(200);

// .strict() rechaza campos desconocidos (p. ej. "role") → protección contra asignación masiva.
// `portal` indica desde qué pestaña se ingresa (alumno o entrenador). No asigna ningún rol: solo exige que la cuenta coincida.
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200), portal: z.enum(['trainer', 'student']).optional() }).strict();
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema }).strict();
export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();
// Sirve para recuperar la contraseña y para activar una cuenta invitada.
export const resetPasswordSchema = z.object({ token: tokenSchema, password: passwordSchema }).strict();
