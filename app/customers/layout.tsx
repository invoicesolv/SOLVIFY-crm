import { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Customers | Vibe CRM',
  description: 'Manage your customer data and sync with Fortnox',
};

export default function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 