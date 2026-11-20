import { formatNum } from '../../utils/loomCalculations';

export function sanitizePdfText(str) {
  if (str == null) return '-';
  return String(str)
    .replace(/₹\s*/g, 'Rs. ')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/✓/g, '[OK]')
    .replace(/[•·]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x00-\x7F]/g, '');
}

function fitText(doc, text, maxWidth) {
  let str = sanitizePdfText(text);
  if (doc.getTextWidth(str) <= maxWidth) return str;
  while (str.length > 2 && doc.getTextWidth(str + '..') > maxWidth) {
    str = str.slice(0, -1);
  }
  return str + '..';
}

/**
 * Generates an executive-grade A4 PDF for Loom Manufacturing Command Center.
 * Strict A4 page size in either portrait (default) or landscape orientation.
 */
export async function exportLoomCommandCenterPdf({
  companyName = 'OSCAR TEXTILE ERP',
  dashboardData,
  activeTab = 'all',
  orientation = 'portrait', // 'portrait' | 'landscape'
  filename,
}) {
  const { jsPDF } = await import('jspdf');

  const isPortrait = orientation === 'portrait';
  const doc = new jsPDF({
    orientation: isPortrait ? 'portrait' : 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = isPortrait ? 595.28 : 841.89;
  const pageHeight = isPortrait ? 841.89 : 595.28;
  const margin = 28;
  const printableWidth = pageWidth - margin * 2; // 539.28 pt in portrait, 785.89 pt in landscape
  const maxY = pageHeight - margin - 20;

  const factories = dashboardData?.factories || [];
  const programs = dashboardData?.programs || [];
  const yarnItems = factories.flatMap((f) =>
    (f.yarn_cover || []).map((x) => ({
      ...x,
      factory_name: f.factory_name,
      factory_id: f.factory_id,
    }))
  );

  // Aggregated totals
  const totalLooms = factories.reduce((acc, f) => acc + (f.total_machines || 0), 0);
  const runningLooms = factories.reduce((acc, f) => acc + (f.running_machines || 0), 0);
  const totalMetersOnLooms = factories.reduce((acc, f) => acc + (f.on_loom_m || 0), 0);
  const totalSpareMeters = factories.reduce((acc, f) => acc + (f.spares_m || 0), 0);
  const totalDailyOutput = factories.reduce((acc, f) => acc + (f.daily_out || 0), 0);
  const totalBeamsToPrepare = factories.reduce((acc, f) => acc + (f.within7_count || 0), 0);
  const avgLoomCover = totalDailyOutput > 0 ? (totalMetersOnLooms / totalDailyOutput).toFixed(1) : '0.0';

  const generatedDateStr = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let curY = margin;

  // Helper: Draw running top header on continuation pages
  const drawRunningHeader = (sectionTitle) => {
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, margin, printableWidth, 24, 'F');

    doc.setFontSize(isPortrait ? 8.5 : 9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(
      `${sanitizePdfText(companyName).toUpperCase()} - COMMAND CENTER (Cont.)`,
      margin + 10,
      margin + 16
    );

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      sectionTitle ? `${sanitizePdfText(sectionTitle)} | Generated: ${generatedDateStr}` : `Generated: ${generatedDateStr}`,
      margin + printableWidth - 10,
      margin + 16,
      { align: 'right' }
    );

    curY = margin + 32;
  };

  // 1. First Page Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, curY, printableWidth, 42, 'F');

  doc.setFontSize(isPortrait ? 11.5 : 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(sanitizePdfText(companyName).toUpperCase(), margin + 12, curY + 18);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('LOOM MANUFACTURING COMMAND CENTER - A4 OPERATIONAL REPORT', margin + 12, curY + 32);

  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Generated: ${generatedDateStr}`, margin + printableWidth - 12, curY + 18, { align: 'right' });
  doc.text(`Factories: ${factories.length} | Looms: ${runningLooms}/${totalLooms} Running`, margin + printableWidth - 12, curY + 32, { align: 'right' });

  curY += 48;

  // 2. Executive KPI Cards Row
  const kpis = [
    {
      title: 'LOOMS RUNNING',
      value: `${runningLooms} / ${totalLooms}`,
      sub: totalLooms - runningLooms > 0 ? `${totalLooms - runningLooms} idle looms` : 'Full capacity',
      subColor: totalLooms - runningLooms > 0 ? [180, 83, 9] : [16, 149, 102],
    },
    {
      title: 'METERS ON LOOMS',
      value: `${formatNum(totalMetersOnLooms)} m`,
      sub: `+ ${formatNum(totalSpareMeters)} m spares`,
      subColor: [71, 85, 105],
    },
    {
      title: 'DAILY OUTPUT',
      value: `${formatNum(totalDailyOutput)} m/d`,
      sub: '7-day factory avg',
      subColor: [71, 85, 105],
    },
    {
      title: 'AVG LOOM COVER',
      value: `${avgLoomCover} d`,
      sub: 'Until beams run out',
      subColor: Number(avgLoomCover) <= 7 ? [225, 29, 72] : [71, 85, 105],
    },
    {
      title: 'BEAMS TO PREPARE',
      value: String(totalBeamsToPrepare),
      sub: 'Ending in <= 7d (no spare)',
      subColor: totalBeamsToPrepare > 0 ? [225, 29, 72] : [71, 85, 105],
    },
  ];

  if (isPortrait) {
    // In Portrait: 2 rows of KPI cards (Row 1: 3 cards, Row 2: 2 cards)
    const gap = 6;
    const cardH = 40;

    // Row 1 (3 cards)
    const row1W = (printableWidth - gap * 2) / 3;
    kpis.slice(0, 3).forEach((kpi, idx) => {
      const kX = margin + idx * (row1W + gap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(kX, curY, row1W, cardH, 3, 3, 'FD');

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.title, kX + 8, curY + 11);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(kpi.value, kX + 8, curY + 24);

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(kpi.subColor[0], kpi.subColor[1], kpi.subColor[2]);
      doc.text(fitText(doc, kpi.sub, row1W - 16), kX + 8, curY + 34);
    });
    curY += cardH + gap;

    // Row 2 (2 cards)
    const row2W = (printableWidth - gap) / 2;
    kpis.slice(3, 5).forEach((kpi, idx) => {
      const kX = margin + idx * (row2W + gap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(kX, curY, row2W, cardH, 3, 3, 'FD');

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.title, kX + 8, curY + 11);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(kpi.value, kX + 8, curY + 24);

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(kpi.subColor[0], kpi.subColor[1], kpi.subColor[2]);
      doc.text(fitText(doc, kpi.sub, row2W - 16), kX + 8, curY + 34);
    });
    curY += cardH + 12;
  } else {
    // In Landscape: 1 row of 5 cards
    const kpiCount = 5;
    const kpiGap = 7;
    const kpiWidth = (printableWidth - kpiGap * (kpiCount - 1)) / kpiCount;
    const kpiHeight = 44;

    kpis.forEach((kpi, idx) => {
      const kpiX = margin + idx * (kpiWidth + kpiGap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(kpiX, curY, kpiWidth, kpiHeight, 3, 3, 'FD');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.title, kpiX + 9, curY + 12);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(kpi.value, kpiX + 9, curY + 26);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(kpi.subColor[0], kpi.subColor[1], kpi.subColor[2]);
      doc.text(fitText(doc, kpi.sub, kpiWidth - 18), kpiX + 9, curY + 38);
    });
    curY += kpiHeight + 14;
  }

  // Helper: Draw Section Bar
  const drawSectionBar = (title) => {
    if (curY + 45 > maxY) {
      doc.addPage('a4', isPortrait ? 'portrait' : 'landscape');
      drawRunningHeader(title);
    }
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, curY, printableWidth, 18, 'F');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), margin + 10, curY + 12.5);

    curY += 18;
  };

  // Helper: Draw Generic Table
  const drawTable = ({ columns, rows, sectionTitle }) => {
    const drawHeader = () => {
      doc.setFillColor(241, 245, 249); // slate-100
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, curY, printableWidth, 18, 'FD');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85); // slate-700

      let x = margin;
      columns.forEach((col) => {
        const textX =
          col.align === 'right'
            ? x + col.width - 5
            : col.align === 'center'
            ? x + col.width / 2
            : x + 5;
        doc.text(col.header, textX, curY + 12, {
          align: col.align || 'left',
        });
        x += col.width;
      });
      curY += 18;
    };

    drawHeader();

    const rowHeight = 16.5;
    if (!rows.length) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('No records found.', margin + 10, curY + 12);
      curY += rowHeight;
      return;
    }

    rows.forEach((row, rIdx) => {
      if (curY + rowHeight > maxY) {
        doc.addPage('a4', isPortrait ? 'portrait' : 'landscape');
        drawRunningHeader(sectionTitle);
        drawHeader();
      }

      // Alternating row background
      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, curY, printableWidth, rowHeight, 'F');
      }

      // Row separator
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, curY + rowHeight, margin + printableWidth, curY + rowHeight);

      let x = margin;
      columns.forEach((col) => {
        const rawVal = col.get ? col.get(row) : row[col.key];
        const val = fitText(doc, rawVal ?? '-', col.width - 8);
        const textX =
          col.align === 'right'
            ? x + col.width - 5
            : col.align === 'center'
            ? x + col.width / 2
            : x + 5;

        doc.setFontSize(7);
        if (col.font) {
          doc.setFont('helvetica', col.font(row) || 'normal');
        } else {
          doc.setFont('helvetica', 'normal');
        }

        if (col.color) {
          const c = col.color(row);
          if (c) doc.setTextColor(c[0], c[1], c[2]);
          else doc.setTextColor(30, 41, 59);
        } else {
          doc.setTextColor(30, 41, 59);
        }

        doc.text(val, textX, curY + 11.5, { align: col.align || 'left' });
        x += col.width;
      });

      curY += rowHeight;
    });

    curY += 10;
  };

  // Section 1: Factory-Wise Beam Status
  if (activeTab === 'looms' || activeTab === 'all') {
    drawSectionBar('1. Factory-Wise Beam Status & Stoppage Forecast');

    const factoryCols = isPortrait
      ? [
          { header: 'Factory', width: 90, align: 'left', get: (f) => f.factory_name || '—', font: () => 'bold' },
          {
            header: 'Run / Tot',
            width: 65,
            align: 'right',
            get: (f) => `${f.running_machines || 0}/${f.total_machines || 0}${f.idle_machines > 0 ? ` (${f.idle_machines}i)` : ''}`,
            color: (f) => (f.idle_machines > 0 ? [180, 83, 9] : [15, 23, 42]),
          },
          { header: 'Meters', width: 55, align: 'right', get: (f) => formatNum(f.on_loom_m) },
          {
            header: 'Spares',
            width: 65,
            align: 'right',
            get: (f) => `${f.spares_count || 0} (${formatNum(f.spares_m)})`,
          },
          { header: 'Daily (m)', width: 50, align: 'right', get: (f) => formatNum(f.daily_out) },
          {
            header: 'Days',
            width: 45,
            align: 'right',
            get: (f) => `${formatNum(f.days_on_loom, 1)}d`,
            font: () => 'bold',
            color: (f) => (f.days_on_loom <= 3 ? [225, 29, 72] : f.days_on_loom <= 7 ? [180, 83, 9] : [16, 149, 102]),
          },
          { header: '+Spare', width: 45, align: 'right', get: (f) => `${formatNum(f.days_with_spare, 1)}d` },
          {
            header: '<=7d',
            width: 40,
            align: 'center',
            get: (f) => String(f.within7_count || 0),
            font: (f) => (f.within7_count > 0 ? 'bold' : 'normal'),
            color: (f) => (f.within7_count > 0 ? [225, 29, 72] : [148, 163, 184]),
          },
          {
            header: 'Urgent Machines',
            width: 84,
            align: 'left',
            get: (f) => (f.urgent_machines && f.urgent_machines.length > 0 ? `MCN ${f.urgent_machines.join(',')}` : '[OK] Covered'),
            font: () => 'bold',
            color: (f) => (f.urgent_machines && f.urgent_machines.length > 0 ? [225, 29, 72] : [16, 149, 102]),
          },
        ]
      : [
          { header: 'Factory Name', width: 125, align: 'left', get: (f) => f.factory_name || '—', font: () => 'bold' },
          {
            header: 'Running / Total',
            width: 90,
            align: 'right',
            get: (f) => `${f.running_machines || 0} / ${f.total_machines || 0}${f.idle_machines > 0 ? ` (${f.idle_machines} idle)` : ''}`,
            color: (f) => (f.idle_machines > 0 ? [180, 83, 9] : [15, 23, 42]),
          },
          { header: 'Meters on Looms', width: 85, align: 'right', get: (f) => formatNum(f.on_loom_m) },
          {
            header: 'Spare Beams',
            width: 95,
            align: 'right',
            get: (f) => `${f.spares_count || 0} (${formatNum(f.spares_m)} m)`,
          },
          { header: 'Daily Output', width: 75, align: 'right', get: (f) => `${formatNum(f.daily_out)} m` },
          {
            header: 'Days on Looms',
            width: 75,
            align: 'right',
            get: (f) => `${formatNum(f.days_on_loom, 1)} d`,
            font: () => 'bold',
            color: (f) => (f.days_on_loom <= 3 ? [225, 29, 72] : f.days_on_loom <= 7 ? [180, 83, 9] : [16, 149, 102]),
          },
          { header: '...With Spares', width: 75, align: 'right', get: (f) => `${formatNum(f.days_with_spare, 1)} d` },
          {
            header: 'Prep (<=7d)',
            width: 60,
            align: 'center',
            get: (f) => String(f.within7_count || 0),
            font: (f) => (f.within7_count > 0 ? 'bold' : 'normal'),
            color: (f) => (f.within7_count > 0 ? [225, 29, 72] : [148, 163, 184]),
          },
          {
            header: 'Urgent Machines (<=2d, No Spare)',
            width: 105,
            align: 'left',
            get: (f) => (f.urgent_machines && f.urgent_machines.length > 0 ? `MCN ${f.urgent_machines.join(', ')}` : '[OK] All covered'),
            font: () => 'bold',
            color: (f) => (f.urgent_machines && f.urgent_machines.length > 0 ? [225, 29, 72] : [16, 149, 102]),
          },
        ];

    drawTable({
      columns: factoryCols,
      rows: factories,
      sectionTitle: 'Factory-Wise Beam Status & Stoppage Forecast',
    });
  }

  // Section 2: Yarn Weft Cover Status
  if (activeTab === 'yarn' || activeTab === 'all') {
    drawSectionBar('2. Yarn Weft Cover Days (Weft Burn Rate)');

    const yarnCols = isPortrait
      ? [
          { header: 'Factory', width: 100, align: 'left', get: (y) => y.factory_name || '—', font: () => 'bold' },
          { header: 'Yarn Quality', width: 145, align: 'left', get: (y) => y.yarn_name || '—' },
          {
            header: 'Bal (kg)',
            width: 75,
            align: 'right',
            get: (y) => formatNum(y.bal),
            font: (y) => (y.bal < 0 ? 'bold' : 'normal'),
            color: (y) => (y.bal < 0 ? [225, 29, 72] : [15, 23, 42]),
          },
          {
            header: 'Weft kg/d',
            width: 75,
            align: 'right',
            get: (y) => (y.daily > 0 ? formatNum(y.daily, 1) : 'warp'),
          },
          {
            header: 'Cover Days',
            width: 70,
            align: 'right',
            get: (y) => (y.days === null || y.days === undefined ? '—' : `${formatNum(y.days, 1)}d`),
            font: () => 'bold',
            color: (y) => (y.days != null && y.days <= 5 ? [225, 29, 72] : y.days != null && y.days <= 10 ? [180, 83, 9] : [16, 149, 102]),
          },
          {
            header: 'Pending (kg)',
            width: 74,
            align: 'right',
            get: (y) => formatNum(y.pending),
            color: () => [37, 99, 235],
          },
        ]
      : [
          { header: 'Factory Name', width: 140, align: 'left', get: (y) => y.factory_name || '—', font: () => 'bold' },
          { header: 'Yarn Quality / Name', width: 205, align: 'left', get: (y) => y.yarn_name || '—' },
          {
            header: 'Balance (kg)',
            width: 110,
            align: 'right',
            get: (y) => formatNum(y.bal),
            font: (y) => (y.bal < 0 ? 'bold' : 'normal'),
            color: (y) => (y.bal < 0 ? [225, 29, 72] : [15, 23, 42]),
          },
          {
            header: 'Daily Weft (kg/d)',
            width: 110,
            align: 'right',
            get: (y) => (y.daily > 0 ? formatNum(y.daily, 1) : 'warp'),
          },
          {
            header: 'Cover Days',
            width: 110,
            align: 'right',
            get: (y) => (y.days === null || y.days === undefined ? '—' : `${formatNum(y.days, 1)} d`),
            font: () => 'bold',
            color: (y) => (y.days != null && y.days <= 5 ? [225, 29, 72] : y.days != null && y.days <= 10 ? [180, 83, 9] : [16, 149, 102]),
          },
          {
            header: 'Pending Orders (kg)',
            width: 110,
            align: 'right',
            get: (y) => formatNum(y.pending),
            color: () => [37, 99, 235],
          },
        ];

    drawTable({
      columns: yarnCols,
      rows: yarnItems,
      sectionTitle: 'Yarn Weft Cover Status (Weft Burn Rate)',
    });
  }

  // Section 3: Active Programs Progress
  if (activeTab === 'programs' || activeTab === 'all') {
    drawSectionBar('3. Active Programs Progress');

    const programCols = isPortrait
      ? [
          { header: 'Program Name', width: 165, align: 'left', get: (p) => p.name || '—', font: () => 'bold' },
          { header: 'Factory', width: 105, align: 'left', get: (p) => p.factory_name || '—' },
          {
            header: 'Done / Target',
            width: 110,
            align: 'right',
            get: (p) => `${formatNum(p.stats?.meters || 0)}/${formatNum(p.target || 0)}m`,
          },
          {
            header: 'Eff %',
            width: 80,
            align: 'right',
            get: (p) => `${formatNum(p.stats?.eff_pct, 1)}%`,
            font: () => 'bold',
            color: (p) => ((p.stats?.eff_pct || 0) >= (p.t_eff || 0) ? [16, 149, 102] : [225, 29, 72]),
          },
          {
            header: 'At Factory',
            width: 79,
            align: 'right',
            get: (p) => `${formatNum(p.stats?.at_factory || 0)} m`,
            font: () => 'bold',
            color: () => [79, 70, 229],
          },
        ]
      : [
          { header: 'Program Name', width: 205, align: 'left', get: (p) => p.name || '—', font: () => 'bold' },
          { header: 'Factory', width: 140, align: 'left', get: (p) => p.factory_name || '—' },
          {
            header: 'Done / Target (m)',
            width: 160,
            align: 'right',
            get: (p) => `${formatNum(p.stats?.meters || 0)} / ${formatNum(p.target || 0)} m`,
          },
          {
            header: 'Loom Efficiency %',
            width: 140,
            align: 'right',
            get: (p) => `${formatNum(p.stats?.eff_pct, 1)}%`,
            font: () => 'bold',
            color: (p) => ((p.stats?.eff_pct || 0) >= (p.t_eff || 0) ? [16, 149, 102] : [225, 29, 72]),
          },
          {
            header: 'At Factory (m)',
            width: 140,
            align: 'right',
            get: (p) => `${formatNum(p.stats?.at_factory || 0)} m`,
            font: () => 'bold',
            color: () => [79, 70, 229],
          },
        ];

    drawTable({
      columns: programCols,
      rows: programs,
      sectionTitle: 'Active Programs Progress',
    });
  }

  // Footer on all pages: Page X of Y
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Page ${i} of ${totalPages}   |   Confidential   |   ${sanitizePdfText(companyName)} - Loom Manufacturing Command Center (A4 ${isPortrait ? 'Portrait' : 'Landscape'})`,
      pageWidth / 2,
      pageHeight - 12,
      { align: 'center' }
    );
  }

  const safeFilename = filename
    ? filename.endsWith('.pdf')
      ? filename
      : `${filename}.pdf`
    : `Loom_Manufacturing_Command_Center_${new Date().toISOString().slice(0, 10)}.pdf`;

  doc.save(safeFilename);
}
