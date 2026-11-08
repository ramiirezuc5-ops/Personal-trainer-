// Crea el PRIMER entrenador (cuenta administradora) de forma segura. No existen cuentas ni contraseñas por defecto.
// Uso:  npm run create-trainer -- --email=entrenador@correo.com --name="Nombre Apellido"
// La contraseña se pide por consola sin mostrarla. Para automatizaciones se admite ADMIN_PASSWORD en el entorno.
import readline from 'node:readline';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { ROLES, USER_STATUS } from '../src/config/constants.js';
import { ensureIndexes, TrainerProfile, User } from '../src/models/index.js';
import { hashPassword } from '../src/services/auth.service.js';
import { emailSchema, passwordSchema } from '../src/validators/auth.validators.js';

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const allowAdditional = process.argv.includes('--allow-additional');

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => process.stdout.write(s.includes(question) ? s : '*');
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

async function main() {
  const email = emailSchema.parse(arg('email') ?? '');
  const name = (arg('name') ?? '').trim();
  if (name.length < 2) throw new Error('Indicá --name="Nombre Apellido".');

  const password = process.env.ADMIN_PASSWORD || await askHidden('Contraseña (mín. 10, letras y números): ');
  passwordSchema.parse(password);
  if (!process.env.ADMIN_PASSWORD && (await askHidden('Repetí la contraseña: ')) !== password) throw new Error('Las contraseñas no coinciden.');

  await connectDB();
  await ensureIndexes();
  if (!allowAdditional && await User.exists({ role: ROLES.TRAINER })) throw new Error('Ya existe un entrenador. Para crear otro usá --allow-additional.');
  if (await User.exists({ email })) throw new Error('Ya existe un usuario con ese correo.');

  const user = await User.create({ name, email, passwordHash: await hashPassword(password), role: ROLES.TRAINER, status: USER_STATUS.ACTIVE });
  try {
    await TrainerProfile.create({ user: user._id, businessName: name });
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // no dejar un entrenador sin perfil
    throw err;
  }
  console.log(`Entrenador creado: ${email}`);
}

main().catch((err) => { console.error(`Error: ${err.issues ? err.issues.map((i) => i.message).join('; ') : (err.message ?? err)}`); process.exitCode = 1; }).finally(() => disconnectDB());
