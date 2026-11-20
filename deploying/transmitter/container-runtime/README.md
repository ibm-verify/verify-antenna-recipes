# IBM Verify Antenna Transmitter on a Container Runtime

This guide provides step-by-step instructions for deploying an IBM Verify Antenna Transmitter on a container runtime like Docker or Podman.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
  - [Setting Up the Local Directory](#setting-up-the-local-directory)
  - [Generating Keys and Certificates](#generating-keys-and-certificates)
    - [1. Generate Server Certificate](#1-generate-server-certificate)
    - [2. Generate JWT Signing Key Pair](#2-generate-jwt-signing-key-pair)
  - [Creating Transformation Handlers](#creating-transformation-handlers)
  - [Configuring Authorization Scheme](#configuring-authorization-scheme)
  - [Copying Datastore Certificates and Secrets](#copying-datastore-certificates-and-secrets)
  - [Setting Up Environment Variables](#setting-up-environment-variables)
- [Running the Transmitter](#running-the-transmitter)
- [Verifying Transmitter Deployment](#verifying-transmitter-deployment)
- [Troubleshooting](#troubleshooting)
  - [Transmitter Container Not Starting](#transmitter-container-not-starting)
  - [Cannot Connect to PostgreSQL](#cannot-connect-to-postgresql)
  - [Cannot Connect to Kafka](#cannot-connect-to-kafka)
  - [Transformation Handler Errors](#transformation-handler-errors)
  - [Authorization and Authentication Issues](#authorization-and-authentication-issues)
  - [Certificate Errors](#certificate-errors)
  - [General Troubleshooting Commands](#general-troubleshooting-commands)

## Overview

The IBM Verify Antenna Transmitter ingests raw security events, transforms them into SSF-compliant format, and transmits them to registered SSF receivers.

> 📘 **Performance Note**
>
> Transformation handler complexity directly impacts resource requirements and processing throughput. Use simple object-to-object mapping whenever possible. Avoid augmenting events with data from external API calls, as this significantly reduces performance.

## Prerequisites

- A container runtime like Docker or Podman installed
- **openssl**: For generating SSL/TLS certificates
- **IBM Verify tenant**: Sign up for a free trial at [ibm.biz/verify-trial](https://ibm.biz/verify-trial). Note your tenant hostname (e.g., `tenant.verify.ibm.com`). You will reference this hostname in configuration files.

## Configuration

### Setting Up the Local Directory

If you did not clone the repository, copy the entire `deploying/transmitter/container-runtime` directory to your local system. All commands from this point onwards will be executed from this directory.

**Expected Directory Structure:**

```
container-runtime/
├── configs/
│   ├── js/
│   │   └── (transformation handlers)
│   ├── keys/
│   │   └── (certificates will be generated here)
│   ├── storage.yml
│   └── transmitter.yml
├── db/
│   └── (SQLite database will be created here)
├── docker-compose.yml
└── dotenv
```

### Generating Keys and Certificates

Generate SSL/TLS keys and certificates for secure communication using OpenSSL.

#### 1. Generate Server Certificate

```bash
$ openssl req -x509 -newkey rsa:4096 -keyout configs/keys/server.key \
    -out configs/keys/server.pem -days 365 -nodes \
    -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=DNS:<hostname>" \
    -addext "subjectAltName = DNS:<hostname>"
```

Replace `<hostname>` with your actual hostname, or use `antenna-transmitter` for internal communication.

#### 2. Generate JWT Signing Key Pair

Generate a key pair for signing security event tokens:

```bash
$ openssl req -x509 -newkey rsa:4096 -keyout configs/keys/jwtsigner.key \
    -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=DNS:<hostname>" \
    -out configs/keys/jwtsigner.pem -days 365 -nodes
```

### Creating Transformation Handlers

Transformation handlers process incoming raw events and convert them into SSF-standardized format. Sample handlers are provided in the `configs/js` directory, including an example that transforms device events from mobile device management systems (such as IBM MaaS360) into SSF CAEP (Continuous Access Evaluation Profile) events for device compliance changes.

Add custom transformation handler files to this directory as required for your use case.

### Configuring Authorization Scheme

The authorization scheme in `transmitter.yml` must be configured with valid credentials. These instructions use IBM Verify as the authorization server.

1. **Create a new API client in IBM Verify** by following the [IBM Verify documentation](https://www.ibm.com/docs/en/security-verify?topic=access-creating-api-clients). No entitlements are required.
   - **Note**: The UI currently requires selecting an entitlement during creation. Select any entitlement, save the client, then edit the client and remove the entitlement.

2. **Update `transmitter.yml` with the following values:**
   - `authorization_schemes[].client_id`: Client ID from step 1
   - `authorization_schemes[].client_secret`: Client secret from step 1
   - `authorization_schemes[].discovery_uri`: Update the hostname with your IBM Verify tenant hostname

> 📘 **Authentication Requirements**
>
> Receivers connecting to this transmitter must obtain OAuth tokens from the same IBM Verify tenant.
>
> Receivers require either a long-lived access token or OAuth client credentials (created as an API client in IBM Verify).

### Copying Datastore Certificates and Secrets

The transmitter needs access to the datastore certificates and credentials created during datastore deployment.

> 📘 **Prerequisites**
>
> - The datastore must be fully deployed and configured first (see [Datastore Deployment Guide](../../datastore/container-runtime/README.md))
> - The datastore `.env` file must exist (created from `dotenv` template during datastore setup)
> - The following commands assume the datastore is in `../../datastore/container-runtime/` relative to the current directory

1. Copy the CA certificates from the datastore deployment:

    ```bash
    $ cp ../../datastore/container-runtime/configs/keys/ca.pem configs/keys/pgsql_ca.pem
    $ cp ../../datastore/container-runtime/configs/keys/ca.pem configs/keys/kafka_ca.pem
    ```

2. Create the secrets directory and copy credentials from the datastore `.env` file:

    ```bash
    $ mkdir -p configs/secrets
    
    # Verify the datastore .env file exists
    $ test -f ../../datastore/container-runtime/.env || { echo "Error: Datastore .env file not found. Deploy datastore first."; exit 1; }
    
    # Source the datastore environment and create secret files
    $ source ../../datastore/container-runtime/.env
    $ echo -n "${POSTGRES_USER}" > configs/secrets/pgsql_user
    $ echo -n "${POSTGRES_PASSWORD}" > configs/secrets/pgsql_password
    $ echo -n "${KAFKA_CLIENT_USERS}" > configs/secrets/kafka_user
    $ echo -n "${KAFKA_CLIENT_PASSWORDS}" > configs/secrets/kafka_password
    ```

    If the datastore is in a different location, adjust the paths accordingly.

### Setting Up Environment Variables

1. Copy [dotenv](./dotenv) to `.env` file:

    ```bash
    $ cp dotenv .env
    ```

2. Modify the properties in `.env` file as needed:
   - `HOSTNAME`: The hostname for the transmitter (must match the value in `transmitter.yml`)
   - `TRANSMITTER_PORT`: The port to expose the transmitter on (default: 9044)

3. Create an empty directory for the database:

    ```bash
    $ mkdir -p db
    ```

## Running the Transmitter

1. Ensure all certificates and configuration files are in place.

2. Ensure the datastore is running and the `antenna-network` Docker network exists. If the datastore is not yet deployed, follow the [Datastore Deployment Guide](../../datastore/container-runtime/README.md) first.

3. Start the transmitter with Docker Compose:

   ```bash
   $ docker-compose up -d
   ```

   The transmitter will be available on the port specified in the `.env` file via HTTPS. It will connect to PostgreSQL and Kafka using the hostnames `antenna-postgres` and `antenna-kafka` on the shared `antenna-network`.

## Verifying Transmitter Deployment

1. **Verify the container is running:**

    ```bash
    $ docker-compose ps antenna-transmitter
    ```

    Expected output:
    ```
    NAME                   IMAGE                                                 STATUS
    antenna-transmitter    icr.io/ibm-verify/ibm-verify-antenna-transmitter:...  Up
    ```

2. **Check container logs for errors:**

    ```bash
    $ docker-compose logs antenna-transmitter
    ```

3. **Test connectivity** by opening a web browser and navigating to `https://localhost:<PORT>/.well-known/ssf-configuration` (replace `<PORT>` with your configured port).

4. **Test event ingestion** by copying [test_device_event.sh](../scripts/test_device_event.sh) and running it:

    ```bash
    $ ../scripts/test_device_event.sh
    ```

    Verify the log shows the event was received:
    ```
    antenna-transmitter | time="..." level=info msg="[trace] Raw event received: {\"deviceInfo\":..."
    ```

## Troubleshooting

### Transmitter Container Not Starting

**Symptoms**: Transmitter container exits immediately or shows errors in logs.

**Solutions**:

1. Check container logs:
   ```bash
   $ docker-compose logs antenna-transmitter
   ```

2. Verify certificate files exist and have correct permissions:
   ```bash
   $ ls -la configs/keys/
   ```

3. Ensure the `.env` file has valid configuration.

4. Verify the `db` directory exists and is writable.

5. Verify the datastore (PostgreSQL and Kafka) is running if using external datastore.

### Cannot Connect to PostgreSQL

**Symptoms**: Transmitter logs show database connection errors.

**Solutions**:

1. Verify PostgreSQL is accessible from the transmitter container.

2. Check PostgreSQL credentials in `storage.yml`.

3. Verify PostgreSQL SSL certificates are properly configured.

### Cannot Connect to Kafka

**Symptoms**: Transmitter logs show Kafka connection or authentication errors.

**Solutions**:

1. Verify Kafka is accessible from the transmitter container.

2. Check Kafka credentials in `storage.yml`.

3. Verify Kafka SSL certificates are properly configured.

4. Ensure required Kafka topics exist.

### Transformation Handler Errors

**Symptoms**: Events are ingested successfully but transformation processing fails.

**Solutions**:

1. Check transmitter logs for JavaScript errors:
   ```bash
   $ docker-compose logs antenna-transmitter | grep -i error
   ```

2. Verify transformation handler files exist:
   ```bash
   $ ls -la configs/js/
   ```

3. Validate transformation handler syntax locally before deploying.

4. Check for memory or CPU resource constraints that may impact complex handler execution.

### Authorization and Authentication Issues

**Symptoms**: OAuth token validation errors or authorization failures in logs.

**Solutions**:

1. Verify the IBM Verify tenant configuration in `transmitter.yml`.

2. Test OAuth token generation manually:
   ```bash
   $ curl -X POST https://tenant.verify.ibm.com/v1.0/endpoint/default/token \
       -H "Content-Type: application/x-www-form-urlencoded" \
       -d "grant_type=client_credentials&client_id=<client_id>&client_secret=<client_secret>"
   ```

3. Verify the API client has the correct permissions configured in IBM Verify.

### Certificate Errors

**Symptoms**: SSL/TLS handshake failures or certificate validation errors.

**Solutions**:

1. Verify certificate validity and expiration:
   ```bash
   $ openssl x509 -in configs/keys/server.pem -text -noout
   $ openssl x509 -in configs/keys/jwtsigner.pem -text -noout
   ```

2. Verify Subject Alternative Names (SAN) are correct:
   ```bash
   $ openssl x509 -in configs/keys/server.pem -text -noout | grep -A1 "Subject Alternative Name"
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
```
