# AWS S3 photo storage

This replaces the earlier Cloudflare R2 configuration. Upload authorization, quotas, Sharp processing, organizer moderation and the public approved gallery retain their existing behavior.

## Bucket

- Development bucket: `make-my-marriage-rudra-dev-20261106`
- Region: `ap-south-1` (Mumbai)
- General-purpose bucket, ACLs disabled (Bucket owner enforced), all Block Public Access settings on, SSE-S3 encryption.
- One private bucket contains both `staging/` and `review/`; approved photos are not made publicly readable in S3.
- No manual folder creation, public bucket policy, CDN, worker or upload proxy is required.
- Object storage, requests and data transfer incur AWS usage charges. Check AWS Billing for your account's credits and usage.

## Backend configuration

Keep these settings in the gitignored `server/.env`:

```dotenv
AWS_REGION=ap-south-1
S3_BUCKET=make-my-marriage-rudra-dev-20261106
AWS_PROFILE=mmm-local
```

`AWS_PROFILE` selects an existing local AWS CLI profile. It is not a credential by itself. The SDK's default credential chain reads the profile, temporary credentials or AWS workload role. Do not add credentials to React, `VITE_*`, source files or shared screenshots. The old `R2_*` settings are unused.

Local authentication options:

1. Prefer IAM Identity Center temporary credentials if configured: `aws configure sso --profile mmm-local`, then `aws sso login --profile mmm-local`.
2. If using a dedicated restricted development IAM user, attach only [this S3 object policy](aws/s3-iam-policy.json), configure its key with `aws configure --profile mmm-local`, and keep its credentials in the local AWS credentials file with owner-only permissions. Do not grant console access or account-wide S3 permissions to the application identity.
3. On AWS deployment, remove `AWS_PROFILE` and attach the scoped policy to the backend's EC2/ECS IAM role. Do not deploy local developer credentials.

The application's bucket policy can remain empty: the same-account identity policy authorizes the required object operations. No `s3:ListBucket`, `s3:PutObjectAcl`, bucket administration or access to other buckets is needed for the current app.

## Browser access

Apply [s3-cors.json](aws/s3-cors.json) under S3 bucket → Permissions → CORS. It permits signed PUT, GET and HEAD from `http://127.0.0.1:3000` and `http://localhost:3000`. Add the actual deployed HTTPS origin before production. CORS does not make the bucket public or replace signed requests.

## Flow

1. Organizer creates an expiring QR upload link.
2. Guest opens it without a login and selects a photo.
3. Express validates the token and quota, persists the upload record and returns a 90-second signed PUT for a unique `staging/` key.
4. Browser sends the image directly to S3 using the returned signed headers.
5. Express verifies actual image content/size, re-encodes it with Sharp and stores a server-controlled WebP under `review/`.
6. Only an organizer can approve it. Pending/rejected photos cannot appear in the public gallery.
7. Approved content is served through the app's approval check followed by a 60-second signed S3 GET. S3 itself stays private.
8. Rejection/deletion performs object cleanup; failed cleanup is tracked for explicit retry.

## Verify

```bash
aws sts get-caller-identity --profile mmm-local
npm run check
npm run dev
```

The identity command verifies local authentication, not object permissions. Verify object permissions with a tiny disposable photo uploaded through the app: Pending → approve → public gallery/download → remove. Check that a direct unsigned S3 URL cannot read it, a Worker cannot approve it, and an unapproved photo cannot be retrieved through public APIs.

Tests use disposable MongoDB and a local S3-compatible HTTP server. Their fake keys and endpoint are set inside the test process, never saved to `.env` or used against AWS. Unit/integration checks do not prove live AWS configuration; a separate real-cloud smoke test is required.

## Cleanup and retention

`npm run media:cleanup --workspace server` explicitly retries tracked cleanup and rejects uploads abandoned for more than 24 hours. It is not a scheduled worker and does not scan/delete arbitrary bucket contents. A future lifecycle rule may expire only `staging/` after the agreed retention period; do not apply automatic expiry to `review/` or the whole bucket. Bucket versioning is initially disabled; revisit deletion/retention behavior before enabling it.

References: [AWS credentials](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html), [S3 CORS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html), [presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html).

## Verified on 6 November 2026

- Created the development bucket above and saved the exact localhost CORS rule; verified a real S3 preflight response.
- Created IAM user `make-my-marriage-local` without console access, attached only `MakeMyMarriagePhotoStorage`, and configured the approved development key in local profile `mmm-local`. AWS credentials/config files are owner-only (0600), the AWS directory is 0700, and the downloaded credential CSV was removed after secure import. No AWS secrets were added to the repository or frontend.
- Saved `AWS_REGION`, `S3_BUCKET` and `AWS_PROFILE` in the existing `server/.env`, preserving its other values. Installed the officially signed AWS CLI 2.39.5 in the user's local install directory.
- `npm run check` passed: both TypeScript checks, 100 backend tests, 34 frontend tests and both production builds. Tests retain the isolated local object store.
- A separate live AWS smoke test used a disposable local MongoDB replica set and a tiny generated image. Real signed upload/CORS, S3 HEAD/GET, Sharp processing and WebP PUT, pending-photo privacy, Worker moderation denial, organizer approval, gallery listing and signed download passed. An unsigned URL returned 403. Unpublishing blocked new public access; rejection/deletion removed the image.
- Removed the exact disposable S3 test objects and stopped the disposable database. Existing Atlas wedding data was not used or modified by that test.

This completes local S3 integration. Hosting the application on AWS, its deployment role, production CORS/domain and production retention remain separate deployment work. Revoke/rotate the development access key if it is no longer needed or is exposed.
