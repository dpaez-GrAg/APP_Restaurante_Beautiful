import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Utensils } from "lucide-react";
import { useRestaurantConfig } from "@/contexts/RestaurantConfigContext";

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { config } = useRestaurantConfig();

  const scrollToSection = (sectionId: string) => {
    if (sectionId.startsWith('/')) {
      // Si es una ruta (como /admin), navegar directamente
      window.location.href = sectionId;
      return;
    }
    
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsOpen(false);
  };

  const navItems = [
    { label: "Inicio", href: "#hero" },
    { label: "Reservar", href: "#reservation" },
    { label: "Sobre Nosotros", href: "#about" },
    { label: "Contacto", href: "#contact" },
    { label: "Admin", href: "/admin" }
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Utensils className="w-8 h-8 text-restaurant-gold" />
            <span className="text-xl font-bold text-restaurant-brown">
              {config?.restaurant_name || "Restaurante Élite"}
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => scrollToSection(item.href.startsWith('#') ? item.href.slice(1) : item.href)}
                className="text-muted-foreground hover:text-restaurant-brown transition-colors duration-200 font-medium"
              >
                {item.label}
              </button>
            ))}
            <Button 
              variant="elegant"
              onClick={() => scrollToSection('reservation')}
            >
              Reservar Mesa
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <X className="w-6 h-6 text-restaurant-brown" />
            ) : (
              <Menu className="w-6 h-6 text-restaurant-brown" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border bg-background/95 backdrop-blur-sm">
            <div className="flex flex-col space-y-4">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => scrollToSection(item.href.startsWith('#') ? item.href.slice(1) : item.href)}
                  className="text-left text-muted-foreground hover:text-restaurant-brown transition-colors duration-200 font-medium py-2"
                >
                  {item.label}
                </button>
              ))}
              <div className="pt-2">
                <Button 
                  variant="elegant"
                  onClick={() => scrollToSection('reservation')}
                  className="w-full"
                >
                  Reservar Mesa
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;