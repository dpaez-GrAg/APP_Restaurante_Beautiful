import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import cartaData from "@/data/cartaData.json";

const CartaPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("carta");

  const { cartaPrincipal, bodega, menuGrupos } = cartaData;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-20 container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 h-18">
            <TabsTrigger value="carta" className="text-lg py-3 h-full">
              Carta
            </TabsTrigger>
            <TabsTrigger value="bodega" className="text-lg py-3 h-full">
              Bodega
            </TabsTrigger>
            <TabsTrigger value="menus" className="text-lg py-3 h-full">
              Menús
            </TabsTrigger>
          </TabsList>

          <TabsContent value="carta" className="space-y-8">
            <h2 className="text-3xl font-bold text-restaurant-brown">Carta Principal</h2>

            <div className="grid gap-6 md:grid-cols-2">
              {Object.entries(cartaPrincipal).map(([key, items]) => {
                const titles = {
                  entrantes: "ENTRANTES",
                  verduras: "VERDURAS",
                  carnes: "CARNES",
                  burgers: "BURGERS - VACUNO 100%",
                  ensaladas: "ENSALADAS",
                };

                const showHalfIndicator = ["verduras", "carnes", "ensaladas"].includes(key);

                return (
                  <Card key={key}>
                    <CardHeader>
                      {showHalfIndicator ? (
                        <div className="flex justify-between items-center border-b pb-2">
                          <CardTitle className="text-xl text-restaurant-brown">
                            {titles[key as keyof typeof titles]}
                          </CardTitle>
                          <div className="text-sm text-muted-foreground pr-16">1/2</div>
                        </div>
                      ) : (
                        <CardTitle className="text-xl text-restaurant-brown border-b pb-2">
                          {titles[key as keyof typeof titles]}
                        </CardTitle>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3">
                        {items.map((item, index) => (
                          <div key={index} className="py-2">
                            <div className="flex justify-between items-start">
                              <span className="font-medium">{item.name}</span>
                              <div className="flex gap-2">
                                <Badge variant="secondary" className="text-restaurant-brown">
                                  {item.price}
                                </Badge>
                                {item.price2 && (
                                  <Badge variant="secondary" className="text-restaurant-brown">
                                    {item.price2}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {item.description && (
                              <p className="text-sm text-muted-foreground mt-1 italic">{item.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="bodega" className="space-y-8">
            <h2 className="text-3xl font-bold text-restaurant-brown">Bodega</h2>

            <div className="grid gap-6 md:grid-cols-2">
              {Object.entries(bodega).map(([key, wines]) => {
                const titles = {
                  rioja: "D.O. RIOJA",
                  riberaDelDuero: "D.O. RIBERA DEL DUERO",
                  valdeorras: "D.O. VALDEORRAS",
                  monterrei: "D.O. MONTERREI",
                  malbecArgentina: "VALLE DE UCO - MALBEC ARGENTINA",
                  ribeiraSacra: "D.O. RIBEIRA SACRA",
                  castillaYLeon: "I.G.P. VINO DE LA TIERRA DE CASTILLA Y LEÓN",
                  ribeiro: "D.O. RIBEIRO",
                  riasBaixas: "D.O. RÍAS BAIXAS",
                  cava: "CAVA",
                  champan: "CHAMPÁN",
                };

                return (
                  <Card key={key}>
                    <CardHeader>
                      <CardTitle className="text-xl text-restaurant-brown border-b pb-2">
                        {titles[key as keyof typeof titles]}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3">
                        {wines.map((wine, index) => (
                          <div key={index} className="py-2">
                            <div className="flex justify-between items-start">
                              <span className="font-medium">{wine.name}</span>
                              <Badge variant="secondary" className="text-restaurant-brown">
                                {wine.price}
                              </Badge>
                            </div>

                            {wine.description && (
                              <div className="text-sm text-muted-foreground mt-1 italic">
                                {Array.isArray(wine.description) ? (
                                  wine.description.map((line: string, i: number) => <p key={i}>{line}</p>)
                                ) : (
                                  <p>{wine.description}</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="menus" className="space-y-8">
            <h2 className="text-3xl font-bold text-restaurant-brown">Menús para Grupos</h2>

            <div className="grid gap-6 md:grid-cols-2">
              {menuGrupos.map((menu) => (
                <Card key={menu.id} className="h-fit">
                  <CardHeader>
                    <CardTitle className="text-xl text-restaurant-brown border-b pb-2">{menu.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-10 text-center">
                      {Object.entries(menu.courses).map(([key, course]) => (
                        <div key={key}>
                          <h4 className="font-semibold text-restaurant-brown mb-2">{course.title}</h4>
                          <div className="space-y-1">
                            {course.options.map((option, index) => (
                              <div key={index} className="py-1">
                                <span className="text-sm">{option}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {menu.wine && (
                        <div>
                          <h4 className="font-semibold text-restaurant-brown mb-2">Vino:</h4>
                          <div className="text-sm">
                            {Array.isArray(menu.wine) ? (
                              menu.wine.map((line: string, i: number) => <p key={i}>{line}</p>)
                            ) : (
                              <p>{menu.wine}</p>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="space-y-2 mb-4">
                        <Badge variant="secondary" className="text-restaurant-brown mx-auto text-md">
                          {menu.price}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {cartaData.menuNotes && (
              <div className="space-y-4">
                <Card className="border-gray-200">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-restaurant-brown mb-3">Información importante:</h3>
                    <div className="space-y-2 text-sm text-gray-700">
                      <p>• {cartaData.menuNotes.general}</p>
                      <p>• {cartaData.menuNotes.consumiciones}</p>
                      <p>• {cartaData.menuNotes.consumiciones2}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
        <div className="text-center text-sm text-muted-foreground mt-8 p-4 bg-gray-50 rounded-lg">
          <p>PRECIOS EN EUROS</p>
          <p>TODOS LOS PRECIOS LLEVAN INCLUIDO EL 10% DE IVA</p>
        </div>
      </div>
    </div>
  );
};

export default CartaPage;
