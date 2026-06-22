import type { ChecklistDoc, Questionnaire, DerivedCustomTask, DerivedTaskState, LogEvent } from '@/types';

function formatDate(ts: { toDate(): Date }): string {
  return ts.toDate().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEventType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function makeBuiltInTaskLookup(questionnaire: Questionnaire): (id: string) => string {
  const map = new Map<string, string>();
  for (const section of questionnaire.sections) {
    for (const task of section.tasks) map.set(task.id, task.label);
  }
  return (id: string) => map.get(id) ?? '';
}

function customLabelAtIndex(customTaskId: string, upToIndex: number, log: LogEvent[]): string {
  let label = '';
  for (let i = 0; i <= Math.min(upToIndex, log.length - 1); i++) {
    const e = log[i];
    if (e.customTaskId !== customTaskId) continue;
    if ((e.type === 'custom_task_added' || e.type === 'custom_task_edited') && e.customTaskLabel !== undefined) {
      label = e.customTaskLabel;
    }
  }
  return label;
}

function buildEventDescription(
  event: LogEvent,
  index: number,
  log: LogEvent[],
  lookupBuiltIn: (id: string) => string,
): string {
  function resolveTaskLabel(): string {
    if (!event.taskId) return '';
    const builtin = lookupBuiltIn(event.taskId);
    if (builtin) return builtin;
    return customLabelAtIndex(event.taskId, index, log);
  }

  switch (event.type) {
    case 'created':
      return 'Created checklist';
    case 'all_unchecked':
      return 'Unchecked all tasks';
    case 'deletion_requested':
      return 'Marked for deletion';
    case 'deletion_cancelled':
      return 'Cancelled deletion';
    case 'task_checked':
    case 'task_unchecked': {
      const label = resolveTaskLabel();
      return `${event.type === 'task_checked' ? 'Checked' : 'Unchecked'}${label ? ` '${label}'` : ''}`;
    }
    case 'note_added':
    case 'note_edited':
    case 'note_deleted': {
      const label = resolveTaskLabel();
      const verb = { note_added: 'Added note', note_edited: 'Edited note', note_deleted: 'Deleted note' }[event.type];
      return label ? `${verb} on '${label}'` : verb;
    }
    case 'custom_task_added':
      return `Added custom task '${event.customTaskLabel ?? ''}'`;
    case 'custom_task_edited': {
      const newLabel = event.customTaskLabel ?? '';
      const oldLabel = event.customTaskId ? customLabelAtIndex(event.customTaskId, index - 1, log) : '';
      return oldLabel && oldLabel !== newLabel
        ? `Renamed '${oldLabel}' to '${newLabel}'`
        : `Edited custom task '${newLabel}'`;
    }
    case 'custom_task_deleted': {
      const label = event.customTaskId ? customLabelAtIndex(event.customTaskId, index, log) : '';
      return `Deleted custom task${label ? ` '${label}'` : ''}`;
    }
    default:
      return formatEventType(event.type);
  }
}

function buildTaskRowsFlat(
  questionnaire: Questionnaire,
  customTasks: DerivedCustomTask[],
  states: Record<string, DerivedTaskState>,
): string[][] {
  const rows: string[][] = [];

  function addTask(sectionTitle: string, label: string, dueText: string, taskId: string) {
    const state = states[taskId];
    const noteTexts = (state?.notes ?? []).map((n) => `${n.actor} · ${formatDate(n.addedAt)}: ${n.text}`).join(' | ');
    rows.push([sectionTitle, label, dueText, state?.checked ? 'Yes' : 'No', noteTexts]);
  }

  for (const section of questionnaire.sections) {
    for (const task of section.tasks) addTask(section.title, task.label, task.dueText ?? '', task.id);
    for (const ct of customTasks.filter((t) => t.sectionId === section.id))
      addTask(section.title, `${ct.label} (custom)`, '', ct.id);
  }
  for (const ct of customTasks.filter((t) => t.sectionId === null))
    addTask('Custom tasks', `${ct.label} (custom)`, '', ct.id);

  return rows;
}

interface TaskExportRow {
  cells: string[];
  isNote: boolean;
}

function buildTaskRowsWithNotes(
  questionnaire: Questionnaire,
  customTasks: DerivedCustomTask[],
  states: Record<string, DerivedTaskState>,
): TaskExportRow[] {
  const rows: TaskExportRow[] = [];

  function addTask(sectionTitle: string, label: string, dueText: string, taskId: string) {
    const state = states[taskId];
    rows.push({ cells: [sectionTitle, label, dueText, state?.checked ? 'Yes' : 'No'], isNote: false });
    for (const note of state?.notes ?? []) {
      rows.push({
        cells: ['', `— ${note.actor} · ${formatDate(note.addedAt)}: ${note.text}`, '', ''],
        isNote: true,
      });
    }
  }

  for (const section of questionnaire.sections) {
    for (const task of section.tasks) addTask(section.title, task.label, task.dueText ?? '', task.id);
    for (const ct of customTasks.filter((t) => t.sectionId === section.id))
      addTask(section.title, `${ct.label} (custom)`, '', ct.id);
  }
  for (const ct of customTasks.filter((t) => t.sectionId === null))
    addTask('Custom tasks', `${ct.label} (custom)`, '', ct.id);

  return rows;
}

function buildLogRows(log: LogEvent[], questionnaire: Questionnaire): string[][] {
  const lookupBuiltIn = makeBuiltInTaskLookup(questionnaire);
  return log.map((event, index) => [
    formatDate(event.timestamp),
    event.actor,
    buildEventDescription(event, index, log, lookupBuiltIn),
    event.noteText ?? '',
  ]);
}

export interface ExportData {
  doc: ChecklistDoc;
  countryLabel: string;
  questionnaire: Questionnaire;
  customTasks: DerivedCustomTask[];
  taskStates: Record<string, DerivedTaskState>;
  log: LogEvent[];
}

export function useExport() {
  async function exportCSV({ doc, countryLabel, questionnaire, customTasks, taskStates, log }: ExportData) {
    const escape = (v: string) => {
      const safe = v.length > 0 && ['=', '+', '-', '@'].includes(v[0]) ? ` ${v}` : v;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const lines: string[] = [];

    lines.push(`Tenant Buddy — ${doc.name}`);
    lines.push(`Country: ${countryLabel}`);
    lines.push(`Type: ${doc.type === 'checkin' ? 'Check-in' : 'Check-out'}`);
    lines.push(`Created: ${formatDate(doc.createdAt)}`);
    lines.push('');
    lines.push(['Section', 'Task', 'Due', 'Done', 'Notes'].map(escape).join(','));
    for (const row of buildTaskRowsFlat(questionnaire, customTasks, taskStates)) {
      lines.push(row.map(escape).join(','));
    }
    lines.push('');
    lines.push(['Time', 'Actor', 'Description', 'Note'].map(escape).join(','));
    for (const row of buildLogRows(log, questionnaire)) {
      lines.push(row.map(escape).join(','));
    }

    download(`${doc.name}.csv`, new Blob([lines.join('\n')], { type: 'text/csv' }));
  }

  async function exportExcel({ doc, questionnaire, customTasks, taskStates, log }: ExportData) {
    const ExcelJS = await import('exceljs');

    const taskData = [
      ['Section', 'Task', 'Due', 'Done', 'Notes'],
      ...buildTaskRowsFlat(questionnaire, customTasks, taskStates),
    ];
    const logData = [['Time', 'Actor', 'Description', 'Note'], ...buildLogRows(log, questionnaire)];

    const wb = new ExcelJS.Workbook();

    const tasksSheet = wb.addWorksheet('Tasks');
    for (const row of taskData) tasksSheet.addRow(row);

    const logSheet = wb.addWorksheet('Event Log');
    for (const row of logData) logSheet.addRow(row);

    const buffer = await wb.xlsx.writeBuffer();
    download(
      `${doc.name}.xlsx`,
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    );
  }

  async function exportWord({ doc, countryLabel, questionnaire, customTasks, taskStates, log }: ExportData) {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, TextRun, WidthType, ShadingType } =
      await import('docx');

    const taskRows = buildTaskRowsWithNotes(questionnaire, customTasks, taskStates);
    const logRows = buildLogRows(log, questionnaire);

    const TASK_COLS = 4;
    const LOG_COLS = 4;
    const colWidth = (n: number) => Math.floor(9000 / n);

    function makeCell(text: string, cols: number, opts: { bold?: boolean; italic?: boolean; shade?: boolean } = {}) {
      return new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text, bold: opts.bold, italics: opts.italic, color: opts.shade ? '888888' : undefined }),
            ],
          }),
        ],
        width: { size: colWidth(cols), type: WidthType.DXA },
        shading: opts.shade ? { fill: 'f5f5f5', type: ShadingType.CLEAR, color: 'auto' } : undefined,
      });
    }

    function makeTaskTable() {
      const headers = ['Section', 'Task', 'Due', 'Done'];
      const headerRow = new TableRow({
        children: headers.map((h) => makeCell(h, TASK_COLS, { bold: true })),
        tableHeader: true,
      });
      const dataRows = taskRows.map(
        ({ cells, isNote }) =>
          new TableRow({
            children: cells.map((cell) => makeCell(cell, TASK_COLS, { italic: isNote, shade: isNote })),
          }),
      );
      return new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
      });
    }

    function makeLogTable() {
      const headers = ['Time', 'Actor', 'Description', 'Note'];
      const headerRow = new TableRow({
        children: headers.map((h) => makeCell(h, LOG_COLS, { bold: true })),
        tableHeader: true,
      });
      const dataRows = logRows.map((row) => new TableRow({ children: row.map((cell) => makeCell(cell, LOG_COLS)) }));
      return new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
      });
    }

    const children = [
      new Paragraph({ text: `Tenant Buddy — ${doc.name}`, heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        children: [
          new TextRun(`Country: ${countryLabel}  |  `),
          new TextRun(`Type: ${doc.type === 'checkin' ? 'Check-in' : 'Check-out'}  |  `),
          new TextRun(`Created: ${formatDate(doc.createdAt)}`),
        ],
      }),
      new Paragraph(''),
      new Paragraph({ text: 'Tasks', heading: HeadingLevel.HEADING_2 }),
      makeTaskTable(),
      new Paragraph(''),
      new Paragraph({ text: 'Activity Log', heading: HeadingLevel.HEADING_2 }),
      makeLogTable(),
    ];

    const wordDoc = new Document({ sections: [{ children }] });
    download(`${doc.name}.docx`, await Packer.toBlob(wordDoc));
  }

  async function exportPDF({ doc, countryLabel, questionnaire, customTasks, taskStates, log }: ExportData) {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const taskRows = buildTaskRowsWithNotes(questionnaire, customTasks, taskStates);
    const noteRowIndices = new Set(taskRows.map((r, i) => (r.isNote ? i : -1)).filter((i) => i >= 0));

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    pdf.setFontSize(16);
    pdf.text(`Tenant Buddy — ${doc.name}`, 14, 20);
    pdf.setFontSize(10);
    pdf.text(
      `${countryLabel} · ${doc.type === 'checkin' ? 'Check-in' : 'Check-out'} · Created ${formatDate(doc.createdAt)}`,
      14,
      27,
    );

    autoTable(pdf, {
      startY: 33,
      head: [['Section', 'Task', 'Due', 'Done']],
      body: taskRows.map((r) => r.cells),
      styles: { fontSize: 9 },
      columnStyles: { 3: { cellWidth: 12, halign: 'center' } },
      didParseCell: (data) => {
        if (noteRowIndices.has(data.row.index)) {
          data.cell.styles.fillColor = [245, 245, 245];
          data.cell.styles.fontStyle = 'italic';
          data.cell.styles.textColor = [100, 100, 100];
        }
      },
    });

    const afterTasks = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    pdf.setFontSize(12);
    pdf.text('Activity Log', 14, afterTasks);

    autoTable(pdf, {
      startY: afterTasks + 4,
      head: [['Time', 'Actor', 'Description', 'Note']],
      body: buildLogRows(log, questionnaire),
      styles: { fontSize: 8 },
    });

    pdf.save(`${doc.name}.pdf`);
  }

  return { exportCSV, exportExcel, exportWord, exportPDF };
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
