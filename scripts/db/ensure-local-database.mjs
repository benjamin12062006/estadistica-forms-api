import { mkdir, open } from 'node:fs/promises';
import { resolve } from 'node:path';

const dataDirectory = resolve('.data');
const databasePath = resolve(dataDirectory, 'estadistica-dev.db');

await mkdir(dataDirectory, { recursive: true });
const database = await open(databasePath, 'a');
await database.close();
