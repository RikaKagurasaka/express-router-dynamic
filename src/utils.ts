import fsp from "fs/promises";

export async function existsAsync(filename: string): Promise<boolean>{
    try {
        await fsp.access(filename)
        return true
    } catch (e) {
        return false
    }
}

export interface Hooks {
    onDestroy?: () => void
}

export const hookNames = ["onDestroy"]
