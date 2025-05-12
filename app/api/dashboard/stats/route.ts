import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  // For debugging purposes
  console.log("API route called: /api/dashboard/stats");

  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get("workspaceId");
    
    // Validate the request
    if (!workspaceId) {
      console.log("Missing workspaceId parameter");
      return NextResponse.json(
        { error: "Missing required parameter: workspaceId" },
        { status: 400 }
      );
    }

    console.log("API: Fetching invoices for workspace:", workspaceId);

    // Use supabaseAdmin instead of regular supabase client to bypass auth
    try {
      const { data: invoices, error: invoicesError } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (invoicesError) {
        console.error("Error fetching invoices:", invoicesError);
        
        // If the error is a "relation does not exist" error (table doesn't exist yet)
        // Return empty stats instead of an error
        if (invoicesError.message && invoicesError.message.includes("does not exist")) {
          console.log("Invoices table doesn't exist, returning empty stats");
          return NextResponse.json({
            invoices: {
              totalCount: 0,
              totalAmount: 0,
              averageAmount: 0,
              paidCount: 0,
              unpaidCount: 0,
              overdueCount: 0
            },
            timestamp: new Date().toISOString(),
            source: 'realtime'
          });
        }
        
        return NextResponse.json(
          { error: `Failed to fetch invoice data: ${invoicesError.message}` },
          { status: 500 }
        );
      }

      console.log("API: Invoices fetched:", invoices?.length || 0);

      // If no invoices were found, return empty stats instead of calculating
      if (!invoices || invoices.length === 0) {
        console.log("No invoices found, returning empty stats");
        return NextResponse.json({
          invoices: {
            totalCount: 0,
            totalAmount: 0,
            averageAmount: 0,
            paidCount: 0,
            unpaidCount: 0,
            overdueCount: 0
          },
          timestamp: new Date().toISOString(),
          source: 'realtime'
        });
      }

      // Calculate statistics from invoices
      const validInvoices = invoices?.filter(inv => inv.total !== null && inv.total !== undefined) || [];
      
      const totalAmount = validInvoices.reduce((sum, inv) => {
        const amount = typeof inv.total === 'string' ? parseFloat(inv.total) : inv.total;
        return sum + (!isNaN(amount) ? amount : 0);
      }, 0);
      
      const totalCount = validInvoices.length;
      const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;
      
      // Count invoices by status
      const paidCount = validInvoices.filter(inv => inv.balance === 0).length;
      const unpaidCount = validInvoices.filter(inv => inv.balance === inv.total).length;
      const overdueCount = validInvoices.filter(inv => {
        if (!inv.due_date) return false;
        return new Date(inv.due_date) < new Date() && inv.balance > 0;
      }).length;

      // Prepare and return the response
      const response = {
        invoices: {
          totalCount,
          totalAmount,
          averageAmount,
          paidCount,
          unpaidCount,
          overdueCount
        },
        timestamp: new Date().toISOString(),
        source: 'realtime'
      };

      console.log("API: Returning stats:", response);
      return NextResponse.json(response);
    } catch (dbError) {
      console.error("Database query failed:", dbError);
      return NextResponse.json(
        { error: `Database query error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Dashboard stats API error:", error);
    return NextResponse.json(
      { error: `An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 