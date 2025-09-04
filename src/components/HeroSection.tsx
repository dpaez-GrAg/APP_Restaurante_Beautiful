import { Button } from "@/components/ui/button";
import { useRestaurantConfig } from "@/contexts/RestaurantConfigContext";
import heroImage from "@/assets/restaurant-hero.jpg";

const HeroSection = () => {
  const { config } = useRestaurantConfig();
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${config?.hero_image_url || heroImage})`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-restaurant-brown/80 via-restaurant-brown/50 to-transparent"></div>
      </div>
      
      {/* Hero Content */}
      <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto animate-fade-in">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          {config?.hero_title || "Reserva tu Mesa"}
          <span className="block text-restaurant-gold">Perfecta</span>
        </h1>
        <p className="text-xl md:text-2xl mb-8 text-gray-200 max-w-2xl mx-auto leading-relaxed">
          {config?.hero_subtitle || "Vive una experiencia gastronómica única en nuestro restaurante. Reserva ahora y disfruta de sabores excepcionales."}
        </p>
        <Button 
          variant="reserve" 
          size="lg"
          className="animate-slide-up"
          onClick={() => {
            // Trigger the start of reservation directly
            const reservationSection = document.getElementById('reservation');
            if (reservationSection) {
              reservationSection.scrollIntoView({ behavior: 'smooth' });
              // Wait for scroll then trigger the start button
              setTimeout(() => {
                const startButton = document.querySelector('[data-start-reservation]') as HTMLButtonElement;
                if (startButton) {
                  startButton.click();
                }
              }, 500);
            }
          }}
        >
          Hacer Reserva
        </Button>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 text-white animate-bounce">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;