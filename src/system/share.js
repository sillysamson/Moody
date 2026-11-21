import { Capacitor } from "@capacitor/core";
import { shareFile } from "./native.js";
export async function shareBackup(json, name) {
  if (Capacitor.isNativePlatform()) { await shareFile(name, "application/json", json); return; } // a real file through the system Sharesheet
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch { return false; }
}
