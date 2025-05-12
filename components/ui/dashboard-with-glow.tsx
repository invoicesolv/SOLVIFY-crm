"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { BarChart, TrendingUp, Users, CreditCard } from "lucide-react";

interface DashboardCardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: React.ReactNode;
}

function DashboardCard({ title, value, change, isPositive, icon }: DashboardCardProps) {
  return (
    <div className="relative">
      <Card className="relative p-6 overflow-hidden">
        <GlowingEffect 
          spread={30} 
          glow={true} 
          disabled={false} 
          proximity={100} 
          inactiveZone={0.01}
          borderWidth={1.5}
          movementDuration={1.5}
          variant="default"
        />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            <div className="p-2 rounded-full bg-muted">
              {icon}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{value}</p>
            <div className="flex items-center text-sm">
              <span className={isPositive ? "text-green-500" : "text-red-500"}>
                {isPositive ? "+" : ""}{change}
              </span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function DashboardWithGlow() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <DashboardCard
        title="Total Revenue"
        value="$45,231.89"
        change="20.1%"
        isPositive={true}
        icon={<CreditCard className="h-4 w-4" />}
      />
      <DashboardCard
        title="Sales"
        value="2,345"
        change="5.1%"
        isPositive={true}
        icon={<TrendingUp className="h-4 w-4" />}
      />
      <DashboardCard
        title="Active Users"
        value="12,234"
        change="10.3%"
        isPositive={true}
        icon={<Users className="h-4 w-4" />}
      />
      <DashboardCard
        title="Conversion Rate"
        value="2.4%"
        change="0.2%"
        isPositive={false}
        icon={<BarChart className="h-4 w-4" />}
      />
    </div>
  );
} 