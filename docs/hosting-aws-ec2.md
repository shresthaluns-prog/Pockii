# Hosting Pockii on AWS EC2

This guide deploys the React client and Express API to one Ubuntu EC2 instance.
Nginx serves the client and proxies `/api` to the API. MongoDB remains MongoDB;
the production database must be reachable from EC2 (for example, a managed
MongoDB deployment). The local `127.0.0.1` database on a development computer
is not reachable from EC2.

The hostname for this setup is `pockii.duckdns.org`.

## 1. Create a reachable MongoDB database

Create a production database and database user with your MongoDB hosting
provider. Copy the connection string for the application. Do not commit the
connection string or paste it into GitHub files.

If you need to keep data from your local database, export it and import it into
the production database before switching the application over. If you do not
need the local data, the production database can start empty.

## 2. Launch an EC2 instance

In the AWS Academy Learner Lab console:

1. Start the lab and use a region enabled for your lab.
2. Launch Ubuntu Server 24.04 LTS, x86-64. Choose an instance size allowed by
   your lab.
3. Create and download an EC2 key pair. Keep the private key outside this
   repository.
4. Create a security group with inbound rules:
   - SSH (TCP 22) from **your current public IP only** (`your-ip/32`).
   - HTTP (TCP 80) from `0.0.0.0/0`.
   - HTTPS (TCP 443) from `0.0.0.0/0`.
   - Do not expose TCP 5000 (API) or 27017 (MongoDB).
5. Launch the instance and note its public IPv4 address.

Learner Lab resources and IP addresses may change or become unavailable when
the lab ends. The application will be offline while the instance is stopped.

## 3. Point DuckDNS to EC2

In DuckDNS, set the IPv4 address for `pockii.duckdns.org` to the EC2 public IPv4
address. Do not put the DuckDNS token in this repository. If the EC2 public IP
changes after a restart or replacement, update the DuckDNS address.

## 4. Install the server software

From PowerShell on Windows, connect to the instance (adjust the key path):

```powershell
ssh -i "$HOME\.ssh\pockii.pem" ubuntu@<EC2_PUBLIC_IP>
```

On the Ubuntu instance:

```bash
sudo apt update
sudo apt install -y nginx git curl ca-certificates certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install --global pm2
node --version
```

Use Node.js 22.12 or later. Then clone the project and install server
dependencies:

```bash
sudo mkdir -p /var/www/pockii
sudo chown ubuntu:ubuntu /var/www/pockii
git clone --branch master https://github.com/shresthaluns-prog/Expense-Tracker.git /var/www/pockii
cd /var/www/pockii/server
npm ci --omit=dev
```

## 5. Configure the production environment

Create `/var/www/pockii/server/.env` on EC2 and set:

```dotenv
NODE_ENV=production
PORT=5000
MONGODB_URI=<production MongoDB connection string>
ACCESS_TOKEN_SECRET=<random secret of at least 32 characters>
CSRF_SECRET=<different random secret of at least 32 characters>
CLIENT_ORIGINS=https://pockii.duckdns.org
REFRESH_COOKIE_SAME_SITE=lax
```

Generate both secrets separately on the server with `openssl rand -base64 48`.
Keep the values private. Restrict the file permissions:

```bash
chmod 600 /var/www/pockii/server/.env
```

Do not set server secrets as `VITE_*` variables. The client already defaults to
the same-origin `/api` path.

## 6. Build and copy the client

On your Windows development computer, from the repository root:

```powershell
npm --prefix client ci
npm --prefix client run build
scp -i "$HOME\.ssh\pockii.pem" -r .\client\dist ubuntu@<EC2_PUBLIC_IP>:/var/www/pockii/client/
```

## 7. Start the API with PM2

The repository includes `server/ecosystem.config.cjs`. On EC2:

```bash
cd /var/www/pockii/server
pm2 start ecosystem.config.cjs --env production
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Run the `sudo` command printed by `pm2 startup`, then save the process list:

```bash
pm2 save
```

## 8. Configure Nginx and HTTPS

On EC2:

```bash
sudo cp /var/www/pockii/infra/nginx-pockii.conf /etc/nginx/sites-available/pockii
sudo ln -s /etc/nginx/sites-available/pockii /etc/nginx/sites-enabled/pockii
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

After DuckDNS resolves to the EC2 IP and HTTP is reachable, request a
certificate:

```bash
sudo certbot --nginx -d pockii.duckdns.org --redirect
```

Enter an email address when Certbot asks. Once it finishes, open
`https://pockii.duckdns.org` and check
`https://pockii.duckdns.org/api/health`.

## 9. Update the deployment

Build the client again on your computer and copy the new `client/dist` folder
to EC2 as in step 6. On EC2, update the server and restart it:

```bash
cd /var/www/pockii
git pull origin master
cd server
npm ci --omit=dev
pm2 startOrReload ecosystem.config.cjs --env production --update-env
```

Check `pm2 status`, `pm2 logs pockii-api`, and the API health URL if the site
does not work.

## Learner Lab reminders

- AWS credentials used by automation expire; never store them in the source
  tree. This manual deployment guide does not require adding AWS credentials to
  GitHub.
- If an EC2 public IP changes, update DuckDNS and any database IP allowlist.
- Keep backups of production data outside the EC2 instance.
- The Nginx proxy forwards client IP headers. The Express app is configured to
  trust only a loopback proxy, so do not change the API proxy target to a
  public/untrusted proxy without revisiting that setting.
