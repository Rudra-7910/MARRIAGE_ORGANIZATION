import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { env } from "./env.js";
import { httpError } from "../middleware/error-handler.js";

export const storageConfigured = Boolean(env.awsRegion && env.s3Bucket);
// All photos stay private. The SDK loads local profiles or the AWS deployment role.
export const storage = new S3Client({
  region: env.awsRegion || "ap-south-1",
  // Tests upload only to an isolated local object store, never a real bucket.
  endpoint: env.nodeEnv === "test" ? process.env.AWS_ENDPOINT_URL_S3 : undefined,
  forcePathStyle: env.nodeEnv === "test",
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  maxAttempts: 2,
  requestHandler: { connectionTimeout: 5000, requestTimeout: 15000 },
});
export function requireStorage() {
  if (!storageConfigured)
    throw httpError(
      503,
      "STORAGE_UNAVAILABLE",
      "Photo storage is not configured yet. Please contact an organizer.",
    );
}
export async function deleteMedia(keys: string[]) {
  const result = await storage.send(
    new DeleteObjectsCommand({
      Bucket: env.s3Bucket,
      Delete: {
        Objects: [...new Set(keys)].map((Key) => ({ Key })),
        Quiet: true,
      },
    }),
  );
  if (result.Errors?.length) throw new Error("Could not remove stored photos.");
}
