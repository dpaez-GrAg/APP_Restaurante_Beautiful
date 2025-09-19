import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import ReservationForm from "@/components/ReservationForm";
import RestaurantInfo from "@/components/RestaurantInfo";
import { useRestaurantConfig } from "@/contexts/RestaurantConfigContext";
import { MapPin, Phone, Mail } from "lucide-react";

const Index = () => {
  const { config, isLoading } = useRestaurantConfig();

  return (
    <div className="min-h-screen">
      <Navigation />

      <main>
        <section id="hero">
          <HeroSection />
        </section>

        <section id="reservation">
          <ReservationForm />
        </section>

        <section id="about">
          <RestaurantInfo />
        </section>

        {/* Nueva sección de contacto con transiciones suaves */}
        <section id="contact" className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-restaurant-brown mb-4">Contacto</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                ¿Tienes alguna pregunta o necesitas más información? Estamos aquí para ayudarte.
              </p>
            </div>

            <div
              className={`grid md:grid-cols-3 gap-8 max-w-4xl mx-auto transition-all duration-500 ${
                config ? "opacity-100" : "opacity-70"
              }`}
            >
              <div className="bg-white p-6 rounded-lg shadow-sm text-center transform hover:scale-105 transition-transform duration-300">
                <div className="flex justify-center mb-4">
                  <MapPin className="w-10 h-10 text-restaurant-gold" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Dirección</h3>
                <p className={`text-gray-600 transition-all duration-300 ${isLoading ? "animate-pulse" : ""}`}>
                  {config?.contact_address || "Calle Principal 123, 28001 Madrid"}
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm text-center transform hover:scale-105 transition-transform duration-300">
                <div className="flex justify-center mb-4">
                  <Phone className="w-10 h-10 text-restaurant-gold" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Teléfono</h3>
                <p className={`text-gray-600 transition-all duration-300 ${isLoading ? "animate-pulse" : ""}`}>
                  <a
                    href={`tel:${config?.contact_phone || "+34 912 345 678"}`}
                    className="hover:text-primary transition-colors duration-200"
                  >
                    {config?.contact_phone || "+34 912 345 678"}
                  </a>
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm text-center transform hover:scale-105 transition-transform duration-300">
                <div className="flex justify-center mb-4">
                  <Mail className="w-10 h-10 text-restaurant-gold" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Email</h3>
                <p className={`text-gray-600 transition-all duration-300 ${isLoading ? "animate-pulse" : ""}`}>
                  <a
                    href={`mailto:${config?.contact_email || "info@restaurante.com"}`}
                    className="hover:text-primary transition-colors duration-200"
                  >
                    {config?.contact_email || "info@restaurante.com"}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-restaurant-brown text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <div className={`mb-4 transition-all duration-500 ${config ? "opacity-100" : "opacity-70"}`}>
            <h3
              className={`text-xl font-semibold mb-2 transition-all duration-300 ${isLoading ? "animate-pulse" : ""}`}
            >
              {config?.restaurant_name || "Restaurante Élite"}
            </h3>
            <p className="text-gray-300">Una experiencia gastronómica única</p>
          </div>
          <div className="text-sm text-gray-400 mb-6">
            <p className={`transition-all duration-300 ${isLoading ? "animate-pulse" : ""}`}>
              &copy; 2025 {config?.restaurant_name || "Gridded Agency"}. Todos los derechos reservados.
            </p>
          </div>
          <div className="pt-4 border-t border-gray-700">
            <div className="flex items-center justify-center gap-2">
              <span className="text-gray-400 text-sm">Desarrollado por</span>
              <a href="https://gridded.agency" target="_blank" rel="noopener noreferrer" title="Visitar Gridded Agency">
                <img
                  src="/gridded-agency-logo-footer.png"
                  alt="Gridded Agency"
                  className="h-6 w-auto opacity-80 hover:opacity-100 transition-opacity duration-300"
                />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
