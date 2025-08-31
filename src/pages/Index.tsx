import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import ReservationForm from "@/components/ReservationForm";
import RestaurantInfo from "@/components/RestaurantInfo";

const Index = () => {
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
            <h3 className="text-xl font-semibold mb-2">Restaurante Élite</h3>
            <p className="text-gray-300">Una experiencia gastronómica única</p>
          </div>
          <div className="text-sm text-gray-400">
            <p>&copy; 2024 Restaurante Élite. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
