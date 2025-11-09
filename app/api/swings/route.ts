import { NextResponse } from "next/server";
import { swingsBus } from "@/lib/bus";

export async function POST(req: Request) {
  try {
    const swing = await req.json();
    
    // Validate required fields
    const requiredFields = ['bat_speed_mph', 'attack_angle_deg', 'omega_peak_dps'];
    const missingFields = requiredFields.filter(field => swing[field] === undefined);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: "Missing required fields", missingFields },
        { status: 400 }
      );
    }
    
    // Broadcast to event bus
    console.log("[API /swings] 📢 Broadcasting swing to event bus:", swing);
    swingsBus.emit(swing);
    console.log("[API /swings] ✅ Swing broadcasted successfully");
    
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error processing swing:', error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}

