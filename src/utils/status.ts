export function getStatus(convPrice: number, greenMax: number, yellowMax: number) {
    if (convPrice < greenMax) return { color: "green", label: "✅ Grün" };
    if (convPrice < yellowMax) return { color: "yellow", label: "⚠️ Gelb" };
    return { color: "red", label: "❌ Rot" };
}