#!/bin/bash

TRANSMITTER_HOSTNAME=transmitter.dune.com

event=$(cat <<EOF
{
    "iss": "mdm_realm",
    "eventType": "OUT_OF_COMPLIANCE",
    "eventID": "1234567890",
    "eventTime": "2021-08-10T10:10:10.000Z",
    "deviceInfo": {
        "deviceIdentifier": "slqc",
        "deviceName": "WIN11-JUNE61",
        "deviceType": "Desktop",
        "deviceManufacturer": "QEMU",
        "deviceModel": "Standard PC (i440FX + PIIX, 1996)",
        "deviceOS": "Windows",
        "deviceOSVersion": "10.0.19042"
    },
    "user": {
        "userName": "ppan",
        "domain": "dune.com"
    }
}
EOF
)

echo $event

# Modify the hostname if you aren't using the default transmitter hostname
curl -k --request POST \
    --url https://$TRANSMITTER_HOSTNAME:9044/sources/mdm/events \
    --header 'Content-Type: application/json' \
    --data "$event"