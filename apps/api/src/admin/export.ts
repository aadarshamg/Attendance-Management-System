import type { AttendanceRecord } from '@ams/shared';

const COLUMNS: { header: string; get: (r: AttendanceRecord) => string | number }[] = [
  { header: 'Record ID', get: (r) => r.id },
  { header: 'Employee Code', get: (r) => r.employeeCode },
  { header: 'Worker', get: (r) => r.workerName },
  { header: 'Site', get: (r) => r.siteName ?? '' },
  { header: 'Mark Type', get: (r) => r.markType },
  { header: 'Server Timestamp (UTC)', get: (r) => r.serverTimestamp },
  { header: 'Device Timestamp', get: (r) => r.deviceTimestamp },
  { header: 'Latitude', get: (r) => r.latitude },
  { header: 'Longitude', get: (r) => r.longitude },
  { header: 'GPS Accuracy (m)', get: (r) => r.gpsAccuracyM },
  { header: 'Address', get: (r) => r.address ?? '' },
  { header: 'Within Geofence', get: (r) => (r.withinGeofence ? 'yes' : 'no') },
  { header: 'Status', get: (r) => r.status },
  { header: 'Flag Reasons', get: (r) => r.flagReasons.join('; ') },
  { header: 'Image Status', get: (r) => r.imageStatus },
  { header: 'Reviewed By', get: (r) => r.reviewedByName ?? '' },
  { header: 'Reviewed At', get: (r) => r.reviewedAt ?? '' },
  { header: 'Review Note', get: (r) => r.manualNote ?? '' },
];

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(records: AttendanceRecord[]): string {
  const lines = [COLUMNS.map((c) => csvCell(c.header)).join(',')];
  for (const r of records) {
    lines.push(COLUMNS.map((c) => csvCell(c.get(r))).join(','));
  }
  return lines.join('\r\n');
}

function xmlEscape(v: string | number): string {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * SpreadsheetML 2003 — a single XML file Excel/LibreOffice open natively as a
 * workbook. Dependency-free; avoids the heavier xlsx-zip libraries for what is a
 * plain tabular export.
 */
export function toSpreadsheetXml(records: AttendanceRecord[]): string {
  const cell = (v: string | number) => {
    const isNum = typeof v === 'number' && Number.isFinite(v);
    return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${xmlEscape(v)}</Data></Cell>`;
  };
  const headerRow = `<Row>${COLUMNS.map((c) => cell(c.header)).join('')}</Row>`;
  const bodyRows = records
    .map((r) => `<Row>${COLUMNS.map((c) => cell(c.get(r))).join('')}</Row>`)
    .join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Attendance">
    <Table>${headerRow}${bodyRows}</Table>
  </Worksheet>
</Workbook>`;
}
