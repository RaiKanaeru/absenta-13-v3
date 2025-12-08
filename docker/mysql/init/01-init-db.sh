#!/bin/bash
set -e

echo "==================================="
echo "   ABSENTA 13 Database Setup"
echo "==================================="

# Wait for MySQL to be ready
until mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "SELECT 1" &> /dev/null; do
    echo "Waiting for MySQL to be ready..."
    sleep 3
done

echo "MySQL is ready!"

# Create database if not exists
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" << EOF
-- Create database
CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user and grant privileges
CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'%' IDENTIFIED BY '${MYSQL_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;

-- Select database
USE \`${MYSQL_DATABASE}\`;
EOF

echo "Database and user created successfully!"

# Import schema if exists
if [ -f /docker-entrypoint-initdb.d/absenta13.sql ]; then
    echo "Importing absenta13.sql..."
    mysql -u root -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" < /docker-entrypoint-initdb.d/absenta13.sql
    echo "Schema imported successfully!"
else
    echo "No schema file found, skipping import."
fi

echo "==================================="
echo "   Database Setup Complete!"
echo "==================================="
