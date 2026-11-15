# Sandana Clinic & Dudrucs Medical Store - Domain / Hosting Deployment Guide
================================================================================

Aap is poore project ko kisi bhi cPanel, Hostinger, GoDaddy, Namecheap, VPS, ya
Apache/Nginx Shared Hosting par upload karke chala sakte hain!

## STEP 1: MySQL Database Create & Import Karein
1. Apne cPanel ya Hosting panel me login karein.
2. "MySQL Databases" me jaa kar ek naya database banayein (jaise: `sandana_dudrucs_mysql`).
3. Ek MySQL User banayein aur us user ko is database ke "ALL PRIVILEGES" assign karein.
4. "phpMyAdmin" open karein aur us database ko select karein.
5. "Import" tab par click karein aur is folder me maujood **`database.sql`** file ko select karke "Go" / "Import" dabayein.
   -> Sara schema (12 Tables) aur pre-seeded Doctors, Settings, Pharmacy Medicines aur FIFO Batches turant load ho jayenge!

## STEP 2: Database Connection Settings
- Agar aap PHP backend use kar rahe hain to `public/mysql_api.php` ya `public/db_connect.php` me apne host, user, password aur database name daal dein.
- Agar aap Node.js / VPS par run kar rahe hain:
  ```bash
  export MYSQL_HOST="localhost"
  export MYSQL_USER="your_db_user"
  export MYSQL_PASSWORD="your_db_password"
  export MYSQL_DATABASE="sandana_dudrucs_mysql"
  npm run build
  npm run start
  ```

## Included Database Files:
1. `database.sql` / `public/database.sql` -> Complete 1-click runnable MySQL dump
2. `public/mysql_api.php` -> High-performance REST API for all 12 tables
3. `public/db_connect.php` -> Simple PDO connector
4. `sandana_clinic_mysql.sqlite` -> Embedded SQLite database engine for zero-configuration local execution
