import { Link } from 'react-router-dom';
import { Shield, Scale, FileText, ShieldCheck, HelpCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 mt-auto h-[180px] sm:h-[137px]" style={{ contain: 'layout' }}>
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col gap-4">
          {/* Disclaimer */}
          <div className="flex items-center gap-2 text-muted-foreground justify-center">
            <Shield className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm text-center">
              Plataforma de mercados preditivos. Não constitui oferta de serviços financeiros, apostas ou jogos de azar. Operação em conformidade com a legislação brasileira.
            </p>
          </div>
          
          {/* Links jurídicos */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm text-muted-foreground">
            <Link to="/termos" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <Scale className="h-3.5 w-3.5" />
              Termos de Uso
            </Link>
            <Link to="/privacidade" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <FileText className="h-3.5 w-3.5" />
              Política de Privacidade
            </Link>
            <Link to="/lgpd" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <ShieldCheck className="h-3.5 w-3.5" />
              LGPD
            </Link>
            <Link to="/faq" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <HelpCircle className="h-3.5 w-3.5" />
              FAQ
            </Link>
          </div>
          
          {/* Copyright */}
          <p className="text-xs text-center text-muted-foreground">
            © 2024 OddsWatch. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
