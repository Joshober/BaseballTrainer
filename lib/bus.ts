// lib/bus.ts
type Listener = (data: any) => void;

class Bus {
  private listeners = new Set<Listener>();
  
  on(l: Listener) {
    this.listeners.add(l);
    console.log(`[Bus] 👂 Listener added. Total listeners: ${this.listeners.size}`);
    return () => {
      this.listeners.delete(l);
      console.log(`[Bus] 🗑️ Listener removed. Total listeners: ${this.listeners.size}`);
    };
  }
  
  emit(data: any) {
    console.log(`[Bus] 📢 Emitting event to ${this.listeners.size} listener(s):`, data);
    for (const l of Array.from(this.listeners)) {
      try {
        l(data);
      } catch (error) {
        console.error('[Bus] ❌ Error in bus listener:', error);
      }
    }
    console.log(`[Bus] ✅ Event emitted to all listeners`);
  }
}

export const swingsBus = new Bus();

