// CSV / PDF export of wound incidents (sessions). Shared by the Patient
// Incidents list (selected patients) and a single patient's record page.

import { jsPDF } from 'jspdf';
import { Session } from '@/types';
import { formatDate } from '@/lib/utils';
import { frameLabelsOf, frameRegion, regionsText } from '@/lib/patients';

// Patient names / regions are free text — quote so commas can't shift columns
const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const framesOf = (s: any) => (s.frames && s.frames.length > 0 ? s.frames : [s.wound_metrics || {}]);

export function exportIncidentsCSV(sessions: Session[], filenamePrefix = 'Valkyra_Export') {
  const headers = ['Patient ID', 'Patient Name', 'Scan (Session ID)', 'Date', 'Body Region', 'Scan Triage',
                   'Frame', 'PWAT Score', 'Frame Triage', 'Depth Severity', 'Wound Area %', 'Latitude', 'Longitude'];
  const rows: string[] = [];

  sessions.forEach((s: any) => {
    const labelOf = frameLabelsOf(s);
    framesOf(s).forEach((frame: any, fIdx: number) => {
      rows.push([
        csvCell(s.patient_id),
        csvCell(s.patient_name),
        s.session_id,
        formatDate(s.created_at).replace(/,/g, ''),
        csvCell(frameRegion(s, fIdx)),
        s.triage_category || 'Unknown',
        csvCell(labelOf(fIdx)),
        frame.pwat_score ?? s.pwat_score ?? 'N/A',
        frame.triage ?? '',
        frame.depth_severity ?? 'N/A',
        frame.area_pct != null ? `${Number(frame.area_pct).toFixed(1)}%` : 'N/A',
        s.location?.latitude ?? '',
        s.location?.longitude ?? '',
      ].join(','));
    });
  });

  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filenamePrefix}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportIncidentsPDF(sessions: Session[], title = 'Valkyra Nucleus - Patient Incident Report') {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  doc.text(`Incidents Included: ${sessions.length}`, 14, 34);

  doc.setDrawColor(200, 200, 200);
  doc.line(14, 38, 196, 38);

  let yOffset = 48;

  sessions.forEach((s: any, idx: number) => {
    if (yOffset > 270) { doc.addPage(); yOffset = 20; }

    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.text(`${idx + 1}. ${s.patient_name || s.patient_id || 'Unidentified patient'} — ${regionsText(s) || 'Region not recorded'}`, 14, yOffset);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Date Recorded: ${formatDate(s.created_at)}   |   Triage: ${s.triage_category || 'Unknown'}`, 14, yOffset + 6);
    const gps = s.location?.latitude != null && s.location?.longitude != null
      ? `${Number(s.location.latitude).toFixed(5)}, ${Number(s.location.longitude).toFixed(5)}`
      : '—';
    doc.text(`Patient ID: ${s.patient_id || '—'}   |   GPS: ${gps}`, 14, yOffset + 12);
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Incident: ${s.session_id}`, 14, yOffset + 17);

    yOffset += 24;

    framesOf(s).forEach((frame: any, fIdx: number) => {
      if (yOffset > 270) { doc.addPage(); yOffset = 20; }

      const pwat = frame.pwat_score ?? s.pwat_score ?? 'N/A';
      const depth = frame.depth_severity ?? 'Unknown';
      const area = frame.area_pct != null ? `${Number(frame.area_pct).toFixed(1)}%` : 'N/A';

      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'bold');
      doc.text(`${frameLabelsOf(s)(fIdx)}:`, 20, yOffset);

      doc.setFont('helvetica', 'normal');
      doc.text(`PWAT: ${pwat}   |   Triage: ${frame.triage ?? '—'}   |   Depth: ${depth}   |   Area: ${area}`, 70, yOffset);

      yOffset += 6;
    });

    yOffset += 6;
    doc.setDrawColor(230, 230, 230);
    doc.line(14, yOffset - 4, 196, yOffset - 4);
  });

  doc.save(`Valkyra_Patient_Report_${Date.now()}.pdf`);
}
