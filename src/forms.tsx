import type { FormEvent } from 'react';
import { ArrowRight, Plus, ShieldCheck } from 'lucide-react';
import { categories, categoryLabels } from '../shared/model.ts';
import { Button, FormError } from './components.tsx';

interface Props {
  busy: boolean;
  error: string;
  onSave: (body: unknown) => void;
}
const values = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  return new FormData(event.currentTarget);
};
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function SessionForm({ busy, error, onSave }: Props) {
  return (
    <form
      onSubmit={(e) => {
        const f = values(e);
        onSave({
          title: f.get('title'),
          location: f.get('location'),
          date: f.get('date'),
          durationMinutes: Number(f.get('duration')),
        });
      }}
    >
      <label>
        Session name
        <input
          name="title"
          placeholder="e.g. Saturday at the repair café"
          maxLength={100}
          required
          autoFocus
        />
      </label>
      <label>
        Venue
        <input name="location" placeholder="Where are we gathering?" maxLength={150} required />
      </label>
      <div className="form-grid">
        <label>
          Date
          <input name="date" type="date" defaultValue={localDate()} required />
        </label>
        <label>
          Session length
          <select name="duration" defaultValue="180">
            <option value="60">1 hour</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
            <option value="240">4 hours</option>
            <option value="360">6 hours</option>
            <option value="480">8 hours</option>
          </select>
        </label>
      </div>
      <p className="form-hint">
        A fresh session starts with an empty queue. Add your volunteers, then welcome your first
        visitor.
      </p>
      <FormError error={error} />
      <Button className="button primary full" type="submit" busy={busy}>
        Create session
        <ArrowRight size={16} />
      </Button>
    </form>
  );
}
export function IntakeForm({ busy, error, onSave }: Props) {
  return (
    <form
      onSubmit={(e) => {
        const f = values(e);
        onSave({
          visitor: f.get('visitor'),
          item: f.get('item'),
          issue: f.get('issue'),
          category: f.get('category'),
          estimatedMinutes: Number(f.get('estimate')),
          reviewRequired: f.get('review') === 'on',
        });
      }}
    >
      <div className="form-grid">
        <label>
          Visitor first name or alias
          <input name="visitor" maxLength={60} placeholder="e.g. Alex" required autoFocus />
        </label>
        <label>
          Item name
          <input name="item" maxLength={100} placeholder="e.g. Desk lamp" required />
        </label>
      </div>
      <label>
        What needs a little care?
        <textarea
          name="issue"
          maxLength={1200}
          placeholder="Describe the problem in the visitor’s words."
          rows={3}
          required
        />
      </label>
      <div className="form-grid">
        <label>
          Repair skill
          <select name="category">
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabels[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estimated bench time
          <select name="estimate" defaultValue="30">
            {[5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180].map((n) => (
              <option value={n} key={n}>
                {n} minutes
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="checkbox-panel">
        <input type="checkbox" name="review" />
        <span>
          <strong>
            <ShieldCheck size={16} />
            Hold for coordinator review
          </strong>
          <small>
            Stops assignment until the coordinator records their review. This is an intake flag, not
            a safety assessment.
          </small>
        </span>
      </label>
      <p className="form-hint">Only collect what you need. No contact details are required.</p>
      <FormError error={error} />
      <Button className="button primary full" type="submit" busy={busy}>
        Check in item
        <Plus size={16} />
      </Button>
    </form>
  );
}
export function VolunteerForm({ busy, error, onSave }: Props) {
  return (
    <form
      onSubmit={(e) => {
        const f = values(e);
        onSave({ name: f.get('name'), skills: f.getAll('skills'), available: true });
      }}
    >
      <label>
        Volunteer name
        <input
          name="name"
          maxLength={60}
          placeholder="How should we call you?"
          required
          autoFocus
        />
      </label>
      <fieldset>
        <legend>What can they help with?</legend>
        <p className="form-hint">
          Select at least one skill. A match always requires a selected skill.
        </p>
        <div className="skill-options">
          {categories.map((c) => (
            <label key={c} className="skill-option">
              <input type="checkbox" name="skills" value={c} />
              <span>{categoryLabels[c]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormError error={error} />
      <Button className="button primary full" type="submit" busy={busy}>
        Add to the team
        <Plus size={16} />
      </Button>
    </form>
  );
}
