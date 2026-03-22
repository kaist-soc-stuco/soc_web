import { Link } from 'react-router-dom';

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 md:gap-4 hover:opacity-90 transition-opacity">
      <img 
        src="/kaist_logo.png" 
        alt="KAIST Logo" 
        className="h-6 w-auto"
      />
      <div className="h-6 w-px bg-gray-400" />
      <img 
        src="/logo.png" 
        alt="SOC Logo" 
        className="h-7 w-auto"
      />
    </Link>
  );
}
