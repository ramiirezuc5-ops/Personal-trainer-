import { Compass } from 'lucide-react';
import { LinkButton } from '../components/ui/Button';
import { EmptyState } from '../components/ui/Feedback';

export default function NotFound() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
      <EmptyState icon={<Compass size={24} />} title="Página no encontrada" description="El enlace no existe o fue movido." action={<LinkButton to="/">Volver al inicio</LinkButton>} />
    </div>
  );
}
