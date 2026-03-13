# IBM Verify Antenna Datastore on a Container Runtime

> ⚠️
> 
> This is meant for demonstration and reference only. This is not meant for production use.
>

This guide provides step-by-step instructions for deploying the datastore components (PostgreSQL and Kafka) required for IBM Verify Antenna on a container runtime like Docker or Podman.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
  - [Setting Up the Local Directory](#setting-up-the-local-directory)
  - [Generating Keys and Certificates](#generating-keys-and-certificates)
    - [1. Generate CA Key and Certificate](#1-generate-ca-key-and-certificate)
    - [2. Generate PostgreSQL SSL Certificate](#2-generate-postgresql-ssl-certificate)
    - [3. Generate Kafka SSL Certificate](#3-generate-kafka-ssl-certificate)
    - [4. Create Kafka PEM Keystore and Truststore](#4-create-kafka-pem-keystore-and-truststore)
  - [Setting Up Environment Variables](#setting-up-environment-variables)
  - [Creating Kafka Client Configuration](#creating-kafka-client-configuration)
- [Running the Datastore](#running-the-datastore)
- [Verifying Datastore Deployment](#verifying-datastore-deployment)
- [Creating Kafka Topics](#creating-kafka-topics)
- [Troubleshooting](#troubleshooting)
  - [PostgreSQL Container Not Starting](#postgresql-container-not-starting)
  - [Kafka Container Not Starting](#kafka-container-not-starting)
  - [Cannot Create Kafka Topics](#cannot-create-kafka-topics)
  - [Certificate Errors](#certificate-errors)
  - [General Troubleshooting Commands](#general-troubleshooting-commands)

## Overview

The datastore includes PostgreSQL database and Kafka message broker servers required for IBM Verify Antenna. These components must be deployed before the transmitter and receiver.

## Prerequisites

- A container runtime like Docker or Podman installed
- **openssl**: For generating SSL/TLS certificates

## Configuration

### Setting Up the Local Directory

If you did not clone the repository, copy the entire `deploying/datastore/container-runtime` directory to your local system. All subsequent commands must be executed from this directory.

**Expected Directory Structure:**

```
container-runtime/
├── configs/
│   ├── init_pg_schema.sql
│   ├── kafka-client.properties.template
│   ├── kafka_entrypoint.sh
│   ├── keys/
│   │   └── (certificates will be generated here)
│   ├── pg_hba.conf
│   ├── san-kafka.cnf
│   ├── san-postgres.cnf
│   └── secrets/
│       └── (secrets will be generated here)
├── docker-compose.yml
└── dotenv
```

### Generating Keys and Certificates

Generate SSL/TLS keys and certificates for secure communication using OpenSSL.

#### 1. Generate CA Key and Certificate

```bash
$ openssl genrsa 4096 > configs/keys/ca.key
```

```bash
$ openssl req -new -x509 -nodes -days 3650 \
    -key configs/keys/ca.key -out configs/keys/ca.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=CA"
```

#### 2. Generate PostgreSQL SSL Certificate

```bash
$ openssl req -newkey rsa:4096 -sha256 \
    -keyout configs/keys/postgres.key \
    -out configs/keys/postgres.csr -nodes \
    -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=antenna-postgres" \
    -addext "subjectAltName = DNS:antenna-postgres"
```

```bash
$ openssl x509 -req -days 365 -in configs/keys/postgres.csr \
    -out configs/keys/postgres.pem -CA configs/keys/ca.pem \
    -CAkey configs/keys/ca.key \
    -extensions v3_req -extfile configs/san-postgres.cnf
```

#### 3. Generate Kafka SSL Certificate

```bash
$ openssl req -newkey rsa:4096 -sha256 \
    -keyout configs/keys/kafka.key \
    -out configs/keys/kafka.csr -nodes \
    -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=antenna-kafka" \
    -addext "subjectAltName = DNS:antenna-kafka,DNS:antenna-kafka-0.antenna-kafka"
```

```bash
$ openssl x509 -req -days 365 -in configs/keys/kafka.csr \
    -out configs/keys/kafka.pem -CA configs/keys/ca.pem \
    -CAkey configs/keys/ca.key \
    -extensions v3_req -extfile configs/san-kafka.cnf
```

#### 4. Create Kafka PEM Keystore and Truststore

Create the PEM keystore by combining kafka.key, kafka.pem, and ca.pem:

```bash
$ cat configs/keys/kafka.key \
    configs/keys/kafka.pem \
    configs/keys/ca.pem > configs/keys/keystore.pem
```

Create the PEM truststore by combining kafka.pem and ca.pem:

```bash
$ cat configs/keys/kafka.pem \
    configs/keys/ca.pem > configs/keys/truststore.pem
```

### Setting Up Environment Variables

1. Copy [dotenv](./dotenv) to `.env` file:

    ```bash
    $ cp dotenv .env
    ```

2. Generate and update the credentials in `.env` file:

    ```bash
    # Generate PostgreSQL password and update .env
    $ export POSTGRES_PASSWORD=$(tr -dc A-Za-z0-9 < /dev/urandom | head -c 32)
    $ sed -i.bak "s/change_me_postgres_password/${POSTGRES_PASSWORD}/" .env
    
    # Generate Kafka cluster ID and update .env
    $ export CLUSTER_ID=$(tr -dc A-Za-z0-9 < /dev/urandom | head -c 16)
    $ sed -i.bak "s/change_me_cluster_id/${CLUSTER_ID}/" .env
    
    # Generate Kafka client password and update .env
    $ export KAFKA_CLIENT_PASSWORDS=$(tr -dc A-Za-z0-9 < /dev/urandom | head -c 32)
    $ sed -i.bak "s/change_me_kafka_client_password/${KAFKA_CLIENT_PASSWORDS}/" .env
    
    # Generate Kafka controller password and update .env
    $ export KAFKA_CONTROLLER_PASSWORD=$(tr -dc A-Za-z0-9 < /dev/urandom | head -c 32)
    $ sed -i.bak "s/change_me_kafka_controller_password/${KAFKA_CONTROLLER_PASSWORD}/" .env
    
    # Remove backup file
    $ rm .env.bak
    ```

3. Optionally update usernames in `.env` if desired (default values are `antenna_user`, `antenna_client`, and `kafka_controller`).

### Creating Kafka Client Configuration

1. Copy the template to the secrets directory:

    ```bash
    $ cp configs/kafka-client.properties.template configs/secrets/kafka-client.properties
    ```

2. Add the SASL configuration using the credentials from `.env`:

    ```bash
    $ source .env
    $ echo "sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username=\"${KAFKA_CLIENT_USERS}\" password=\"${KAFKA_CLIENT_PASSWORDS}\";" >> configs/secrets/kafka-client.properties
    ```

## Running the Datastore

1. Ensure all certificates and configuration files are in place.

2. Create the shared Docker network (if not already created):

    ```bash
    $ docker network create antenna-network
    ```

3. Start the datastore with Docker Compose:

    ```bash
    $ docker-compose up -d
    ```

    Both PostgreSQL and Kafka will start and be available on their respective ports. The containers will be accessible to other containers on the `antenna-network` network using their hostnames (`antenna-postgres` and `antenna-kafka`).

## Verifying Datastore Deployment

1. **Verify PostgreSQL container is running:**

    ```bash
    $ docker-compose ps antenna-postgres
    ```

    Expected output:
    ```
    NAME                 IMAGE                 STATUS
    antenna-postgres     postgres:17-alpine    Up
    ```

2. **Verify Kafka container is running:**

    ```bash
    $ docker-compose ps antenna-kafka
    ```

    Expected output:
    ```
    NAME              IMAGE                          STATUS
    antenna-kafka     confluentinc/cp-kafka:8.1.1    Up
    ```

3. **Check container logs for any errors:**

    ```bash
    $ docker-compose logs antenna-postgres
    $ docker-compose logs antenna-kafka
    ```

## Creating Kafka Topics

Create the required Kafka topics for event processing:

```bash
$ docker exec antenna-kafka /usr/bin/kafka-topics \
    --bootstrap-server antenna-kafka:9092 \
    --command-config /etc/kafka/clients/kafka-client.properties \
    --create --topic antenna.raw_2_ssf.event.queue --partitions 15
```

```bash
$ docker exec antenna-kafka /usr/bin/kafka-topics \
    --bootstrap-server antenna-kafka:9092 \
    --command-config /etc/kafka/clients/kafka-client.properties \
    --create --topic antenna.ssf_2_action.event.queue --partitions 10
```

**Verify topics were created:**

```bash
$ docker exec antenna-kafka /usr/bin/kafka-topics \
    --bootstrap-server antenna-kafka:9092 \
    --command-config /etc/kafka/clients/kafka-client.properties --list
```

## Troubleshooting

### PostgreSQL Container Not Starting

**Symptoms**: PostgreSQL container exits immediately or shows errors in logs.

**Solutions**:

1. Check container logs:
   ```bash
   $ docker-compose logs antenna-postgres
   ```

2. Verify certificate file permissions:
   ```bash
   $ ls -la configs/keys/postgres.*
   ```

3. Ensure the `.env` file has valid credentials.

### Kafka Container Not Starting

**Symptoms**: Kafka container exits immediately or shows errors in logs.

**Solutions**:

1. Check container logs:
   ```bash
   $ docker-compose logs antenna-kafka
   ```

2. Verify the CLUSTER_ID is set in `.env` file.

3. Ensure keystore files exist:
   ```bash
   $ ls -la configs/keys/keystore.pem configs/keys/truststore.pem
   ```

### Cannot Create Kafka Topics

**Symptoms**: Topic creation commands fail with authentication or connection errors.

**Solutions**:

1. Verify Kafka container is running:
   ```bash
   $ docker-compose ps antenna-kafka
   ```

2. Verify the client configuration file exists and has correct credentials:
   ```bash
   $ cat configs/secrets/kafka-client.properties
   ```

3. Test Kafka connectivity:
   ```bash
   $ docker exec antenna-kafka /usr/bin/kafka-broker-api-versions \
       --bootstrap-server antenna-kafka:9092 \
       --command-config /etc/kafka/clients/client.properties
   ```

### Certificate Errors

**Symptoms**: SSL/TLS handshake failures or certificate validation errors.

**Solutions**:

1. Verify certificate validity and expiration:
   ```bash
   $ openssl x509 -in configs/keys/postgres.pem -text -noout
   $ openssl x509 -in configs/keys/kafka.pem -text -noout
   ```

2. Verify Subject Alternative Names (SAN) are correct:
   ```bash
   $ openssl x509 -in configs/keys/kafka.pem -text -noout | grep -A1 "Subject Alternative Name"
   ```

3. Regenerate certificates if they are expired or contain incorrect information.

### General Troubleshooting Commands

```bash
# View all containers
$ docker-compose ps

# Check container logs
$ docker-compose logs <service-name> --tail=100 -f

# Restart a specific service
$ docker-compose restart <service-name>

# Stop all services
$ docker-compose down

# Remove volumes (WARNING: This will delete all data)
$ docker-compose down -v
