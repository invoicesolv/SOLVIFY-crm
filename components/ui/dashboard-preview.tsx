"use client";

import React, { useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { BarChart, Users, DollarSign, ArrowUpRight, Calendar, Clock, PieChart } from "lucide-react";

export function DashboardPreview() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // This is just a placeholder for demonstration
    // In a real application, you would use a library like html-to-image
    // to capture this component as an image
    console.log("Dashboard preview rendered");
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="w-[1248px] h-[765px] bg-neutral-950 p-6 overflow-hidden"
    >
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="bg-neutral-900 border-neutral-800 p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-neutral-500">Total Revenue</p>
              <h3 className="text-2xl font-bold text-white mt-1">$124,563.00</h3>
              <div className="flex items-center mt-2 text-green-500 text-sm">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                <span>+12.5%</span>
              </div>
            </div>
            <div className="bg-blue-500/10 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-500" />
            </div>
          </div>
        </Card>
        
        <Card className="bg-neutral-900 border-neutral-800 p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-neutral-500">Customers</p>
              <h3 className="text-2xl font-bold text-white mt-1">2,834</h3>
              <div className="flex items-center mt-2 text-green-500 text-sm">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                <span>+8.2%</span>
              </div>
            </div>
            <div className="bg-indigo-500/10 p-3 rounded-lg">
              <Users className="h-6 w-6 text-indigo-500" />
            </div>
          </div>
        </Card>
        
        <Card className="bg-neutral-900 border-neutral-800 p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-neutral-500">Conversion Rate</p>
              <h3 className="text-2xl font-bold text-white mt-1">12.5%</h3>
              <div className="flex items-center mt-2 text-green-500 text-sm">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                <span>+3.1%</span>
              </div>
            </div>
            <div className="bg-cyan-500/10 p-3 rounded-lg">
              <PieChart className="h-6 w-6 text-cyan-500" />
            </div>
          </div>
        </Card>
        
        <Card className="bg-neutral-900 border-neutral-800 p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-neutral-500">Upcoming Meetings</p>
              <h3 className="text-2xl font-bold text-white mt-1">8</h3>
              <div className="flex items-center mt-2 text-blue-500 text-sm">
                <Clock className="h-3 w-3 mr-1" />
                <span>Next in 2h</span>
              </div>
            </div>
            <div className="bg-purple-500/10 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-purple-500" />
            </div>
          </div>
        </Card>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-neutral-900 border-neutral-800 p-4 col-span-2 h-[300px]">
          <h3 className="text-lg font-medium text-white mb-4">Revenue Overview</h3>
          <div className="h-[240px] flex items-end gap-2">
            {[40, 65, 50, 80, 95, 70, 85, 75, 90, 60, 80, 75].map((height, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-blue-500/20 rounded-t-sm" 
                  style={{ height: `${height}%` }}
                >
                  <div 
                    className="w-full bg-blue-500 rounded-t-sm" 
                    style={{ height: `${height * 0.7}%` }}
                  ></div>
                </div>
                <span className="text-xs text-neutral-500 mt-2">
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}
                </span>
              </div>
            ))}
          </div>
        </Card>
        
        <Card className="bg-neutral-900 border-neutral-800 p-4 h-[300px]">
          <h3 className="text-lg font-medium text-white mb-4">Customer Distribution</h3>
          <div className="flex items-center justify-center h-[220px]">
            <div className="relative w-[180px] h-[180px]">
              <div className="absolute inset-0 rounded-full border-8 border-blue-500 opacity-20"></div>
              <div 
                className="absolute inset-0 rounded-full border-8 border-transparent border-t-blue-500 border-r-blue-500"
                style={{ transform: 'rotate(45deg)' }}
              ></div>
              <div 
                className="absolute inset-0 rounded-full border-8 border-transparent border-t-indigo-500"
                style={{ transform: 'rotate(180deg)' }}
              ></div>
              <div 
                className="absolute inset-0 rounded-full border-8 border-transparent border-t-cyan-500 border-l-cyan-500"
                style={{ transform: 'rotate(270deg)' }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-2xl font-bold text-white">2,834</span>
                  <p className="text-xs text-neutral-500">Total</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <Card className="bg-neutral-900 border-neutral-800 p-4">
          <h3 className="text-lg font-medium text-white mb-4">Recent Customers</h3>
          <div className="divide-y divide-neutral-800">
            {[
              { name: 'Acme Corporation', revenue: '$12,500', date: '2 days ago' },
              { name: 'Globex Industries', revenue: '$8,750', date: '1 week ago' },
              { name: 'Stark Enterprises', revenue: '$15,200', date: '2 weeks ago' },
              { name: 'Wayne Enterprises', revenue: '$9,300', date: '3 weeks ago' },
            ].map((customer, i) => (
              <div key={i} className="flex justify-between items-center py-3">
                <div>
                  <p className="text-white font-medium">{customer.name}</p>
                  <p className="text-sm text-neutral-500">{customer.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">{customer.revenue}</p>
                  <div className="flex items-center justify-end mt-1 text-green-500 text-xs">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    <span>New customer</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
} 