import { Link } from 'react-router-dom';
import { Map as MapIcon } from 'lucide-react';
import { useJobMapAccess } from '@/hooks/useJobMapAccess';

/** The account menu's Job Map item (AuthBar loads this only when the menu opens): shown once the server lets the account use the Job Map. */
export default function JobMapMenuItem({ user, onPick }) {
  const allowed = useJobMapAccess(user);
  if (allowed !== true) return null;
  return (
    <Link to="/job-map" onClick={onPick} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
      <MapIcon size={13} /> Job Map
    </Link>
  );
}
