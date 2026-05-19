import type { PlayApiClient, DataSafetyRequest, DataSafetyResponse } from "@gpc-cli/api";
import { readFile, stat } from "node:fs/promises";
import { GpcError } from "../errors.js";

const MAX_CSV_BYTES = 1 * 1024 * 1024;

export async function updateDataSafety(
  client: PlayApiClient,
  packageName: string,
  data: DataSafetyRequest,
): Promise<DataSafetyResponse> {
  return client.dataSafety.update(packageName, data);
}

export async function importDataSafety(
  client: PlayApiClient,
  packageName: string,
  filePath: string,
): Promise<DataSafetyResponse> {
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    throw new GpcError(
      `Cannot read data safety CSV: "${filePath}"`,
      "FILE_NOT_FOUND",
      1,
      "Check the file path and ensure the file exists.",
    );
  }
  if (fileStat.size === 0) {
    throw new GpcError(
      `Data safety CSV is empty: "${filePath}"`,
      "INVALID_INPUT",
      1,
      "Export your data safety form from Play Console and provide the CSV.",
    );
  }
  if (fileStat.size > MAX_CSV_BYTES) {
    throw new GpcError(
      `Data safety CSV exceeds 1 MB (${fileStat.size} bytes): "${filePath}"`,
      "FILE_TOO_LARGE",
      1,
      "The CSV should be a few KB. Check that you are passing the correct file.",
    );
  }
  const csvContent = await readFile(filePath, "utf-8");
  return updateDataSafety(client, packageName, { safetyLabels: csvContent });
}
