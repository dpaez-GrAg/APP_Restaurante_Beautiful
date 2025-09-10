import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import ReservationForm from "@/components/ReservationForm";
import RestaurantInfo from "@/components/RestaurantInfo";
import { useRestaurantConfig } from "@/contexts/RestaurantConfigContext";

const Index = () => {
  const { config } = useRestaurantConfig();
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
      </main>

      <footer className="bg-restaurant-brown text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="mb-4">
            <h3 className="text-xl font-semibold mb-2">{config?.restaurant_name || "Restaurante Élite"}</h3>
            <p className="text-gray-300">Una experiencia gastronómica única</p>
          </div>
          <div className="text-sm text-gray-400 mb-6">
            <p>&copy; 2025 {config?.restaurant_name || "Gridded Agency"}. Todos los derechos reservados.</p>
          </div>
          <div className="pt-4 border-t border-gray-700">
            <div className="flex items-center justify-center gap-2">
              <span className="text-gray-400 text-sm">Desarrollado por</span>
              <img
                src="/gridded-agency-logo-footer.png"
                alt="Gridded Agency"
                className="h-6 w-auto opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
