import { getFreshRegions } from "./clientState.js";

export function resetDOM(): void {
    const regions = document.getElementById("all-regions");
    if (regions) regions.innerHTML = getFreshRegions();
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatTime(timeStamp: number): string {
    const date = new Date(timeStamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${day}.${month}. ${hours}:${minutes}:${seconds}`;
}

export async function fetchConfig(name?: string): Promise<unknown> {
    const clientEl = document.getElementById("clientName") as HTMLScriptElement | null;
    if (!clientEl) throw new Error("clientName script element not found");
    const clientName = clientEl.src.split("/").pop()!.replace(".js", "");

    const jsonUrl = name
        ? `/${clientName}/users/${name}.json`
        : `/${clientName}/${clientName}.json`;

    const response = await fetch(jsonUrl);
    if (!response.ok) throw new Error(`HTTP error fetching config: ${response.status}`);
    return response.json();
}

export async function fetchClientConfig(clientName: string): Promise<unknown> {
    const response = await fetch(`/${clientName}/${clientName}.json`);
    if (!response.ok) throw new Error(`HTTP error fetching client config for ${clientName}: ${response.status}`);
    return response.json();
}

export async function fetchUserConfig(clientName: string, userName: string): Promise<unknown> {
    const response = await fetch(`/get-user/${userName}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: clientName
    });
    if (!response.ok) throw new Error(`HTTP error fetching user config ${userName}@${clientName}: ${response.status}`);
    return response.json();
}
