import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Phone, Clock, Star } from "lucide-react";
const RestaurantInfo = () => {
  const features = [{
    icon: <Star className="w-6 h-6 text-restaurant-gold" />,
    title: "Cocina de Autor",
    description: "Platos únicos creados por nuestro chef con ingredientes frescos y locales"
  }, {
    icon: <MapPin className="w-6 h-6 text-restaurant-gold" />,
    title: "Ubicación Privilegiada",
    description: "En el corazón de la ciudad, con vistas espectaculares y fácil acceso"
  }, {
    icon: <Clock className="w-6 h-6 text-restaurant-gold" />,
    title: "Horarios Flexibles",
    description: "Abierto todos los días con horarios de almuerzo y cena adaptados a ti"
  }];
  return <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl font-bold text-restaurant-brown mb-4">
            Sobre Nuestro Restaurante
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Más de 20 años creando experiencias gastronómicas únicas, combinando tradición culinaria 
            con innovación moderna en cada plato que servimos.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => <Card key={index} className="text-center shadow-elegant hover:shadow-glow transition-all duration-300 animate-slide-up">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  {feature.icon}
                </div>
                <CardTitle className="text-restaurant-brown">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>)}
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="shadow-elegant animate-slide-up">
            <CardHeader>
              <CardTitle className="text-restaurant-brown flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Ubicación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold">Dirección:</p>
                <p className="text-muted-foreground">Calle Gourmet 123, Centro Histórico</p>
                <p className="text-muted-foreground">28001 Madrid, España</p>
              </div>
              <div>
                
                
                
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant animate-slide-up">
            <CardHeader>
              <CardTitle className="text-restaurant-brown flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Horarios y Contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold">Horarios de Servicio:</p>
                <p className="text-sm text-muted-foreground">Almuerzo: 12:00 - 16:00</p>
                <p className="text-sm text-muted-foreground">Cena: 19:00 - 23:00</p>
                <p className="text-sm text-muted-foreground">Todos los días</p>
              </div>
              <div>
                <p className="font-semibold flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Contacto:
                </p>
                <p className="text-sm text-muted-foreground">+34 91 123 4567</p>
                <p className="text-sm text-muted-foreground">reservas@restaurante.com</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>;
};
export default RestaurantInfo;