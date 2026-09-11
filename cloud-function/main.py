import os
import json
import hashlib
import hmac
import urllib.request

import functions_framework
from cloudevents.http import CloudEvent

WEBHOOK_URL = os.environ.get("WEBHOOK_URL")
HMAC_SECRET = os.environ.get("HMAC_SECRET", "")


@functions_framework.cloud_event
def procesar_archivo(cloud_event: CloudEvent) -> None:
    try:
        data = cloud_event.data
        nombre = data.get("name")
        bucket = data.get("bucket")
        tamano = data.get("size")
        tipo = data.get("contentType")

        if not nombre or not bucket:
            raise ValueError(f"Evento sin metadatos minimos: {data}")

        print(
            f"Archivo procesado -> nombre={nombre}, tamano_bytes={tamano}, "
            f"tipo={tipo}, bucket={bucket}"
        )

        enviar_al_webhook({
            "nombre": nombre,
            "bucket": bucket,
            "tamano": tamano,
            "tipo": tipo,
        })

    except Exception as e:
        print(f"ERROR procesando evento de Storage: {e}")
        raise


def enviar_al_webhook(metadatos: dict) -> None:
    cuerpo = json.dumps(metadatos)

    firma = hmac.new(
        HMAC_SECRET.encode("utf-8"),
        cuerpo.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    url = f"{WEBHOOK_URL}?firma={firma}"
    peticion = urllib.request.Request(
        url,
        data=cuerpo.encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(peticion, timeout=30) as resp:
        print(f"Webhook respondio {resp.status}: {resp.read().decode()}")
