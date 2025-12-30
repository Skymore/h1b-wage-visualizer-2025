import { promises as fs } from 'fs';
import * as path from 'path';

export async function readPublicDataJson<T>(relativePath: string): Promise<T | null> {
    const filePath = path.join(process.cwd(), 'public/data', relativePath);
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as T;
    } catch (error) {
        console.error(`Error reading file ${relativePath}:`, error);
        return null;
    }
}
