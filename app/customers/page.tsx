"use client";

import { CustomersView } from "@/components/customers";
import { SidebarDemo } from "@/components/ui/code.demo";

export default function CustomersPage() {
  return (
    <SidebarDemo>
      <div className="p-6">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 flex flex-col gap-2 flex-1 w-full h-full">
          <CustomersView />
        </div>
      </div>
    </SidebarDemo>
  );
} 