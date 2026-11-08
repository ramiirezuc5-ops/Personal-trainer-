import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Button, LinkButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Feedback';
import { PageHeader } from '../components/ui/PageHeader';
import { studentsApi } from '../services/endpoints';
import type { Student } from '../types/api';
import { StudentForm } from './StudentForm';

export default function StudentCreate() {
  const [created, setCreated] = useState<Student | null>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <PageHeader title="Nuevo alumno" description="Cargá la ficha. El alumno elige su propia contraseña con la invitación." back={{ to: '/alumnos', label: 'Volver a alumnos' }} />
      {created && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert tone="success">
            <strong>{created.firstName} {created.lastName}</strong> quedó registrado como pendiente. Se generó la invitación para <strong>{created.email}</strong>; el alumno la recibe por correo si el envío de correos está configurado en el servidor.
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
              <LinkButton to={`/alumnos/${created.id}`} size="sm" icon={<MailCheck size={16} aria-hidden="true" />}>Ver ficha</LinkButton>
              <Button size="sm" variant="secondary" onClick={() => { setCreated(null); setFormKey((k) => k + 1); }}>Cargar otro alumno</Button>
            </div>
          </Alert>
        </div>
      )}
      {!created && (
        <Card>
          <StudentForm key={formKey} submitLabel="Crear alumno e invitar" onSubmit={async (input) => { setCreated(await studentsApi.create(input)); }} />
        </Card>
      )}
    </>
  );
}
