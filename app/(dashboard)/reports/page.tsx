import { redirect } from 'next/navigation';

// Incident Reports (one row per session) was merged into Patient Incidents,
// which lists patients and files every wound scan under its patient. Kept as
// a redirect so existing links and bookmarks still land somewhere useful.
export default function ReportsPage() {
  redirect('/incidents');
}
