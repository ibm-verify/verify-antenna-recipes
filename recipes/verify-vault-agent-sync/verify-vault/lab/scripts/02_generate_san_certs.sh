#!/usr/bin/env bash
set -euo pipefail
source scripts/00_env.sh

mkdir -p deploying/transmitter/configs/keys deploying/receiver/configs/keys

SAN_TX="DNS:localhost,DNS:antenna-transmitter,DNS:*.ngrok-free.app,DNS:*.ngrok.app"
SAN_RX="DNS:localhost,DNS:antenna-receiver"
if [[ "${HOST_IP}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  SAN_TX="IP:${HOST_IP},${SAN_TX}"
  SAN_RX="IP:${HOST_IP},${SAN_RX}"
fi

openssl req -x509 -newkey rsa:4096 -nodes -days 365 \
  -keyout deploying/transmitter/configs/keys/server.key \
  -out deploying/transmitter/configs/keys/server.pem \
  -subj "/CN=${HOST_IP}" \
  -addext "subjectAltName=${SAN_TX}"

openssl req -x509 -newkey rsa:4096 -nodes -days 365 \
  -keyout deploying/receiver/configs/keys/server.key \
  -out deploying/receiver/configs/keys/server.pem \
  -subj "/CN=${HOST_IP}" \
  -addext "subjectAltName=${SAN_RX}"

openssl req -x509 -newkey rsa:4096 -nodes -days 365 \
  -keyout deploying/transmitter/configs/keys/jwtsigner.key \
  -out deploying/transmitter/configs/keys/jwtsigner.pem \
  -subj "/CN=jwtsigner"

cp deploying/transmitter/configs/keys/server.pem deploying/transmitter/configs/keys/ca-bundle.pem
cp deploying/receiver/configs/keys/server.pem deploying/receiver/configs/keys/ca-bundle.pem
cp deploying/transmitter/configs/keys/server.pem deploying/receiver/configs/keys/transmitter-ca.pem
chmod 644 deploying/transmitter/configs/keys/* deploying/receiver/configs/keys/*

echo "Generated SAN certs and JWT signer certs."
