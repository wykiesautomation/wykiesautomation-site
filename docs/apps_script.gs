// Apps Script: Gallery endpoint (recommended schema)
// Sheet: Gallery columns => orderIndex | imageUrl | caption | active
// Spreadsheet ID: 12qRMe6pAPVaQtosZBnhVtpMwyNks7W8uY9PX1mF620k

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  if (action === 'gallery') {
    const data = getGallery();
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok:false, error:'Unknown action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getGallery() {
  const ss = SpreadsheetApp.openById('12qRMe6pAPVaQtosZBnhVtpMwyNks7W8uY9PX1mF620k');
  const sh = ss.getSheetByName('Gallery');
  if (!sh) return [];

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0].map(h => String(h).trim());
  const idx = (name) => header.indexOf(name);

  const iOrder = idx('orderIndex');
  const iUrl   = idx('imageUrl');
  const iCap   = idx('caption');
  const iAct   = idx('active');

  return values.slice(1)
    .map(r => ({
      orderIndex: Number(r[iOrder]) || 9999,
      src: String(r[iUrl] || '').trim(),
      caption: String(r[iCap] || '').replace(/<[^>]*>/g,'').slice(0,120),
      active: (iAct >= 0) ? (String(r[iAct]).toLowerCase() !== 'false' && r[iAct] !== '') : true
    }))
    .filter(x => x.src && x.active)
    .sort((a,b) => a.orderIndex - b.orderIndex);
}
