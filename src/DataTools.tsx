import { useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArchiveRestore,
  FileSpreadsheet,
  HardDriveDownload,
  ShieldCheck,
} from 'lucide-react';
import type { SessionData } from '../shared/model.ts';
import { MAX_BACKUP_BYTES } from '../shared/limits.ts';
import { Button, FormError } from './components.tsx';

export function DataTools({
  data,
  busy,
  error,
  onRestore,
}: {
  data: SessionData | null;
  busy: boolean;
  error: string;
  onRestore: (backup: unknown) => void;
}) {
  const [fileError, setFileError] = useState('');
  const [backup, setBackup] = useState<unknown>(null);
  const [filename, setFilename] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const count = data?.tickets.length || 0;
  return (
    <div className="data-tools">
      {data ? (
        <>
          <div className="report-summary">
            <p className="eyebrow">THIS SESSION, IN REAL NUMBERS</p>
            <h3>{data.session.title}</h3>
            <div>
              <span>
                <strong>{count}</strong>checked in
              </span>
              <span>
                <strong>{data.tickets.filter((t) => t.status === 'repaired').length}</strong>
                repaired
              </span>
              <span>
                <strong>{data.tickets.filter((t) => t.status === 'waiting-parts').length}</strong>
                need parts
              </span>
            </div>
            <p>Outcomes are recorded by your team. No inferred carbon or cost savings.</p>
          </div>
          <a className="download-card" href={`/api/sessions/${data.session.id}/backup`} download>
            <HardDriveDownload size={24} />
            <div>
              <strong>Download session backup</strong>
              <p>Portable JSON · items, volunteers, notes and history</p>
            </div>
            <ArrowDownToLine size={17} />
          </a>
          <a
            className="download-card"
            href={`/api/sessions/${data.session.id}/report.csv`}
            download
          >
            <FileSpreadsheet size={24} />
            <div>
              <strong>Export repair CSV</strong>
              <p>Open in a spreadsheet or use in your event report</p>
            </div>
            <ArrowDownToLine size={17} />
          </a>
        </>
      ) : null}
      <section className="restore-section">
        <h3>
          <ArchiveRestore size={21} />
          Bring a session back.
        </h3>
        <p>
          Choose a Mendroom JSON backup up to 8 MB. Restore creates a separate session at the top of
          your list, with the same title and history. Existing records stay intact. Only open
          backups from people you trust.
        </p>
        <label className="file-picker">
          Choose backup file
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={async (e) => {
              setFileError('');
              setBackup(null);
              setFilename('');
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > MAX_BACKUP_BYTES) {
                setFileError('Choose a backup no larger than 8 MB.');
                return;
              }
              try {
                const value: unknown = JSON.parse(await file.text());
                setBackup(value);
                setFilename(file.name);
              } catch {
                setFileError('This file is not valid JSON. Choose a Mendroom backup.');
              }
            }}
          />
        </label>
        {filename ? (
          <div className="restore-confirm">
            <span>
              <ShieldCheck size={16} />
              {filename}
            </span>
            <p>The server will validate every record and reference before writing anything.</p>
            <Button className="button primary full" busy={busy} onClick={() => onRestore(backup)}>
              Restore as a new session
              <ArrowRight size={16} />
            </Button>
          </div>
        ) : null}
        <FormError error={fileError || error} />
      </section>
      <p className="form-hint privacy-footnote">
        Exports contain visitor aliases and repair notes. Keep them somewhere private. Backups cover
        the selected session; save each session you want to keep.
      </p>
    </div>
  );
}
