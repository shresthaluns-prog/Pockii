# Hosting Pockii on AWS EC2

This deployment uses CloudFormation to create an Ubuntu EC2 instance, a stable
Elastic IP, and its SSH key, plus Nginx, Node.js 22, and PM2. CloudFront
provides the stable HTTPS URL and proxies requests to Nginx on EC2. GitHub
Actions tests and builds the client, uploads the build artifact, deploys the
infrastructure, and updates the application. MongoDB remains a separate,
reachable production database.

The EC2 instance uses the default VPC and a public subnet. Ensure the default
VPC and its internet gateway are available in the AWS region enabled for your
Learner Lab.

## Configure GitHub Actions

In the repository, open **Settings → Secrets and variables → Actions** and add
these repository secrets:

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | Current AWS Academy access key |
| `AWS_SECRET_ACCESS_KEY` | Matching AWS Academy secret key |
| `AWS_SESSION_TOKEN` | Current AWS Academy session token |
| `MONGODB_URI` | Production MongoDB connection string reachable from EC2 |
| `ACCESS_TOKEN_SECRET` | Random secret of at least 32 characters |
| `CSRF_SECRET` | Different random secret of at least 32 characters |

Add these repository variables:

| Variable | Value |
|---|---|
| `AWS_REGION` | AWS region enabled for the Learner Lab |
| `CFN_STACK_NAME` | CloudFormation stack name, for example `pockii-production` |

Keep all secret values single-line. Do not put credentials in the repository or
in a `VITE_*` variable. The generated EC2 private key is saved by CloudFormation
in SSM Parameter Store and retrieved by the deployment workflow; do not create
`EC2_SSH_PRIVATE_KEY` or `EC2_KNOWN_HOSTS` GitHub secrets.

## Deploy

Start the Learner Lab and update the three AWS credential secrets whenever it
issues new credentials. Push to `main` or `master`, or start the workflow
manually from **Actions → Build and deploy Pockii → Run workflow**.

The workflow:

1. Tests and builds the client on a GitHub-hosted Ubuntu runner and uploads
   `client/dist` as an artifact.
2. Deploys `infra/ec2-instance.yaml`, creating an EC2 `t2.micro`, Elastic IP,
   key pair, security group, and CloudFront distribution. On later runs it
   starts a stopped instance and refreshes the CloudFront origin.
3. Reads `PublicIP`, `InstanceId`, `PublicURL`, and `SSMKeyPath` from the stack.
   It retrieves the generated SSH key from Parameter Store, waits for EC2 and
   cloud-init, and copies the client artifact to the instance.
4. Checks out the pushed commit on EC2, writes `server/.env` from the GitHub
   secrets, installs production server dependencies, and reloads PM2.
5. Checks the HTTPS API health endpoint.

After the first successful deployment, open the `PublicURL` stack output. It
uses the CloudFront default certificate, so no DuckDNS record or Certbot
certificate is needed. The workflow serves `CLIENT_ORIGINS` from this URL.

### First deployment with MongoDB Atlas

The EC2 Elastic IP stays assigned when the instance stops and starts, allowing
Atlas to use a single `/32` access-list entry. On the first workflow run, the
stack creates the IP, but the health check may fail until Atlas allows it:

1. In **CloudFormation → your stack → Outputs**, copy `PublicIP`.
2. In Atlas, open **Security → Network Access → IP Access List**, add that IP
   with `/32`, and confirm the change.
3. Rerun **Build and deploy Pockii** from the Actions tab. The API health check
   should then report `"database":"connected"`.

Do not use `0.0.0.0/0` to avoid configuring the access list. If the stack is
deleted and recreated, its Elastic IP changes and the Atlas entry must be
updated.

## Network and Learner Lab notes

- The security group permanently allows HTTP (TCP 80) and SSH (TCP 22) from
  `0.0.0.0/0`, as required for this workflow. Do not open API port 5000 or
  MongoDB port 27017. SSH is exposed to the internet; use key-based
  authentication only. For a stronger long-term design, replace SSH deployment
  with Systems Manager Session Manager and restrict inbound SSH.
- To avoid a manually maintained `EC2_KNOWN_HOSTS` secret, the SCP step trusts
  the first-seen host key and the SSH action does not receive a pinned host
  fingerprint. The host identity is therefore not independently verified;
  use Session Manager or add an independently verified host-key pin for a
  production deployment.
- CloudFront adds AWS resources and may incur charges. The Learner Lab must
  permit CloudFront, Elastic IP allocation/association, EC2 key-pair creation,
  and Parameter Store access. Elastic IPs may incur charges. If the lab denies
  these operations, an instructor/admin must enable them; the workflow cannot
  bypass AWS permissions.
- Learner Lab credentials expire. Push-triggered deployment cannot authenticate
  after expiry until you refresh `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
  and `AWS_SESSION_TOKEN`.
- The Elastic IP and CloudFront URL remain stable when the instance is stopped
  and restarted. The next workflow run starts the instance and refreshes the
  CloudFront origin.
- The repository must be publicly cloneable by EC2 during first-boot setup.
- Back up production data independently of this stack. Deleting the stack also
  deletes the EC2 instance, generated key pair, and its SSM key parameter.

## Manual checks

To inspect deployment resources, use the CloudFormation stack outputs and
check the instance over SSH using the key retrieved from the stack's
`SSMKeyPath`. Useful instance commands include:

```bash
sudo cloud-init status --long
pm2 status
pm2 logs pockii-api
sudo nginx -t
```

The application health endpoint is `<PublicURL>/api/health`; a healthy
response includes `"database":"connected"`.
