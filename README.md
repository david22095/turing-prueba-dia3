# Día 3 - Integración GCP + Google Workspace con webhook seguro

Sistema que conecta la Cloud Function del Día 1 con un Apps Script del Día 2.
Al subir un archivo a Cloud Storage, la función extrae los metadatos, los firma
con HMAC-SHA256 y los envía a un Apps Script publicado como web app. El script
verifica la firma, valida los datos, los guarda en un Google Sheet y notifica
por Gmail.

## Flujo

Archivo al bucket -> Cloud Function (Día 1) -> firma HMAC -> Apps Script web app
-> verifica firma -> valida datos -> Google Sheet + notificación por Gmail

## Componentes

| Parte | Tecnología | Función |
|---|---|---|
| cloud-function/main.py | Python 3.12 (Cloud Functions gen2) | Extrae metadatos, firma y envía por POST |
| apps-script/Codigo.gs | Google Apps Script (web app) | Verifica firma, valida, escribe en Sheet, notifica |

## Seguridad

- **Autenticación e integridad con HMAC-SHA256.** La función firma el cuerpo
  del mensaje con una llave compartida; el script recalcula la firma y compara.
  Si no coincide, responde 401. Esto autentica el origen y garantiza que el
  mensaje no fue alterado en tránsito.
- **Se eligió HMAC sobre OAuth o firma asimétrica** porque ambos extremos son
  del mismo dueño y la comunicación es máquina a máquina; OAuth añade
  complejidad de flujos de token sin beneficio aquí, y la firma asimétrica
  aplica cuando el receptor no debe conocer el secreto del emisor, que no es
  el caso. HMAC es el estándar de webhooks (Stripe, GitHub).
- **Credenciales fuera del código.** La llave y la URL viven en variables de
  entorno de la Cloud Function y en las propiedades del script, nunca en el
  repositorio.
- **Validación por etapas.** La función valida los metadatos antes de enviar;
  el script valida firma y campos antes de escribir, y responde con códigos
  HTTP correctos (200, 400, 401, 500).
- **Service account de mínimos privilegios** reutilizada del Día 1 para
  ejecutar la función.

## Configuración

Cloud Function (variables de entorno al desplegar):

    gcloud functions deploy procesar-archivo --gen2 --runtime=python312 \
      --trigger-bucket=BUCKET --entry-point=procesar_archivo \
      --set-env-vars="WEBHOOK_URL=...,HMAC_SECRET=..."

Apps Script:
- Guardar HMAC_SECRET en Propiedades del script (misma llave que la función).
- Poner el ID de la hoja y el correo destino en el código.
- Publicar como web app: ejecutar como el propietario, acceso "cualquiera".
  El acceso es público a nivel de red; la firma HMAC es lo que da la seguridad.

## Pruebas

Subir varios archivos al bucket y verificar en los logs de la función que cada
uno responde `{"codigo":200,"mensaje":"Recibido"}`, que aparecen en la pestaña
Recibidos del Sheet y que llegan las notificaciones.
