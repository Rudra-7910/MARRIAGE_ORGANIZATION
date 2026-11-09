import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { httpError } from "../middleware/error-handler.js";

export const storageConfigured = Boolean(
  process.env.AWS_REGION && process.env.S3_BUCKET,
);
// All photos stay private. The SDK loads local profiles or the AWS deployment role.
export const storage = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  // On Vercel, exchange its identity token for short-lived AWS role credentials.
  // Local profiles and AWS-hosted instance roles keep using the SDK defaults.
  credentials: process.env.AWS_ROLE_ARN
    ? awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN })
    : undefined,
  // Tests upload only to an isolated local object store, never a real bucket.
  endpoint:
    process.env.NODE_ENV === "test"
      ? process.env.AWS_ENDPOINT_URL_S3
      : undefined,
  forcePathStyle: process.env.NODE_ENV === "test",
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
      Bucket: process.env.S3_BUCKET,
      Delete: {
        Objects: [...new Set(keys)].map((Key) => ({ Key })),
        Quiet: true,
      },
    }),
  );
  if (result.Errors?.length) throw new Error("Could not remove stored photos.");
}
