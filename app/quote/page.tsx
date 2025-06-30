import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Mail } from "lucide-react";

const QuotePage = () => {
  const invoice = {
    quoteNumber: "Q-2024-0012",
    issueDate: "2024-06-20",
    validUntil: "2024-07-20",
    client: {
      name: "InnovateTech Solutions AB",
      address: "Innovationsgatan 1",
      city: "123 45 Stockholm",
      country: "Sverige",
      orgNr: "556123-4567",
    },
    company: {
      name: "Teamhub Solutions",
      address: "Lösningvägen 22",
      city: "543 21 Göteborg",
      country: "Sverige",
      contact: "kevin@teamhub.se",
    },
    items: [
      {
        id: 1,
        description: "Fas 1: SAP Integration & Databas-setup",
        details: "Initial analys, API-endpoint, databas-migration och grundläggande IDOC-parser.",
        quantity: 1,
        unit: "Lumpsumma",
        price: 45000,
      },
      {
        id: 2,
        description: "Fas 2: Utveckling av IDOC Parser & Mapper",
        details: "Fullständig implementation av parser för Projekt- och Kunddata.",
        quantity: 80,
        unit: "Timmar",
        price: 1100,
      },
      {
        id: 3,
        description: "Fas 3: Frontend-implementation & Testning",
        details: "Byggnation av gränssnitt i Teamhub för att visa SAP-data, samt end-to-end-testning.",
        quantity: 60,
        unit: "Timmar",
        price: 1100,
      },
      {
        id: 4,
        description: "Projektledning & Administration",
        details: "Kontinuerlig uppföljning, möten och dokumentation.",
        quantity: 20,
        unit: "Timmar",
        price: 950,
      },
    ],
    subtotal: 218000,
    taxRate: 0.25,
    taxAmount: 54500,
    total: 272500,
  };

  return (
    <div className="bg-muted/40 min-h-screen p-4 sm:p-8 md:p-12">
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader className="bg-muted/50 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-3xl font-bold text-primary">Teamhub Solutions</h1>
              <p className="text-muted-foreground">{invoice.company.address}, {invoice.company.city}</p>
              <p className="text-muted-foreground">{invoice.company.contact}</p>
            </div>
            <div className="text-left sm:text-right">
              <h2 className="text-2xl font-semibold">Offert</h2>
              <p className="text-muted-foreground">{invoice.quoteNumber}</p>
              <Badge variant="secondary" className="mt-2 text-sm">
                Giltig till: {invoice.validUntil}
              </Badge>
            </div>
          </div>
          <Separator className="my-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="font-semibold text-muted-foreground">Offert till</p>
              <p className="font-bold">{invoice.client.name}</p>
              <p>{invoice.client.address}</p>
              <p>{invoice.client.city}</p>
              <p>Org.nr: {invoice.client.orgNr}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="font-semibold text-muted-foreground">Datum</p>
              <p>{invoice.issueDate}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/2">Beskrivning</TableHead>
                <TableHead className="text-right">Antal</TableHead>
                <TableHead className="text-right">Pris per enhet</TableHead>
                <TableHead className="text-right">Summa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium">{item.description}</p>
                    <p className="text-sm text-muted-foreground">{item.details}</p>
                  </TableCell>
                  <TableCell className="text-right">{item.quantity} <span className="text-muted-foreground text-xs">{item.unit}</span></TableCell>
                  <TableCell className="text-right">{item.price.toLocaleString("sv-SE")} kr</TableCell>
                  <TableCell className="text-right font-medium">{(item.price * item.quantity).toLocaleString("sv-SE")} kr</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator className="my-8" />
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-2">
              <div className="flex justify-between">
                <p className="text-muted-foreground">Delsumma</p>
                <p>{invoice.subtotal.toLocaleString("sv-SE")} kr</p>
              </div>
              <div className="flex justify-between">
                <p className="text-muted-foreground">Moms (25%)</p>
                <p>{invoice.taxAmount.toLocaleString("sv-SE")} kr</p>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <p>Totalsumma</p>
                <p>{invoice.total.toLocaleString("sv-SE")} kr</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between items-start gap-4 p-6 sm:p-8 bg-muted/50">
          <div className="text-sm text-muted-foreground">
            <p className="font-semibold">Betalningsvillkor</p>
            <p>30 dagar netto. Dröjsmålsränta enligt räntelagen.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline"><Mail className="mr-2 h-4 w-4" /> Skicka som e-post</Button>
            <Button><Download className="mr-2 h-4 w-4" /> Ladda ner PDF</Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default QuotePage; 