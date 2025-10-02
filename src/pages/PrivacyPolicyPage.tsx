import { useRestaurantConfig } from "@/contexts/RestaurantConfigContext";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, Mail, Phone, MapPin } from "lucide-react";

const PrivacyPolicyPage = () => {
  const { config } = useRestaurantConfig();

  const currentDate = new Date().toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-20 container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <Shield className="w-16 h-16 text-restaurant-gold" />
          </div>
          <h1 className="text-4xl font-bold text-restaurant-brown mb-2">Política de Privacidad</h1>
          <p className="text-muted-foreground">Última actualización: {currentDate}</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl text-restaurant-brown">1. Responsable del Tratamiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              De conformidad con lo establecido en el Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de
              27 de abril de 2016, relativo a la protección de las personas físicas en lo que respecta al tratamiento de
              datos personales (RGPD) y la Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y
              garantía de los derechos digitales (LOPDGDD), le informamos:
            </p>

            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="font-semibold">Responsable del tratamiento:</p>
              <p className="flex items-center gap-2">
                <strong>Identidad:</strong> {config?.restaurant_name || "Nombre del Restaurante"}
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                <span>
                  <strong>Dirección:</strong> {config?.contact_address || "Dirección completa del restaurante"}
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span>
                  <strong>Email:</strong>{" "}
                  <a href={`mailto:${config?.contact_email}`} className="text-restaurant-gold hover:underline">
                    {config?.contact_email || "info@restaurante.com"}
                  </a>
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span>
                  <strong>Teléfono:</strong> {config?.contact_phone || "+34 XXX XXX XXX"}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl text-restaurant-brown">2. Finalidad del Tratamiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Los datos personales que nos proporcione serán tratados con las siguientes finalidades:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Gestión de reservas:</strong> Procesar y gestionar sus reservas de mesa, incluyendo la
                confirmación, modificación o cancelación de las mismas.
              </li>
              <li>
                <strong>Comunicaciones comerciales:</strong> Enviarle información sobre nuestros servicios, ofertas
                especiales, eventos y promociones, siempre que haya prestado su consentimiento expreso.
              </li>
              <li>
                <strong>Mejora de servicios:</strong> Analizar sus preferencias y comportamiento para mejorar nuestros
                servicios y personalizar su experiencia.
              </li>
              <li>
                <strong>Cumplimiento legal:</strong> Cumplir con las obligaciones legales aplicables a nuestra
                actividad.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl text-restaurant-brown">3. Legitimación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>La base legal para el tratamiento de sus datos personales es:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Ejecución de un contrato:</strong> El tratamiento es necesario para la ejecución del servicio de
                reserva solicitado por usted.
              </li>
              <li>
                <strong>Consentimiento:</strong> Para el envío de comunicaciones comerciales, contamos con su
                consentimiento expreso, que podrá retirar en cualquier momento.
              </li>
              <li>
                <strong>Interés legítimo:</strong> Para la mejora de nuestros servicios y la gestión de la relación
                comercial.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl text-restaurant-brown">4. Conservación de Datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Sus datos personales serán conservados durante los siguientes plazos:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Datos de reservas:</strong> Se conservarán durante 3 años desde la fecha de la reserva, salvo
                que sea necesario conservarlos por obligaciones legales.
              </li>
              <li>
                <strong>Datos de clientes sin actividad:</strong> Se conservarán durante 2 años desde la última
                interacción con nuestros servicios.
              </li>
              <li>
                <strong>Comunicaciones comerciales:</strong> Hasta que retire su consentimiento o solicite la baja.
              </li>
            </ul>
            <p className="text-sm text-muted-foreground mt-4">
              Transcurridos estos plazos, los datos serán eliminados o anonimizados, salvo que exista una obligación
              legal de conservarlos por un período superior.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl text-restaurant-brown">5. Destinatarios de los Datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Sus datos personales no serán cedidos a terceros, salvo en los siguientes casos:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Cuando exista una obligación legal.</li>
              <li>
                A proveedores de servicios tecnológicos necesarios para la prestación del servicio (hosting, sistemas de
                gestión), que actúan como encargados del tratamiento bajo nuestras instrucciones.
              </li>
            </ul>
            <p className="font-semibold mt-4">Transferencias internacionales:</p>
            <p>
              No se realizan transferencias internacionales de datos fuera del Espacio Económico Europeo (EEE). Todos
              nuestros servidores y sistemas están ubicados dentro de la Unión Europea.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl text-restaurant-brown">6. Derechos del Usuario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Puede ejercer los siguientes derechos en cualquier momento:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Derecho de acceso:</strong> Conocer qué datos personales estamos tratando sobre usted.
              </li>
              <li>
                <strong>Derecho de rectificación:</strong> Solicitar la corrección de datos inexactos o incompletos.
              </li>
              <li>
                <strong>Derecho de supresión:</strong> Solicitar la eliminación de sus datos cuando ya no sean
                necesarios.
              </li>
              <li>
                <strong>Derecho de oposición:</strong> Oponerse al tratamiento de sus datos.
              </li>
              <li>
                <strong>Derecho de limitación:</strong> Solicitar la limitación del tratamiento de sus datos.
              </li>
              <li>
                <strong>Derecho de portabilidad:</strong> Recibir sus datos en un formato estructurado y de uso común.
              </li>
              <li>
                <strong>Derecho a retirar el consentimiento:</strong> En cualquier momento, sin que ello afecte a la
                licitud del tratamiento basado en el consentimiento previo.
              </li>
            </ul>

            <Separator className="my-4" />

            <div className=" p-4 rounded-lg">
              <p className="font-semibold mb-2">¿Cómo ejercer sus derechos?</p>
              <p className="mb-2">
                Puede ejercer estos derechos enviando un correo electrónico a{" "}
                <a href={`mailto:${config?.contact_email}`} className="text-restaurant-gold hover:underline">
                  {config?.contact_email}
                </a>{" "}
                o mediante comunicación escrita a nuestra dirección postal, adjuntando copia de su DNI o documento
                equivalente.
              </p>
              <p className="text-sm text-muted-foreground">
                Responderemos a su solicitud en el plazo máximo de un mes desde la recepción de la misma.
              </p>
            </div>

            <div className=" p-4 rounded-lg mt-4">
              <p className="font-semibold mb-2">Derecho a reclamar ante la autoridad de control:</p>
              <p className="text-sm">
                Si considera que el tratamiento de sus datos personales vulnera la normativa, puede presentar una
                reclamación ante la Agencia Española de Protección de Datos (AEPD):
              </p>
              <ul className="text-sm mt-2 space-y-1">
                <li>
                  <strong>Web:</strong>{" "}
                  <a
                    href="https://www.aepd.es"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    www.aepd.es
                  </a>
                </li>
                <li>
                  <strong>Dirección:</strong> C/ Jorge Juan, 6, 28001 Madrid
                </li>
                <li>
                  <strong>Teléfono:</strong> 901 100 099 / 912 663 517
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl text-restaurant-brown">7. Medidas de Seguridad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Hemos adoptado las medidas técnicas y organizativas necesarias para garantizar la seguridad de sus datos
              personales y evitar su alteración, pérdida, tratamiento o acceso no autorizado, teniendo en cuenta el
              estado de la tecnología, la naturaleza de los datos almacenados y los riesgos a los que están expuestos.
            </p>
            <p>Entre las medidas implementadas se encuentran:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Cifrado de datos en tránsito (HTTPS/SSL)</li>
              <li>Cifrado de datos en reposo</li>
              <li>Control de acceso mediante autenticación y autorización</li>
              <li>Copias de seguridad periódicas</li>
              <li>Auditorías de seguridad regulares</li>
              <li>Formación del personal en protección de datos</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl text-restaurant-brown">8. Cookies y Tecnologías Similares</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Nuestro sitio web utiliza cookies y tecnologías similares para mejorar su experiencia de navegación y
              analizar el uso del sitio.
            </p>

            <div className="space-y-3">
              <div>
                <p className="font-semibold">Cookies técnicas (necesarias):</p>
                <p className="text-sm text-muted-foreground">
                  Imprescindibles para el funcionamiento del sitio web y la gestión de reservas.
                </p>
              </div>

              <div>
                <p className="font-semibold">Cookies analíticas:</p>
                <p className="text-sm text-muted-foreground">
                  Nos permiten analizar el uso del sitio web para mejorar nuestros servicios. Estas cookies requieren su
                  consentimiento.
                </p>
              </div>
            </div>

            <p className="text-sm mt-4">
              Puede configurar su navegador para rechazar cookies o eliminar las existentes. Sin embargo, esto puede
              afectar a la funcionalidad del sitio web.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl text-restaurant-brown">9. Menores de Edad</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Nuestros servicios están dirigidos a personas mayores de 18 años. No recopilamos intencionadamente datos
              personales de menores de edad. Si tiene conocimiento de que un menor ha proporcionado datos personales,
              por favor contacte con nosotros para que podamos eliminarlos.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl text-restaurant-brown">10. Modificaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Nos reservamos el derecho a modificar la presente Política de Privacidad para adaptarla a cambios
              legislativos, jurisprudenciales o en nuestras prácticas empresariales. Cualquier modificación será
              publicada en esta página con indicación de la fecha de la última actualización.
            </p>
            <p className="mt-4">
              Le recomendamos revisar periódicamente esta Política de Privacidad para estar informado sobre cómo
              protegemos sus datos.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6 bg-gray-50">
          <CardContent className="pt-6">
            <p className="text-center text-sm text-muted-foreground">
              Para cualquier consulta sobre esta Política de Privacidad o sobre el tratamiento de sus datos personales,
              puede contactarnos en:
            </p>
            <div className="text-center mt-4 space-y-2">
              <p className="flex items-center justify-center gap-2">
                <Mail className="w-4 h-4" />
                <a href={`mailto:${config?.contact_email}`} className="text-restaurant-gold hover:underline">
                  {config?.contact_email}
                </a>
              </p>
              <p className="flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" />
                <span>{config?.contact_phone}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
