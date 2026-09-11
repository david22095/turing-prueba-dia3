const SHEET_ID = 'mi_sheet_ID';

function libro() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function doPost(e) {
  try {
    const firmaRecibida = (e.parameter.firma || '').toLowerCase();
    const cuerpo = e.postData.contents;

    const secreto = PropertiesService.getScriptProperties().getProperty('HMAC_SECRET');
    const firmaEsperada = calcularHmac(cuerpo, secreto);

    // comparo la firma que mando la funcion contra la que calculo yo con el mismo secreto
    if (firmaRecibida !== firmaEsperada) {
      registrar('RECHAZADO', 'firma invalida', cuerpo.slice(0, 120));
      return responder(401, 'Firma invalida');
    }

    const datos = JSON.parse(cuerpo);

    // validar que lleguen los campos antes de escribir
    if (!datos.nombre || !datos.bucket) {
      registrar('RECHAZADO', 'datos incompletos', cuerpo.slice(0, 120));
      return responder(400, 'Faltan campos obligatorios');
    }

    guardarEnHoja(datos);
    notificar(datos);
    registrar('OK', 'archivo registrado', datos.nombre);
    return responder(200, 'Recibido');

  } catch (err) {
    registrar('ERROR', 'excepcion', String(err));
    return responder(500, 'Error interno');
  }
}

function calcularHmac(mensaje, secreto) {
  const bytes = Utilities.computeHmacSha256Signature(mensaje, secreto);
  return bytes.map(function (b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function responder(codigo, mensaje) {
  return ContentService
    .createTextOutput(JSON.stringify({ codigo: codigo, mensaje: mensaje }))
    .setMimeType(ContentService.MimeType.JSON);
}

function guardarEnHoja(datos) {
  const ss = libro();
  let hoja = ss.getSheetByName('Recibidos');
  if (!hoja) {
    hoja = ss.getSheets()[0];
    hoja.setName('Recibidos');
    hoja.getRange(1, 1, 1, 5)
      .setValues([['Fecha recepcion', 'Nombre', 'Bucket', 'Tamano (bytes)', 'Tipo']])
      .setFontWeight('bold').setBackground('#e8eaed');
    hoja.setFrozenRows(1);
  }
  hoja.appendRow([new Date(), datos.nombre, datos.bucket, datos.tamano || '', datos.tipo || '']);
}

function notificar(datos) {
  const destino = 'mi-correo';
  GmailApp.sendEmail(
    destino,
    'Nuevo archivo recibido: ' + datos.nombre,
    'Se registro un archivo desde la Cloud Function.\n\n' +
    'Nombre: ' + datos.nombre + '\n' +
    'Bucket: ' + datos.bucket + '\n' +
    'Tamano: ' + (datos.tamano || 'n/d') + ' bytes\n' +
    'Tipo: ' + (datos.tipo || 'n/d') + '\n\n' +
    'Sistema de integracion Dia 3'
  );
}

function registrar(estado, accion, detalle) {
  const ss = libro();
  let log = ss.getSheetByName('Log');
  if (!log) {
    log = ss.insertSheet('Log');
    log.getRange(1, 1, 1, 4)
      .setValues([['Fecha', 'Estado', 'Accion', 'Detalle']])
      .setFontWeight('bold').setBackground('#e8eaed');
    log.setFrozenRows(1);
  }
  log.appendRow([new Date(), estado, accion, detalle]);
  console.info(JSON.stringify({ origen: 'ReceptorDia3', estado: estado, accion: accion, detalle: detalle }));
}
