import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronLeft, Calendar, Users, MapPin, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ReservationData {
  date: Date;
  time: string;
  guests: number;
}

interface ReservationStep2Props {
  reservationData: ReservationData;
  onBack: () => void;
  onComplete: () => void;
}

const ReservationStep2 = ({ reservationData, onBack, onComplete }: ReservationStep2Props) => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    prefix: "+34",
    comments: "",
    hasAllergies: "",
    termsAccepted: false,
    dataProcessingAccepted: false,
    marketingAccepted: false
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.email || 
        !formData.termsAccepted || !formData.dataProcessingAccepted) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos obligatorios y acepta los términos.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // First create or get customer
      let customerId;
      const { data: existingCustomer, error: customerCheckError } = await supabase
        .from('customers')
        .select('id')
        .eq('email', formData.email)
        .maybeSingle();

      if (customerCheckError) {
        throw customerCheckError;
      }

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        // Create new customer
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: `${formData.firstName} ${formData.lastName}`,
            email: formData.email,
            phone: formData.phone ? `${formData.prefix} ${formData.phone}` : null
          })
          .select('id')
          .single();

        if (customerError) {
          throw customerError;
        }
        
        customerId = newCustomer.id;
      }

      // Create reservation
      const { error: reservationError } = await supabase
        .from('reservations')
        .insert({
          customer_id: customerId,
          date: reservationData.date.toISOString().split('T')[0],
          time: reservationData.time,
          guests: reservationData.guests,
          special_requests: formData.comments || null,
          status: 'pending'
        });

      if (reservationError) {
        throw reservationError;
      }

      toast({
        title: "¡Reserva realizada!",
        description: `Reserva confirmada para ${reservationData.guests} personas el ${reservationData.date.toLocaleDateString()} a las ${reservationData.time}.`,
      });

      onComplete();

    } catch (error) {
      console.error('Error creating reservation:', error);
      toast({
        title: "Error al crear reserva",
        description: "Ha ocurrido un error. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5);
  };

  return (
    <Card className="max-w-4xl mx-auto shadow-elegant">
      <CardHeader className="text-center border-b">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="p-2">
            <ChevronLeft className="w-4 h-4" />
            <span className="sr-only">Volver</span>
          </Button>
          <CardTitle className="text-2xl text-restaurant-brown">
            NAPOLIT 3
          </CardTitle>
          <div className="w-10"></div>
        </div>
        
        {/* Progress indicators */}
        <div className="flex justify-center gap-8 mt-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">
              ✓
            </div>
            <span className="text-sm text-green-600">Encontrar</span>
          </div>
          <div className="w-16 h-0.5 bg-green-500 mt-4"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
              2
            </div>
            <span className="text-sm font-medium">Información</span>
          </div>
          <div className="w-16 h-0.5 bg-gray-300 mt-4"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm">
              3
            </div>
            <span className="text-sm text-gray-600">Adicional</span>
          </div>
          <div className="w-16 h-0.5 bg-gray-300 mt-4"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm">
              4
            </div>
            <span className="text-sm text-gray-600">Confirmación</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* Reservation summary */}
        <div className="bg-muted p-4 rounded-lg mb-6">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {reservationData.date.toLocaleDateString('es-ES', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
              })}, {formatTime(reservationData.time)}h
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {reservationData.guests} personas
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Rue de la Tapia 23, A Coruña, 15679, España
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            Disponen de 1 hora y media de uso de su mesa. Se ruega llegar a la hora asignada para no perder la reserva.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nombre</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Nombre"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apellidos</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Apellidos"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Email"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prefix">Prefijo</Label>
              <Input
                id="prefix"
                value={formData.prefix}
                onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                placeholder="+34"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Teléfono"
              />
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-2">
            <Label htmlFor="comments">Introduce un comentario sobre la reserva</Label>
            <textarea
              id="comments"
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              placeholder="Comentarios adicionales..."
              className="w-full px-3 py-2 border border-input rounded-md resize-none h-20 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Allergies */}
          <div className="space-y-3">
            <Label>¿Tiene algún comensal alguna intolerancia/alergia?</Label>
            <RadioGroup 
              value={formData.hasAllergies} 
              onValueChange={(value) => setFormData({ ...formData, hasAllergies: value })}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="allergies-yes" />
                <Label htmlFor="allergies-yes">Sí</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="allergies-no" />
                <Label htmlFor="allergies-no">No</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Checkboxes */}
          <div className="space-y-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={formData.termsAccepted}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, termsAccepted: checked as boolean })
                }
              />
              <Label htmlFor="terms" className="text-sm leading-5">
                <span className="text-blue-600 underline">Acepto las condiciones de uso, política de privacidad y aviso legal</span>
              </Label>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="dataProcessing"
                checked={formData.dataProcessingAccepted}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, dataProcessingAccepted: checked as boolean })
                }
              />
              <Label htmlFor="dataProcessing" className="text-sm leading-5">
                <span className="text-blue-600 underline">Acepto el Tratamiento de Datos y Política de Privacidad</span>
              </Label>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="marketing"
                checked={formData.marketingAccepted}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, marketingAccepted: checked as boolean })
                }
              />
              <Label htmlFor="marketing" className="text-sm leading-5">
                Quiero recibir información comercial del restaurante por mail y SMS
              </Label>
            </div>
          </div>

          {/* Submit button */}
          <div className="flex justify-center pt-6">
            <Button 
              type="submit" 
              className="w-full md:w-auto px-12 py-3 bg-primary hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? "PROCESANDO..." : "RESERVAR"}
            </Button>
          </div>
        </form>

        {/* Legal text */}
        <div className="mt-6 text-xs text-muted-foreground space-y-2">
          <p><strong>Información básica sobre protección de datos de carácter personal</strong></p>
          <p>El cumplimiento del Reglamento General de Protección de Datos de Carácter Personal se informa al cliente que se informa de lo siguiente:</p>
          <p><strong>Responsable:</strong> NAPOLIT 006 (Ver más)</p>
          <p><strong>Finalidad:</strong> La prestación de servicios y la gestión de la relación comercial. Gestión de la publicidad para terceros restaurantes.</p>
          <p><strong>Legitimación:</strong> Consentimiento del responsable en el que el interesado se presto.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReservationStep2;