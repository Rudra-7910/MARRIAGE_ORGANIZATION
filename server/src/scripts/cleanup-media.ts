import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { deleteMedia, requireStorage } from "../config/storage.js";
import { Photo } from "../modules/media/media.models.js";

// Explicit maintenance command, not a worker or automatic public-data deletion.
async function cleanup() {
  requireStorage();
  await connectDatabase();
  const yesterday = new Date(Date.now() - 86400000);
  let removed = 0,
    failed = 0;
  try {
    const photos = await Photo.find({
      $or: [
        { cleanupPending: true },
        { state: "uploading", updatedAt: { $lt: yesterday } },
        { state: "verifying", leaseUntil: { $lt: yesterday } },
        { "abandonedKeys.0": { $exists: true }, createdAt: { $lt: yesterday } },
      ],
    })
      .select("+reviewKey +stagingKey +abandonedKeys")
      .sort({ updatedAt: 1 })
      .limit(200);
    for (const photo of photos) {
      if (photo.state === "uploading" || photo.state === "verifying") {
        const expired = await Photo.updateOne(
          { _id: photo._id, __v: photo.__v, state: photo.state },
          {
            $set: { state: "rejected", cleanupPending: true },
            $inc: { __v: 1 },
          },
        );
        if (!expired.matchedCount) continue;
        photo.state = "rejected";
        photo.__v++;
      }
      const keys = [photo.stagingKey, ...photo.abandonedKeys];
      if (photo.state === "rejected") keys.push(photo.reviewKey);
      try {
        await deleteMedia(keys);
        await Photo.updateOne(
          { _id: photo._id, __v: photo.__v },
          {
            $set: {
              cleanupPending: false,
              ...(photo.createdAt < yesterday ? { abandonedKeys: [] } : {}),
            },
          },
        );
        removed++;
      } catch {
        failed++;
      }
    }
    console.info(
      `[media] Cleaned ${removed} records; ${failed} storage operations need a retry.`,
    );
    if (failed) process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}
cleanup().catch(() => {
  console.error(
    "[media] Cleanup failed. Check database and private S3 configuration.",
  );
  process.exitCode = 1;
});
